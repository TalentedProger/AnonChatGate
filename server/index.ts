// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Set DEV_MODE for development environment
if (process.env.NODE_ENV === 'development' && !process.env.DEV_MODE) {
  process.env.DEV_MODE = 'true';
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { users, rooms } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger, logRequest, logError } from "./logger";
import { API_RATE_LIMIT, SERVER } from "./config";

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

interface ValidationError {
  variable: string;
  issue: string;
  severity: 'error' | 'warning';
}

function validateEnvironment(): ValidationError[] {
  const errors: ValidationError[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Required environment variables for all environments
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push({
        variable: varName,
        issue: 'Missing required environment variable',
        severity: 'error'
      });
    }
  }

  // Production-specific validations
  if (isProduction) {
    // JWT_SECRET must be strong in production
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push({
        variable: 'JWT_SECRET',
        issue: 'JWT_SECRET must be at least 32 characters in production',
        severity: 'error'
      });
    }

    // WEBAPP_URL should use HTTPS in production
    const webappUrl = process.env.WEBAPP_URL;
    if (webappUrl && !webappUrl.startsWith('https://')) {
      errors.push({
        variable: 'WEBAPP_URL',
        issue: 'WEBAPP_URL should use HTTPS in production',
        severity: 'warning'
      });
    }

    // DATABASE_URL should use SSL in production
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true')) {
      errors.push({
        variable: 'DATABASE_URL',
        issue: 'DATABASE_URL should use SSL connection in production',
        severity: 'warning'
      });
    }

    // DEV_MODE should not be enabled in production
    if (process.env.DEV_MODE === 'true') {
      errors.push({
        variable: 'DEV_MODE',
        issue: 'DEV_MODE should not be enabled in production',
        severity: 'error'
      });
    }
  }

  // Telegram bot token check (warning only, as it's optional for some deployments)
  if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.BOT_TOKEN) {
    errors.push({
      variable: 'TELEGRAM_BOT_TOKEN',
      issue: 'Telegram bot token not provided - bot features will be disabled',
      severity: 'warning'
    });
  }

  return errors;
}

// Run environment validation
const envErrors = validateEnvironment();

if (envErrors.length > 0) {
  logger.warn('\n' + '='.repeat(80));
  logger.warn('ENVIRONMENT VALIDATION RESULTS');
  logger.warn('='.repeat(80) + '\n');

  const errors = envErrors.filter(e => e.severity === 'error');
  const warnings = envErrors.filter(e => e.severity === 'warning');

  if (errors.length > 0) {
    logger.error('❌ ERRORS:');
    errors.forEach(err => {
      logger.error(`   ${err.variable}: ${err.issue}`);
    });
  }

  if (warnings.length > 0) {
    logger.warn('\n⚠️  WARNINGS:');
    warnings.forEach(warn => {
      logger.warn(`   ${warn.variable}: ${warn.issue}`);
    });
  }

  logger.warn('\n' + '='.repeat(80) + '\n');

  // Fail fast if there are critical errors
  if (errors.length > 0) {
    logger.error('❌ Server startup aborted due to environment validation errors.');
    logger.error('Please fix the issues above and try again.\n');
    process.exit(1);
  }
}

logger.info('✅ Environment validation passed\n');

const app = express();

// CORS configuration - ONLY for API routes, not for static files
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // ALLOW ALL for now to debug - we'll tighten this later
    // The app is loaded inside Telegram WebView which may have various origins
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
};

// Apply CORS only to API routes, not static files
app.use('/api', cors(corsOptions));

// Also handle preflight for API
app.options('/api/*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT.WINDOW_MS,
  max: API_RATE_LIMIT.MAX_REQUESTS,
  message: { 
    message: 'Слишком много запросов с этого IP, пожалуйста, попробуйте позже.' 
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in development mode for easier testing
    return process.env.NODE_ENV === 'development';
  }
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: API_RATE_LIMIT.WINDOW_MS,
  max: API_RATE_LIMIT.AUTH_MAX_REQUESTS,
  message: { 
    message: 'Слишком много попыток аутентификации, пожалуйста, попробуйте позже.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Use structured logging instead of plain text
      logRequest(req.method, path, undefined, duration);
      
      // Keep vite log for backward compatibility in dev mode
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Database will be initialized on demand through storage operations

  // Initialize Telegram bot
  try {
    if (process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN) {
      await import("./telegram-bot");
      logger.info('Telegram bot initialized');
      log("Telegram bot initialized");
    } else {
      logger.warn('TELEGRAM_BOT_TOKEN not provided, bot not started');
      log("Warning: TELEGRAM_BOT_TOKEN not provided, bot not started");
    }
  } catch (error) {
    logger.error({ error }, 'Error initializing Telegram bot');
    log("Error initializing Telegram bot:", String(error));
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error
    logError(err, {
      path: _req.path,
      method: _req.method,
      status,
    });

    res.status(status).json({ message });
    throw err;
  });

  // Setup static file serving / Vite
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = "0.0.0.0";
  
  server.listen(port, host, () => {
    logger.info({ port, host }, `Server started on port ${port}`);
    log(`serving on port ${port}`);
  });
})();

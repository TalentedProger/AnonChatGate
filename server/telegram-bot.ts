import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import { logger } from './logger';
import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_ID || process.env.ADMIN_ID || '681943543';

// Track error state for exponential backoff
let consecutiveErrors = 0;
let lastErrorTime = 0;
const MAX_ERROR_LOG_INTERVAL = 60000; // Only log detailed errors once per minute
const BOT_DISABLED_THRESHOLD = 10; // After 10 consecutive errors, reduce logging

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// Properly construct webapp URL without double protocol
function getWebAppUrl(): string {
  // Get URL from environment - check Railway, Render, Replit and custom
  let url = process.env.WEBAPP_URL || 
            process.env.RAILWAY_PUBLIC_DOMAIN ||
            process.env.RENDER_EXTERNAL_URL || 
            process.env.REPLIT_DOMAINS?.split(',')[0];
  
  // In production, WEBAPP_URL is required
  if (!url && isProduction) {
    logger.error('[Telegram Bot] WEBAPP_URL is not set! Bot inline buttons will not work.');
    logger.error('[Telegram Bot] Please set WEBAPP_URL environment variable.');
    return 'https://example.com/webapp-url-not-configured';
  }
  
  // Fallback for development only
  if (!url) {
    url = 'localhost:5000';
  }
  
  // Remove any existing protocol to avoid double prefixing
  url = url.replace(/^https?:\/\//, '');
  
  // Don't use localhost in production
  if (isProduction && url.includes('localhost')) {
    logger.error('[Telegram Bot] Cannot use localhost URL in production!');
    return 'https://example.com/webapp-url-not-configured';
  }
  
  // Add version parameter to prevent caching issues
  const version = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  
  // Add https protocol (required for Telegram Mini Apps)
  return `https://${url}${separator}v=${version}`;
}

// Get base URL without version parameter (for webhook)
function getBaseUrl(): string {
  let url = process.env.WEBAPP_URL || 
            process.env.RAILWAY_PUBLIC_DOMAIN ||
            process.env.RENDER_EXTERNAL_URL || 
            process.env.REPLIT_DOMAINS?.split(',')[0];
  
  if (!url) return '';
  
  // Remove any existing protocol
  url = url.replace(/^https?:\/\//, '');
  
  return `https://${url}`;
}

const WEBAPP_URL = getWebAppUrl();
const BASE_URL = getBaseUrl();

if (!BOT_TOKEN) {
  logger.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN is not set - bot will not start');
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Validate webapp URL format
try {
  new URL(WEBAPP_URL);
  logger.info(`[Telegram Bot] Using webapp URL: ${WEBAPP_URL}`);
} catch (error) {
  throw new Error(`Invalid WEBAPP_URL format: ${WEBAPP_URL}`);
}

// Determine bot mode: webhook (production) or polling (development)
// In production: use webhook for reliability (works 24/7)
// In development: use polling for easier testing
// Can be overridden with ENABLE_BOT_POLLING=true or USE_WEBHOOK=true

const useWebhook = isProduction || process.env.USE_WEBHOOK === 'true';
const enablePolling = !useWebhook && process.env.ENABLE_BOT_POLLING !== 'false';

logger.info(`[Telegram Bot] Environment: NODE_ENV=${process.env.NODE_ENV}, isProduction=${isProduction}`);
logger.info(`[Telegram Bot] Mode: ${useWebhook ? 'WEBHOOK' : 'POLLING'}`);

if (useWebhook) {
  logger.info('[Telegram Bot] Webhook mode - bot will receive updates via /api/telegram-webhook');
} else if (enablePolling) {
  logger.info('[Telegram Bot] Polling mode - bot will poll Telegram servers for updates');
} else {
  logger.info('[Telegram Bot] Bot updates DISABLED - only Mini App initData auth will work');
}

// Create bot - webhook mode doesn't poll, just exposes the processUpdate method
const bot = new TelegramBot(BOT_TOKEN, { 
  polling: enablePolling ? {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 30
    }
  } : false
});

// Handle polling errors with exponential backoff and rate limiting
bot.on('polling_error', (error: any) => {
  const now = Date.now();
  consecutiveErrors++;
  
  // Rate limit error logging to prevent log spam
  const shouldLogDetails = (now - lastErrorTime) > MAX_ERROR_LOG_INTERVAL;
  
  if (consecutiveErrors >= BOT_DISABLED_THRESHOLD) {
    // After many errors, only log occasionally
    if (shouldLogDetails) {
      logger.warn(`[Telegram Bot] Polling disabled due to ${consecutiveErrors} consecutive errors`);
      logger.warn('[Telegram Bot] Check network connectivity to api.telegram.org');
      logger.warn('[Telegram Bot] The web app will continue working without bot features');
      lastErrorTime = now;
    }
    return;
  }
  
  // Log error code (always)
  logger.error(`[Telegram Bot] Polling error: ${error.code || 'UNKNOWN'}`);
  
  // Log details only periodically to avoid spam
  if (shouldLogDetails) {
    logger.error(`[Telegram Bot] Message: ${error.message}`);
    lastErrorTime = now;
    
    // Provide helpful error-specific guidance
    if (error.code === 'EFATAL' || error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNRESET')) {
      logger.error('[Telegram Bot] Network connectivity issue detected:');
      logger.error('  - Check your internet connection');
      logger.error('  - If using VPN, ensure it is connected and stable');
      logger.error('  - api.telegram.org may be blocked in your region');
      logger.error('[Telegram Bot] The server will continue running, bot will auto-reconnect when network is restored');
    } else if (error.code === 'ETELEGRAM' && error.message?.includes('409')) {
      logger.error('[Telegram Bot] Another bot instance may be running with the same token');
      logger.error('  - Stop other instances of this application');
      logger.error('  - Each bot token can only be used by one polling instance');
      logger.error('[Telegram Bot] STOPPING POLLING to avoid conflicts...');
      // Stop polling immediately on 409 to prevent spam
      try {
        bot.stopPolling();
        logger.info('[Telegram Bot] Polling stopped. App will continue working without bot polling features.');
      } catch (stopError) {
        logger.error({ error: stopError }, '[Telegram Bot] Failed to stop polling');
      }
    }
  }
});

// Reset error counter on successful operation
bot.on('message', () => {
  if (consecutiveErrors > 0) {
    logger.info(`[Telegram Bot] Connection restored after ${consecutiveErrors} errors`);
    consecutiveErrors = 0;
  }
});

// Set Chat Menu Button with current webapp URL on bot startup
async function setChatMenuButton() {
  try {
    // Set the default menu button for all users
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Start',
        web_app: { url: WEBAPP_URL }
      }
    });
    logger.info('[Telegram Bot] Chat menu button set successfully');
  } catch (error) {
    // This may fail if api.telegram.org is not accessible
    logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, '[Telegram Bot] Could not set chat menu button');
  }
}

// Call setChatMenuButton after a small delay to ensure bot is ready
setTimeout(setChatMenuButton, 2000);

// Setup webhook in production
async function setupWebhook() {
  if (!useWebhook || !BASE_URL) {
    logger.info('[Telegram Bot] Skipping webhook setup (not in webhook mode or no BASE_URL)');
    return;
  }
  
  const webhookUrl = `${BASE_URL}/api/telegram-webhook`;
  
  try {
    // Delete any existing webhook first
    await bot.deleteWebHook();
    
    // Set new webhook with allowed updates
    const result = await bot.setWebHook(webhookUrl, {
      allowed_updates: ['message', 'callback_query']
    } as any);
    
    if (result) {
      logger.info(`[Telegram Bot] Webhook set successfully: ${webhookUrl}`);
    } else {
      logger.error('[Telegram Bot] Failed to set webhook');
    }
    
    // Get webhook info for verification
    const info = await bot.getWebHookInfo();
    logger.info({ webhookInfo: { url: info.url, pending: info.pending_update_count } }, '[Telegram Bot] Webhook info');
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, '[Telegram Bot] Error setting webhook');
  }
}

// Process incoming webhook update
function processWebhookUpdate(update: any): void {
  try {
    bot.processUpdate(update);
  } catch (error) {
    logger.error({ error }, '[Telegram Bot] Error processing webhook update');
  }
}

// Call webhook setup in production after delay
if (useWebhook) {
  setTimeout(setupWebhook, 3000);
}

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('[Telegram Bot] SIGINT received, stopping bot...');
  bot.stopPolling();
});

process.once('SIGTERM', () => {
  logger.info('[Telegram Bot] SIGTERM received, stopping bot...');
  bot.stopPolling();
});

// Anonymous names are now auto-generated in storage as Student_{id}

// Log when bot handlers are registered
logger.info('[Telegram Bot] Registering message handlers...');

// Handle all messages (including /start and other commands)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = BigInt(msg.from?.id || 0);
  const username = msg.from?.username;
  const messageText = msg.text?.toLowerCase();
  
  logger.info({ chatId, userId: userId.toString(), messageText }, '[Telegram Bot] Received message');

  try {
    // Handle /start command or when user wants to access the app
    if (messageText?.includes('/start') || messageText?.includes('старт') || messageText?.includes('начать')) {
      // Check if user already exists
      let user = await storage.getUserByTgId(userId);
      
      if (!user) {
        // Create new user - all users are approved immediately
        user = await storage.createUser({
          tgId: userId,
          username: username || null,
          status: 'approved',
        });
      }

      // Prepare welcome message with app description
      const welcomeMessage = `🌟 **Добро пожаловать в студенческую соцсеть!**

🎓 Это платформа для студентов, где вы можете:
• Знакомиться с однокурсниками анонимно
• Общаться в безопасной среде
• Делиться опытом и находить друзей
• Участвовать в студенческом сообществе

✅ **Статус:** Одобрено
Вы можете сразу начать пользоваться приложением!`;

      // Create keyboard with app launch button
      const keyboard = {
        inline_keyboard: [[
          {
            text: '🚀 Открыть приложение',
            web_app: { url: WEBAPP_URL }
          }
        ]]
      };

      await bot.sendMessage(chatId, 
        welcomeMessage,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    } else {
      // Handle other messages by showing the start keyboard
      const keyboard = {
        inline_keyboard: [[
          {
            text: '🚀 Открыть приложение',
            web_app: { url: WEBAPP_URL }
          }
        ]]
      };

      await bot.sendMessage(chatId, 
        '👋 Привет! Нажмите кнопку ниже, чтобы открыть студенческую соцсеть:',
        { 
          reply_markup: keyboard
        }
      );
    }

  } catch (error) {
    logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error in bot message handler');
    
    // Simple error response without revealing technical details
    try {
      await bot.sendMessage(chatId, '⚡ Попробуйте еще раз через несколько секунд.');
    } catch (sendError) {
      logger.error({ error: sendError }, 'Failed to send error message');
    }
  }
});



export { bot, processWebhookUpdate, BOT_TOKEN };

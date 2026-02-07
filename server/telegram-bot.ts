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

// Properly construct webapp URL without double protocol
function getWebAppUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Get URL from environment
  let url = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || process.env.REPLIT_DOMAINS?.split(',')[0];
  
  // In production, WEBAPP_URL is required
  if (!url && isProduction) {
    logger.error('[Telegram Bot] WEBAPP_URL is not set! Bot inline buttons will not work.');
    logger.error('[Telegram Bot] Please set WEBAPP_URL environment variable on Render.');
    // Use a placeholder that will show an error but not crash
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

const WEBAPP_URL = getWebAppUrl();

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

// Determine if polling should be enabled
// In production, ALWAYS disable polling to avoid 409 conflicts
// Polling is NOT needed for Telegram Mini Apps - they use initData authentication
// Use ENABLE_BOT_POLLING=true to explicitly enable it ONLY if you have a single instance
const isProduction = process.env.NODE_ENV === 'production';
const enablePolling = process.env.ENABLE_BOT_POLLING === 'true' && !isProduction;

// In production, NEVER enable polling - it causes 409 conflicts on multi-instance deployments
if (isProduction && process.env.ENABLE_BOT_POLLING === 'true') {
  logger.warn('[Telegram Bot] ENABLE_BOT_POLLING=true is IGNORED in production to prevent 409 conflicts');
  logger.warn('[Telegram Bot] Telegram Mini Apps work without polling - authentication uses initData');
}

logger.info(`[Telegram Bot] Environment: NODE_ENV=${process.env.NODE_ENV}, isProduction=${isProduction}, ENABLE_BOT_POLLING=${process.env.ENABLE_BOT_POLLING}`);

if (!enablePolling) {
  logger.info('[Telegram Bot] Polling DISABLED - Mini App authentication will still work via initData');
} else {
  logger.info('[Telegram Bot] Polling ENABLED (development mode) - make sure only ONE instance has this enabled!');
}

// Create bot with conditional polling
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
        logger.error('[Telegram Bot] Failed to stop polling:', stopError);
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
    logger.warn('[Telegram Bot] Could not set chat menu button:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Call setChatMenuButton after a small delay to ensure bot is ready
setTimeout(setChatMenuButton, 2000);

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

// Handle all messages (including /start and other commands)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = BigInt(msg.from?.id || 0);
  const username = msg.from?.username;
  const messageText = msg.text?.toLowerCase();

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



export { bot };

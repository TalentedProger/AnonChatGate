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
  let url = process.env.WEBAPP_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  
  // Remove any existing protocol to avoid double prefixing
  url = url.replace(/^https?:\/\//, '');
  
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

// Create bot with more resilient polling settings
const bot = new TelegramBot(BOT_TOKEN, { 
  polling: {
    interval: 1000, // Increased interval to reduce load on unstable connections
    autoStart: true,
    params: {
      timeout: 30 // Longer timeout for better handling of slow connections
    }
  }
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

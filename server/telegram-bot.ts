import TelegramBot from 'node-telegram-bot-api';
import { storage } from './storage';
import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const ADMIN_USER_ID = process.env.TELEGRAM_ADMIN_ID || process.env.ADMIN_ID || '681943543';

// Properly construct webapp URL without double protocol
function getWebAppUrl(): string {
  let url = process.env.WEBAPP_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  
  // Remove any existing protocol to avoid double prefixing
  url = url.replace(/^https?:\/\//, '');
  
  // Add https protocol (required for Telegram Mini Apps)
  return `https://${url}`;
}

const WEBAPP_URL = getWebAppUrl();

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Validate webapp URL format
try {
  new URL(WEBAPP_URL);
  console.log(`[Telegram Bot] Using webapp URL: ${WEBAPP_URL}`);
} catch (error) {
  throw new Error(`Invalid WEBAPP_URL format: ${WEBAPP_URL}`);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Anonymous names are now auto-generated in storage as Student_{id}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = BigInt(msg.from?.id || 0);
  const username = msg.from?.username;

  try {
    // Check if user already exists
    let user = await storage.getUserByTgId(userId);
    
    if (!user) {
      // Create new user with pending status
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
          text: '🚀 Открыть чат',
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

  } catch (error) {
    console.error('Error in /start command:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
});



export { bot };

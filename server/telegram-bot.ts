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
        // Create new user - auto-approve only in development
        const userStatus = process.env.NODE_ENV === 'production' ? 'pending' : 'approved';
        user = await storage.createUser({
          tgId: userId,
          username: username || null,
          status: userStatus,
        });
      } else {
        // Update existing user to approved status only in development
        if (user.status !== 'approved' && process.env.NODE_ENV !== 'production') {
          await storage.updateUserStatus(user.id, 'approved');
          user = await storage.getUserByTgId(userId);
        }
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
    console.error('Error in bot message handler:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Simple error response without revealing technical details
    try {
      await bot.sendMessage(chatId, '⚡ Попробуйте еще раз через несколько секунд.');
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
});



export { bot };

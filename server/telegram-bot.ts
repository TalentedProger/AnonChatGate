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
        status: 'pending',
      });
    }

    // Prepare welcome message with app description
    const welcomeMessage = `🌟 **Добро пожаловать в студенческую соцсеть!**

🎓 Это платформа для студентов, где вы можете:
• Знакомиться с однокурсниками анонимно
• Общаться в безопасной среде
• Делиться опытом и находить друзей
• Участвовать в студенческом сообществе

🔒 Мы заботимся о безопасности - каждый участник проходит модерацию.`;

    let statusMessage = '';
    switch (user.status) {
      case 'pending':
        statusMessage = '\n\n⏳ **Статус заявки:** На рассмотрении\nВаша заявка скоро будет рассмотрена администратором. Как только она будет одобрена, вы получите доступ к приложению!';
        break;
      case 'approved':
        statusMessage = '\n\n✅ **Статус:** Одобрено\nВы уже имеете доступ к приложению!';
        break;
      case 'rejected':
        statusMessage = '\n\n❌ **Статус:** Заявка отклонена\nК сожалению, ваша заявка была отклонена администратором.';
        break;
    }

    await bot.sendMessage(chatId, 
      welcomeMessage + statusMessage,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('Error in /start command:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
  }
});

// Handle /moderate command (admin only)
bot.onText(/\/moderate/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString();

  // Check if user is admin
  if (userId !== ADMIN_USER_ID) {
    await bot.sendMessage(chatId, '❌ У вас нет прав доступа к модерации.');
    return;
  }

  try {
    const pendingUsers = await storage.getPendingUsers();
    
    if (pendingUsers.length === 0) {
      await bot.sendMessage(chatId, 'Нет пользователей на модерации.');
      return;
    }

    // Show first pending user
    const user = pendingUsers[0];
    const userInfo = `👤 <b>Пользователь на модерации</b>

ID: <code>${user.id}</code>
Telegram ID: <code>${user.tgId}</code>
Username: ${user.username ? `@${user.username}` : 'Не указан'}
Анонимное имя: ${user.anonName}
Дата регистрации: ${user.createdAt.toLocaleString('ru-RU')}

Всего в очереди: ${pendingUsers.length}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Одобрить', callback_data: `approve_${user.id}` },
          { text: '❌ Отклонить', callback_data: `reject_${user.id}` }
        ],
        [
          { text: '⏭️ Следующий', callback_data: 'next_user' }
        ]
      ]
    };

    await bot.sendMessage(chatId, userInfo, { 
      reply_markup: keyboard, 
      parse_mode: 'HTML' 
    });

  } catch (error) {
    console.error('Error in /moderate command:', error instanceof Error ? error.message : 'Unknown error');
    await bot.sendMessage(chatId, 'Произошла ошибка при загрузке пользователей.');
  }
});

// Handle callback queries for moderation
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = msg?.chat.id;
  const userId = callbackQuery.from.id.toString();

  if (!chatId || userId !== ADMIN_USER_ID) {
    return;
  }

  try {
    if (data?.startsWith('approve_')) {
      const userIdToApprove = parseInt(data.split('_')[1]);
      const user = await storage.updateUserStatus(userIdToApprove, 'approved');
      
      if (user) {
        await bot.answerCallbackQuery(callbackQuery.id, { 
          text: `✅ ${user.anonName} одобрен`, 
          show_alert: true 
        });
        
        // Notify user if they have a chat with the bot
        try {
          const approvalKeyboard = {
            inline_keyboard: [[
              {
                text: '🚀 Открыть чат',
                web_app: { url: WEBAPP_URL }
              }
            ]]
          };
          
          await bot.sendMessage(Number(user.tgId), 
            '🎉 Поздравляем! Ваша заявка одобрена. Теперь вы можете участвовать в анонимном чате!',
            { reply_markup: approvalKeyboard }
          );
        } catch (error) {
          // User may have not started the bot yet
        }
      }

    } else if (data?.startsWith('reject_')) {
      const userIdToReject = parseInt(data.split('_')[1]);
      const user = await storage.updateUserStatus(userIdToReject, 'rejected');
      
      if (user) {
        await bot.answerCallbackQuery(callbackQuery.id, { 
          text: `❌ ${user.anonName} отклонен`, 
          show_alert: true 
        });
        
        // Notify user if they have a chat with the bot
        try {
          await bot.sendMessage(Number(user.tgId), 
            '😔 К сожалению, ваша заявка была отклонена администратором.'
          );
        } catch (error) {
          // User may have not started the bot yet
        }
      }

    } else if (data === 'next_user') {
      await bot.answerCallbackQuery(callbackQuery.id);
    }

    // After any action, show next pending user
    const pendingUsers = await storage.getPendingUsers();
    
    if (pendingUsers.length === 0) {
      await bot.editMessageText('✅ Все заявки обработаны!', {
        chat_id: chatId,
        message_id: msg?.message_id,
      });
      return;
    }

    const user = pendingUsers[0];
    const userInfo = `👤 <b>Пользователь на модерации</b>

ID: <code>${user.id}</code>
Telegram ID: <code>${user.tgId}</code>
Username: ${user.username ? `@${user.username}` : 'Не указан'}
Анонимное имя: ${user.anonName}
Дата регистрации: ${user.createdAt.toLocaleString('ru-RU')}

Всего в очереди: ${pendingUsers.length}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Одобрить', callback_data: `approve_${user.id}` },
          { text: '❌ Отклонить', callback_data: `reject_${user.id}` }
        ],
        [
          { text: '⏭️ Следующий', callback_data: 'next_user' }
        ]
      ]
    };

    await bot.editMessageText(userInfo, {
      chat_id: chatId,
      message_id: msg?.message_id,
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('Error in callback query:', error instanceof Error ? error.message : 'Unknown error');
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
  }
});

export { bot };

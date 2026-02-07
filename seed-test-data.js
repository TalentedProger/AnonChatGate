import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedTestData() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Insert test news items
    console.log('📰 Creating test news...');
    
    const newsItems = [
      {
        title: 'Добро пожаловать в AguGram!',
        content: 'Мы рады приветствовать вас в студенческой социальной сети AguGram. Здесь вы можете знакомиться, общаться и делиться опытом анонимно и безопасно.',
        imageUrl: null
      },
      {
        title: 'Новые функции профиля',
        content: 'Теперь вы можете видеть свою популярность! Статистика показывает, сколько уникальных пользователей посетили ваш профиль.',
        imageUrl: null
      },
      {
        title: 'Рейтинг популярности',
        content: 'Следите за топом самых популярных пользователей на главной странице. Станьте популярным и попадите в рейтинг!',
        imageUrl: null
      },
      {
        title: 'Анонимный чат работает!',
        content: 'Присоединяйтесь к общему чату и общайтесь с другими студентами. Все сообщения отображаются в реальном времени.',
        imageUrl: null
      },
      {
        title: 'Безопасность прежде всего',
        content: 'Все ваши данные защищены. Мы используем современные методы шифрования для обеспечения вашей безопасности.',
        imageUrl: null
      }
    ];

    for (const item of newsItems) {
      await client.query(
        'INSERT INTO news (title, content, image_url) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [item.title, item.content, item.imageUrl]
      );
    }

    console.log('✅ Test news created successfully');

    // Get news count
    const newsCount = await client.query('SELECT COUNT(*) FROM news');
    console.log(`📊 Total news items: ${newsCount.rows[0].count}`);

    // Get users count
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Total users: ${usersCount.rows[0].count}`);

    console.log('\n✅ Test data seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedTestData();

// Clear database script
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { users, rooms, messages } from './shared/schema.ts';
import { sql } from 'drizzle-orm';

dotenv.config();

async function clearDatabase() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗑️  ОЧИСТКА БАЗЫ ДАННЫХ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }
  
  const connection = neon(dbUrl);
  const db = drizzle(connection);
  
  try {
    // Count existing records
    console.log('📊 Подсчет существующих записей...');
    const messageCount = await db.select().from(messages);
    const roomCount = await db.select().from(rooms);
    const userCount = await db.select().from(users);
    
    console.log(`   Сообщения: ${messageCount.length}`);
    console.log(`   Комнаты: ${roomCount.length}`);
    console.log(`   Пользователи: ${userCount.length}\n`);
    
    // Delete all messages
    console.log('🗑️  Удаление сообщений...');
    await db.delete(messages);
    console.log('   ✅ Все сообщения удалены');
    
    // Delete all rooms
    console.log('🗑️  Удаление комнат...');
    await db.delete(rooms);
    console.log('   ✅ Все комнаты удалены');
    
    // Delete all users
    console.log('🗑️  Удаление пользователей...');
    await db.delete(users);
    console.log('   ✅ Все пользователи удалены');
    
    // Reset sequences
    console.log('\n🔄 Сброс счетчиков ID...');
    try {
      await db.execute(sql`ALTER SEQUENCE users_id_seq RESTART WITH 1`);
      console.log('   ✅ Счетчик users_id_seq сброшен');
    } catch (e) {
      console.log('   ⚠️  users_id_seq: последовательность не найдена (возможно не создана)');
    }
    
    try {
      await db.execute(sql`ALTER SEQUENCE rooms_id_seq RESTART WITH 1`);
      console.log('   ✅ Счетчик rooms_id_seq сброшен');
    } catch (e) {
      console.log('   ⚠️  rooms_id_seq: последовательность не найдена (возможно не создана)');
    }
    
    try {
      await db.execute(sql`ALTER SEQUENCE messages_id_seq RESTART WITH 1`);
      console.log('   ✅ Счетчик messages_id_seq сброшен');
    } catch (e) {
      console.log('   ⚠️  messages_id_seq: последовательность не найдена (возможно не создана)');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ БАЗА ДАННЫХ УСПЕШНО ОЧИЩЕНА!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n💡 Следующие шаги:');
    console.log('   1. Перезапустите сервер (если он запущен)');
    console.log('   2. Откройте Telegram бота и отправьте /start');
    console.log('   3. Нажмите кнопку "🚀 Открыть приложение"\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка при очистке базы данных:');
    console.error(error);
    console.error('\n💡 Убедитесь, что:');
    console.error('   - DATABASE_URL правильно настроен в .env');
    console.error('   - База данных доступна');
    console.error('   - Миграции были применены');
    process.exit(1);
  }
}

clearDatabase();

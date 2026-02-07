// Скрипт для быстрой настройки локальной PostgreSQL базы данных
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗄️  Настройка локальной PostgreSQL базы данных\n');
console.log('Этот скрипт создаст базу данных "anonchatgate" для локальной разработки.\n');

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    // Проверка наличия PostgreSQL
    try {
      execSync('psql --version', { stdio: 'pipe' });
      console.log('✅ PostgreSQL найден\n');
    } catch (err) {
      console.log('❌ PostgreSQL не установлен!');
      console.log('Скачайте и установите: https://www.postgresql.org/download/windows/\n');
      process.exit(1);
    }

    // Запрос пароля
    const password = await question('Введите пароль для пользователя postgres: ');
    
    if (!password) {
      console.log('❌ Пароль не может быть пустым');
      process.exit(1);
    }

    console.log('\n🔧 Создаю базу данных...\n');

    // Команда для создания БД
    const createDbCommand = `psql -U postgres -c "CREATE DATABASE anonchatgate;"`;
    
    try {
      // Попытка создать БД
      execSync(createDbCommand, {
        stdio: 'pipe',
        env: { ...process.env, PGPASSWORD: password }
      });
      console.log('✅ База данных "anonchatgate" создана успешно!\n');
    } catch (err) {
      const errorMessage = err.stderr?.toString() || '';
      
      if (errorMessage.includes('already exists')) {
        console.log('ℹ️  База данных "anonchatgate" уже существует\n');
      } else if (errorMessage.includes('authentication failed')) {
        console.log('❌ Неверный пароль для пользователя postgres');
        console.log('Попробуйте снова или сбросьте пароль через pgAdmin\n');
        process.exit(1);
      } else {
        console.log('❌ Ошибка при создании БД:');
        console.log(errorMessage);
        process.exit(1);
      }
    }

    // Обновление .env файла
    console.log('📝 Обновляю DATABASE_URL в .env файле...\n');
    
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      
      // Обновляем DATABASE_URL
      const newDatabaseUrl = `DATABASE_URL=postgresql://postgres:${password}@localhost:5432/anonchatgate`;
      
      if (envContent.includes('DATABASE_URL=')) {
        // Заменяем существующую строку
        envContent = envContent.replace(
          /DATABASE_URL=.*$/m,
          newDatabaseUrl
        );
      } else {
        // Добавляем новую
        envContent = newDatabaseUrl + '\n' + envContent;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ DATABASE_URL обновлен в .env\n');
    } else {
      console.log('⚠️  Файл .env не найден. Создайте его из .env.example\n');
    }

    // Проверка подключения
    console.log('🔌 Проверяю подключение к БД...\n');
    
    try {
      const testCommand = `psql -U postgres -d anonchatgate -c "SELECT version();"`;
      const result = execSync(testCommand, {
        encoding: 'utf-8',
        env: { ...process.env, PGPASSWORD: password }
      });
      
      console.log('✅ Подключение успешно!\n');
    } catch (err) {
      console.log('❌ Не удалось подключиться к БД');
      console.log(err.message);
    }

    console.log('=' .repeat(60));
    console.log('🎉 БАЗА ДАННЫХ ГОТОВА К РАБОТЕ!\n');
    console.log('Следующие шаги:');
    console.log('1. Запустите миграции: npm run db:push');
    console.log('2. Запустите сервер: npm run dev\n');
    console.log('📖 Подробная документация: docs/LOCAL_SETUP.md');
    console.log('=' .repeat(60));

  } catch (err) {
    console.log('❌ Непредвиденная ошибка:', err.message);
  } finally {
    rl.close();
  }
}

main();

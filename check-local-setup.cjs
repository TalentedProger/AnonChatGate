// Скрипт проверки готовности к локальному запуску
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка готовности к локальному запуску AnonChatGate...\n');

let errors = [];
let warnings = [];

// 1. Проверка Node.js
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js: ${nodeVersion}`);
  if (parseInt(nodeVersion.slice(1)) < 18) {
    warnings.push('⚠️  Рекомендуется Node.js версии 18 или выше');
  }
} catch (err) {
  errors.push('❌ Node.js не найден');
}

// 2. Проверка npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ npm: v${npmVersion}`);
} catch (err) {
  errors.push('❌ npm не найден');
}

// 3. Проверка PostgreSQL
try {
  const pgVersion = execSync('psql --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ PostgreSQL: ${pgVersion}`);
} catch (err) {
  errors.push('❌ PostgreSQL не установлен');
  console.log('❌ PostgreSQL не найден');
  console.log('   Установите: https://www.postgresql.org/download/windows/');
}

// 4. Проверка .env файла
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ Файл .env существует');
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  // Проверка обязательных переменных
  const requiredVars = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ADMIN_ID',
    'WEBAPP_URL',
    'JWT_SECRET'
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && 
        !envContent.match(new RegExp(`${varName}=.*your.*`, 'i'))) {
      console.log(`   ✅ ${varName} настроен`);
    } else {
      warnings.push(`⚠️  ${varName} не настроен в .env`);
    }
  });
} else {
  errors.push('❌ Файл .env не найден');
  console.log('   Скопируйте .env.example в .env');
}

// 5. Проверка node_modules
if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('✅ Зависимости установлены (node_modules)');
} else {
  warnings.push('⚠️  Зависимости не установлены. Запустите: npm install');
}

// 6. Проверка важных зависимостей
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  
  if (packageJson.dependencies.pg) {
    console.log('✅ pg (PostgreSQL driver) установлен');
  } else {
    warnings.push('⚠️  pg не найден в зависимостях. Запустите: npm install pg');
  }
  
  if (packageJson.dependencies['drizzle-orm']) {
    console.log('✅ drizzle-orm установлен');
  } else {
    errors.push('❌ drizzle-orm не найден');
  }
} catch (err) {
  errors.push('❌ Не удалось прочитать package.json');
}

console.log('\n' + '='.repeat(60));

// Итоговый отчет
if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!\n');
  console.log('Следующие шаги:');
  console.log('1. Создайте БД: psql -U postgres -c "CREATE DATABASE anonchatgate;"');
  console.log('2. Запустите миграции: npm run db:push');
  console.log('3. Запустите сервер: npm run dev');
  console.log('\nДля тестирования Telegram Mini App см. docs/LOCAL_SETUP.md (раздел ngrok)');
} else {
  if (errors.length > 0) {
    console.log('❌ КРИТИЧЕСКИЕ ОШИБКИ:\n');
    errors.forEach(err => console.log('  ' + err));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  ПРЕДУПРЕЖДЕНИЯ:\n');
    warnings.forEach(warn => console.log('  ' + warn));
  }
  
  console.log('\n📖 См. подробные инструкции: docs/LOCAL_SETUP.md');
}

console.log('='.repeat(60));

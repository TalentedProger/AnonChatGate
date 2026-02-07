// Генератор секретного ключа для JWT
// Запуск: node generate-secret.js

import crypto from 'crypto';

const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 Новый JWT_SECRET:\n');
console.log(secret);
console.log('\n📋 Скопируйте и вставьте в Railway Variables:\n');
console.log(`JWT_SECRET=${secret}`);
console.log('\n');

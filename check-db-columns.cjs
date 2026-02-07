const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function checkColumns() {
  try {
    const result = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`;
    console.log('Columns in users table:');
    result.forEach(r => console.log('  -', r.column_name));
    
    // Check if telegram_photo_url exists
    const hasTelegramPhotoUrl = result.some(r => r.column_name === 'telegram_photo_url');
    console.log('\ntelegram_photo_url column exists:', hasTelegramPhotoUrl);
    
    // Check favorites table
    const favorites = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'favorites'`;
    console.log('\nColumns in favorites table:');
    favorites.forEach(r => console.log('  -', r.column_name));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkColumns();

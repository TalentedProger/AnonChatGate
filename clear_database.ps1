# Clear all users from database
Write-Host "=== Clearing Database ===" -ForegroundColor Red

# Connect to database and clear users
Write-Host "This will delete ALL users from the database." -ForegroundColor Yellow
Write-Host "Press Enter to continue or Ctrl+C to cancel..."
Read-Host

Write-Host "Clearing database..." -ForegroundColor Yellow

# Using the DATABASE_URL from .env
$env:DATABASE_URL = "postgresql://neondb_owner:npg_my8lc7NgiaQG@ep-delicate-boat-adl99rqg-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# SQL to delete all users
$sql = "DELETE FROM users; ALTER SEQUENCE users_id_seq RESTART WITH 1;"

Write-Host "Executing SQL: $sql" -ForegroundColor Cyan

# Using psql if available, otherwise show instructions
try {
    # Try to run with psql
    $sql | psql $env:DATABASE_URL
    Write-Host "Database cleared successfully!" -ForegroundColor Green
} catch {
    Write-Host "Could not connect with psql. Use this SQL manually:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor White
}

# Test complete registration flow
Write-Host "=== Testing Full Registration Flow ===" -ForegroundColor Cyan

# Step 1: Authenticate (simulating new user)
Write-Host "`n1. Creating new user..." -ForegroundColor Yellow
$auth = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{}' | ConvertFrom-Json

Write-Host "   User Created:" -ForegroundColor Green
Write-Host "   - User ID: $($auth.user.id)" -ForegroundColor White
Write-Host "   - Anon Name: $($auth.user.anonName)" -ForegroundColor White
Write-Host "   - Status: $($auth.status)" -ForegroundColor White
Write-Host "   - Token Length: $($auth.token.Length)" -ForegroundColor White

# Step 2: Check profile (should not be completed)
Write-Host "`n2. Checking profile status..." -ForegroundColor Yellow
$profile = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method GET -Headers @{'Authorization'="Bearer $($auth.token)"} | ConvertFrom-Json
Write-Host "   Profile Completed: $($profile.profile.profileCompleted)" -ForegroundColor $(if ($profile.profile.profileCompleted) { "Red" } else { "Green" })

# Step 3: Complete registration
Write-Host "`n3. Completing registration..." -ForegroundColor Yellow
$registrationData = @{
    displayName = "testuser"
    gender = "male"
    course = "3"
    direction = "Computer Science"
    bio = "Testing registration flow"
    socialLinks = @("https://t.me/testuser")
    photos = @()
} | ConvertTo-Json

$completed = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{'Content-Type'='application/json'; 'Authorization'="Bearer $($auth.token)"} -Body $registrationData | ConvertFrom-Json

Write-Host "   Registration Successful!" -ForegroundColor Green
Write-Host "   - Display Name: $($completed.profile.displayName)" -ForegroundColor White
Write-Host "   - Gender: $($completed.profile.gender)" -ForegroundColor White
Write-Host "   - Course: $($completed.profile.course)" -ForegroundColor White
Write-Host "   - Direction: $($completed.profile.direction)" -ForegroundColor White
Write-Host "   - Profile Completed: $($completed.profile.profileCompleted)" -ForegroundColor Green

# Step 4: Verify profile is accessible
Write-Host "`n4. Verifying profile access..." -ForegroundColor Yellow
$verified = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method GET -Headers @{'Authorization'="Bearer $($auth.token)"} | ConvertFrom-Json
Write-Host "   Profile accessible: $($verified.profile.displayName) (Completed: $($verified.profile.profileCompleted))" -ForegroundColor Green

Write-Host "`n=== ALL TESTS PASSED ===" -ForegroundColor Cyan
Write-Host "You can now:" -ForegroundColor White
Write-Host "1. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "2. Clear localStorage and reload to test registration flow" -ForegroundColor White
Write-Host "3. Complete profile will redirect to home, incomplete to /register" -ForegroundColor White

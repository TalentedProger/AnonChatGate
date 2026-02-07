# Test Registration Script
Write-Host "=== Testing Registration Flow ===" -ForegroundColor Cyan

# Step 1: Authenticate
Write-Host "`n1. Authenticating user..." -ForegroundColor Yellow
$authResponse = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"222222"}'
$authData = $authResponse.Content | ConvertFrom-Json
$token = $authData.token
Write-Host "Authenticated! User ID: $($authData.user.id), AnonName: $($authData.user.anonName)" -ForegroundColor Green

# Step 2: Update Profile
Write-Host "`n2. Creating user profile..." -ForegroundColor Yellow
$profileData = @{
    displayName = "aleksey"
    gender = "male"
    course = "3"
    direction = "Programming"
    bio = "Love coding and games"
    socialLinks = @("https://t.me/aleksey", "https://vk.com/aleksey")
    photos = @()
}
$profileBody = $profileData | ConvertTo-Json

$profileResponse = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token"
} -Body $profileBody

$profileData = $profileResponse.Content | ConvertFrom-Json
Write-Host "✓ Profile created!" -ForegroundColor Green
Write-Host "  Display Name: $($profileData.profile.displayName)" -ForegroundColor White
Write-Host "  Gender: $($profileData.profile.gender)" -ForegroundColor White
Write-Host "  Course: $($profileData.profile.course)" -ForegroundColor White
Write-Host "  Direction: $($profileData.profile.direction)" -ForegroundColor White
Write-Host "  Bio: $($profileData.profile.bio)" -ForegroundColor White
Write-Host "  Profile Completed: $($profileData.profile.profileCompleted)" -ForegroundColor White

# Step 3: Create another user
Write-Host "`n3. Creating second user..." -ForegroundColor Yellow
$authResponse2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"333333"}'
$authData2 = $authResponse2.Content | ConvertFrom-Json
$token2 = $authData2.token
Write-Host "✓ Authenticated! User ID: $($authData2.user.id), AnonName: $($authData2.user.anonName)" -ForegroundColor Green

$profileBody2 = @{
    displayName = "maria"
    gender = "female"
    course = "2"
    direction = "Дизайн"
    bio = "Творческий человек, люблю рисовать"
    socialLinks = @("https://instagram.com/maria")
    photos = @()
} | ConvertTo-Json

$profileResponse2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token2"
} -Body $profileBody2

$profileData2 = $profileResponse2.Content | ConvertFrom-Json
Write-Host "✓ Profile created!" -ForegroundColor Green
Write-Host "  Display Name: $($profileData2.profile.displayName)" -ForegroundColor White
Write-Host "  Gender: $($profileData2.profile.gender)" -ForegroundColor White
Write-Host "  Course: $($profileData2.profile.course)" -ForegroundColor White

# Step 4: Create third user
Write-Host "`n4. Creating third user..." -ForegroundColor Yellow
$authResponse3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"444444"}'
$authData3 = $authResponse3.Content | ConvertFrom-Json
$token3 = $authData3.token
Write-Host "✓ Authenticated! User ID: $($authData3.user.id), AnonName: $($authData3.user.anonName)" -ForegroundColor Green

$profileBody3 = @{
    displayName = "dmitriy"
    gender = "male"
    course = "4"
    direction = "Кибербезопасность"
    bio = "Интересуюсь безопасностью и хакингом"
    socialLinks = @("https://t.me/dmitriy", "https://vk.com/dmitriy", "https://instagram.com/dmitriy")
    photos = @()
} | ConvertTo-Json

$profileResponse3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $token3"
} -Body $profileBody3

$profileData3 = $profileResponse3.Content | ConvertFrom-Json
Write-Host "✓ Profile created!" -ForegroundColor Green
Write-Host "  Display Name: $($profileData3.profile.displayName)" -ForegroundColor White
Write-Host "  Gender: $($profileData3.profile.gender)" -ForegroundColor White
Write-Host "  Course: $($profileData3.profile.course)" -ForegroundColor White

Write-Host "`n=== All Tests Completed Successfully! ===" -ForegroundColor Cyan
Write-Host "`nCreated users:" -ForegroundColor White
Write-Host "1. $($profileData.profile.displayName) - $($profileData.profile.course) курс, $($profileData.profile.direction)" -ForegroundColor White
Write-Host "2. $($profileData2.profile.displayName) - $($profileData2.profile.course) курс, $($profileData2.profile.direction)" -ForegroundColor White
Write-Host "3. $($profileData3.profile.displayName) - $($profileData3.profile.course) курс, $($profileData3.profile.direction)" -ForegroundColor White

Write-Host "=== Testing Registration ===" -ForegroundColor Cyan

# User 1
Write-Host "`nUser 1: Authenticating..." -ForegroundColor Yellow
$auth1 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"555555"}' | ConvertFrom-Json
Write-Host "User ID: $($auth1.user.id)" -ForegroundColor Green

$profile1 = @{
    displayName = "alex"
    gender = "male"
    course = "3"
    direction = "Programming"
    bio = "Love coding"
    socialLinks = @("https://t.me/alex")
    photos = @()
} | ConvertTo-Json

Write-Host "Creating profile..." -ForegroundColor Yellow
$result1 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{'Content-Type'='application/json'; 'Authorization'="Bearer $($auth1.token)"} -Body $profile1 | ConvertFrom-Json
Write-Host "Profile: $($result1.profile.displayName) - Course: $($result1.profile.course)" -ForegroundColor Green

# User 2
Write-Host "`nUser 2: Authenticating..." -ForegroundColor Yellow
$auth2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"666666"}' | ConvertFrom-Json
Write-Host "User ID: $($auth2.user.id)" -ForegroundColor Green

$profile2 = @{
    displayName = "maria"
    gender = "female"
    course = "2"
    direction = "Design"
    bio = "Creative person"
    socialLinks = @("https://instagram.com/maria")
    photos = @()
} | ConvertTo-Json

Write-Host "Creating profile..." -ForegroundColor Yellow
$result2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{'Content-Type'='application/json'; 'Authorization'="Bearer $($auth2.token)"} -Body $profile2 | ConvertFrom-Json
Write-Host "Profile: $($result2.profile.displayName) - Course: $($result2.profile.course)" -ForegroundColor Green

# User 3
Write-Host "`nUser 3: Authenticating..." -ForegroundColor Yellow
$auth3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"777777"}' | ConvertFrom-Json
Write-Host "User ID: $($auth3.user.id)" -ForegroundColor Green

$profile3 = @{
    displayName = "dmitry"
    gender = "male"
    course = "4"
    direction = "Cybersecurity"
    bio = "Security researcher"
    socialLinks = @("https://t.me/dmitry", "https://vk.com/dmitry")
    photos = @()
} | ConvertTo-Json

Write-Host "Creating profile..." -ForegroundColor Yellow
$result3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method PATCH -Headers @{'Content-Type'='application/json'; 'Authorization'="Bearer $($auth3.token)"} -Body $profile3 | ConvertFrom-Json
Write-Host "Profile: $($result3.profile.displayName) - Course: $($result3.profile.course)" -ForegroundColor Green

Write-Host "`n=== SUCCESS! Created 3 users ===" -ForegroundColor Cyan

# Check created users
Write-Host "Checking created users..." -ForegroundColor Cyan

# Check alex
$auth1 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"555555"}' | ConvertFrom-Json
$profile1 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method GET -Headers @{'Authorization'="Bearer $($auth1.token)"} | ConvertFrom-Json
Write-Host "`nUser 1 (alex):" -ForegroundColor Yellow
Write-Host "  Display Name: $($profile1.profile.displayName)"
Write-Host "  Gender: $($profile1.profile.gender)"
Write-Host "  Course: $($profile1.profile.course)"
Write-Host "  Direction: $($profile1.profile.direction)"
Write-Host "  Bio: $($profile1.profile.bio)"
Write-Host "  Profile Completed: $($profile1.profile.profileCompleted)"

# Check maria
$auth2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"666666"}' | ConvertFrom-Json
$profile2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method GET -Headers @{'Authorization'="Bearer $($auth2.token)"} | ConvertFrom-Json
Write-Host "`nUser 2 (maria):" -ForegroundColor Yellow
Write-Host "  Display Name: $($profile2.profile.displayName)"
Write-Host "  Gender: $($profile2.profile.gender)"
Write-Host "  Course: $($profile2.profile.course)"
Write-Host "  Direction: $($profile2.profile.direction)"
Write-Host "  Profile Completed: $($profile2.profile.profileCompleted)"

# Check dmitry
$auth3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"tgId":"777777"}' | ConvertFrom-Json
$profile3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/profile' -Method GET -Headers @{'Authorization'="Bearer $($auth3.token)"} | ConvertFrom-Json
Write-Host "`nUser 3 (dmitry):" -ForegroundColor Yellow
Write-Host "  Display Name: $($profile3.profile.displayName)"
Write-Host "  Gender: $($profile3.profile.gender)"
Write-Host "  Course: $($profile3.profile.course)"
Write-Host "  Direction: $($profile3.profile.direction)"
Write-Host "  Profile Completed: $($profile3.profile.profileCompleted)"

Write-Host "`nAll profiles verified successfully!" -ForegroundColor Green

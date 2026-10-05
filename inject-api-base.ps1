# Lee API_BASE desde .env e inyecta en index.html antes de desplegar
# Uso (PowerShell): .\inject-api-base.ps1

if (-not (Test-Path '.env')) {
  Write-Host "Error: .env no encontrado en $(Get-Location)" -ForegroundColor Red
  exit 1
}

# Lee .env (formato: KEY=VALUE)
$env_content = Get-Content '.env' -Raw
$api_base = $null
foreach ($line in $env_content -split "`n") {
  if ($line -match '^\s*API_BASE\s*=\s*(.+?)\s*$') {
    $api_base = $matches[1]
    break
  }
}

if (-not $api_base) {
  Write-Host "Error: API_BASE no está definida en .env" -ForegroundColor Red
  exit 1
}

# Lee index.html
$html = Get-Content 'index.html' -Raw

# Reemplaza el placeholder
$html = $html -replace '// window\.API_BASE_URL = .*?;', "window.API_BASE_URL = '$api_base';"

# Guarda index.html
Set-Content 'index.html' $html -Encoding UTF8

Write-Host "✓ API_BASE inyectada en index.html: $api_base" -ForegroundColor Green

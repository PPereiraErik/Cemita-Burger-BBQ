# Teste no CELULAR com o sistema completo (site + API + painel), na mesma rede Wi-Fi.
# Descobre o IP do computador, ajusta server\.env e .env.local e abre a API e o site em duas janelas.
#
# Uso, na pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File .\teste-celular.ps1
# Para voltar ao normal (só localhost):
#   powershell -ExecutionPolicy Bypass -File .\teste-celular.ps1 -Desfazer
param([switch]$Desfazer)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverEnv = Join-Path $root 'server\.env'
$siteEnv = Join-Path $root '.env.local'

function Set-EnvLine([string]$path, [string]$key, [string]$value) {
  $lines = @()
  if (Test-Path $path) { $lines = @(Get-Content -LiteralPath $path) }
  $found = $false
  $out = @(foreach ($l in $lines) {
    if ($l -match "^\s*$key\s*=") { $found = $true; "$key=$value" } else { $l }
  })
  if (-not $found) { $out += "$key=$value" }
  # UTF-8 sem BOM (o Node lê o .env errado se o arquivo começar com BOM)
  [System.IO.File]::WriteAllLines($path, [string[]]$out, (New-Object System.Text.UTF8Encoding($false)))
}

if (-not (Test-Path $serverEnv)) { Copy-Item (Join-Path $root 'server\.env.example') $serverEnv }
if (-not (Test-Path $siteEnv)) { Copy-Item (Join-Path $root '.env.example') $siteEnv }

if ($Desfazer) {
  Set-EnvLine $serverEnv 'CORS_ORIGINS' 'http://localhost:5173'
  Set-EnvLine $serverEnv 'PUBLIC_SITE_URL' 'http://localhost:5173'
  Set-EnvLine $siteEnv 'VITE_API_URL' 'http://localhost:3333/api/v1'
  Write-Host 'Pronto: voltou para localhost. Reinicie a API e o site.' -ForegroundColor Green
  exit 0
}

# IP da placa que tem acesso à rede (a que tem gateway padrão: Wi-Fi ou cabo)
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
if (-not $cfg) { Write-Host 'Não achei uma rede conectada. Conecte o computador ao Wi-Fi e rode de novo.' -ForegroundColor Red; exit 1 }
$ip = @($cfg.IPv4Address)[0].IPAddress
Write-Host "IP do computador: $ip  (rede: $($cfg.InterfaceAlias))" -ForegroundColor Cyan

# rede pública bloqueia conexões de outros aparelhos
$perfil = Get-NetConnectionProfile -InterfaceIndex $cfg.InterfaceIndex -ErrorAction SilentlyContinue
if ($perfil -and $perfil.NetworkCategory -eq 'Public') {
  Write-Host 'Atenção: o Windows marcou esta rede como PÚBLICA, e o celular não vai conseguir abrir.' -ForegroundColor Yellow
  Write-Host '  Configurações > Rede e Internet > Wi-Fi > (sua rede) > Tipo de perfil de rede: Privada' -ForegroundColor Yellow
}

Set-EnvLine $serverEnv 'CORS_ORIGINS' "http://localhost:5173,http://${ip}:5173"
# volta do Mercado Pago (Pix/cartão no site) para o site aberto no celular
Set-EnvLine $serverEnv 'PUBLIC_SITE_URL' "http://${ip}:5173"
Set-EnvLine $siteEnv 'VITE_API_URL' "http://${ip}:3333/api/v1"
Write-Host 'Ajustei server\.env (CORS_ORIGINS, PUBLIC_SITE_URL) e .env.local (VITE_API_URL).' -ForegroundColor Green

# firewall: libera as portas 5173 e 3333 só em rede privada (precisa do PowerShell como administrador)
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$regra = 'Cemita teste no celular (5173, 3333)'
if (-not (Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue)) {
  if ($admin) {
    New-NetFirewallRule -DisplayName $regra -Direction Inbound -Protocol TCP -LocalPort 5173,3333 -Profile Private -Action Allow | Out-Null
    Write-Host 'Firewall: portas 5173 e 3333 liberadas na rede privada.' -ForegroundColor Green
  } else {
    Write-Host 'Firewall: se o celular não abrir, rode UMA vez num PowerShell como administrador:' -ForegroundColor Yellow
    Write-Host "  New-NetFirewallRule -DisplayName '$regra' -Direction Inbound -Protocol TCP -LocalPort 5173,3333 -Profile Private -Action Allow" -ForegroundColor Yellow
  }
}

# abre a API e o site em duas janelas
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\server'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; npm run dev -- --host"

Write-Host ''
Write-Host "No CELULAR (mesmo Wi-Fi):  http://${ip}:5173" -ForegroundColor Cyan
Write-Host "Painel no COMPUTADOR:      http://${ip}:5173/admin/   (use o IP, não localhost: senão o login do painel não funciona)" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Para voltar ao normal depois: powershell -ExecutionPolicy Bypass -File .\teste-celular.ps1 -Desfazer'

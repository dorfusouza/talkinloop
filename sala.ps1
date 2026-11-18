# Modo sala (Windows, sem Docker): usa o Node direto e põe o IP do notebook na rede local como
# endereço da plateia. Serve para aula em que os alunos estão na mesma rede e não há internet boa.
#   .\sala.ps1                      palestra "starter" na porta 8080
#   .\sala.ps1 -Talk minha-aula     escolhe a pasta de deck/talks/
#   .\sala.ps1 -Rebuild             refaz os slides (use depois de editar a palestra)
#   .\sala.ps1 -Port 8081           outra porta
# Precisa do Node 22.18 ou mais novo (https://nodejs.org). Na primeira vez baixa as dependências e
# gera os slides, o que leva alguns minutos; nas seguintes sobe em segundos. Ctrl+C encerra.
# Se a Wi-Fi da escola isolar os aparelhos entre si, os notebooks dos alunos não alcançam este.
# Se o PowerShell recusar o script: Set-ExecutionPolicy -Scope Process Bypass
param([string]$Talk = "starter", [int]$Port = 8080, [switch]$Rebuild)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Fail($msg) { Write-Host ""; Write-Host "  $msg"; Write-Host ""; exit 1 }
function Run($dir, $what, [scriptblock]$cmd) {
  Push-Location (Join-Path $root $dir)
  try { & $cmd; if ($LASTEXITCODE -ne 0) { Fail "Falhou: $what (código $LASTEXITCODE). Leia a mensagem acima." } }
  finally { Pop-Location }
}

# Node 22.18+
$nodeOut = $null
try { $nodeOut = (& node -v) } catch {}
if (-not $nodeOut) { Fail "Node não encontrado. Instale a versão LTS em https://nodejs.org e abra um PowerShell novo." }
if ([version]($nodeOut.Trim().TrimStart('v')) -lt [version]"22.18") { Fail "Node $nodeOut é antigo demais; o projeto pede 22.18 ou mais novo. Atualize em https://nodejs.org." }

# IP do notebook na rede ativa
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1
if (-not $cfg) { Fail "Não achei uma rede ativa. Conecte ao Wi-Fi ou ao cabo e rode de novo." }
$ip = $cfg.IPv4Address[0].IPAddress

$env:TALK = $Talk
$env:PORT = "$Port"
$env:PUBLIC_URL = "http://${ip}:${Port}"
$env:DATA_DIR = Join-Path $root "backstage\data"
$env:NEXT_TELEMETRY_DISABLED = "1"

# dependências, uma vez
if (-not (Test-Path (Join-Path $root "deck\node_modules"))) { Write-Host "  Instalando dependências dos slides..."; Run "deck" "npm ci (deck)" { npm ci } }
if (-not (Test-Path (Join-Path $root "backstage\node_modules"))) { Write-Host "  Instalando dependências do servidor..."; Run "backstage" "npm ci (backstage)" { npm ci } }

# slides: refaz se pedido, se nunca foi feito ou se a palestra mudou
$marker = Join-Path $root "deck\out\.talk"
$built = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { "" }
if ($Rebuild -or $built -ne $Talk) {
  Write-Host "  Gerando os slides de '$Talk'..."
  Run "deck" "npm run build" { npm run build }
  Set-Content -Path $marker -Value $Talk -NoNewline
}

Write-Host ""
Write-Host "  Alunos: abram no navegador  $($env:PUBLIC_URL)"
Write-Host "  Você: abra o link do 'palco' que aparece abaixo (o que termina em ?token=...)."
Write-Host "  Na primeira vez, o Windows pergunta sobre o firewall: permita em rede privada."
Write-Host ""
Push-Location (Join-Path $root "backstage")
try { node server.ts } finally { Pop-Location }

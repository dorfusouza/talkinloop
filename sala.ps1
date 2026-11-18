# Modo sala (Windows): sobe só o app, sem túnel, com o IP do notebook na rede local como endereço
# da plateia. Serve para aula em que os alunos estão na mesma rede e a internet é ruim ou bloqueada.
#   .\sala.ps1                      palestra "starter" na porta 8080
#   .\sala.ps1 -Talk minha-aula     escolhe a pasta de deck/talks/
#   .\sala.ps1 -Port 8081           outra porta
# Se a Wi-Fi da escola isolar os aparelhos entre si, os notebooks dos alunos não vão alcançar este;
# nesse caso use o túnel: docker compose up --build
param([string]$Talk = "starter", [int]$Port = 8080)
$ErrorActionPreference = "Stop"

$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1
if (-not $cfg) { Write-Host "Não achei uma rede ativa. Conecte ao Wi-Fi ou ao cabo e rode de novo."; exit 1 }
$ip = $cfg.IPv4Address[0].IPAddress

$env:TALK = $Talk
$env:PORT = "$Port"
$env:PUBLIC_URL = "http://${ip}:${Port}"

Write-Host ""
Write-Host "  Endereço para os alunos digitarem no navegador: $($env:PUBLIC_URL)"
Write-Host "  Na primeira vez, o Windows pergunta sobre o firewall: permita em rede privada."
Write-Host ""
docker compose up --build app

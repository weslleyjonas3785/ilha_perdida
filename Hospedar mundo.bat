@echo off
title Ilha Perdida - servidor do mundo
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado. Baixe a versao LTS em https://nodejs.org e rode este arquivo de novo.
  start https://nodejs.org
  pause
  exit /b
)
echo Se o Windows perguntar sobre o Firewall, clique em PERMITIR (redes privadas e publicas).
node server.mjs
pause

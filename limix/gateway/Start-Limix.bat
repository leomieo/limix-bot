@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Limix Bot
where node >nul 2>nul
if errorlevel 1 (
  echo Chua co Node.js tren may. Hay cai ban LTS tai https://nodejs.org roi chay lai file nay.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0])<22?1:0)"
if errorlevel 1 (
  echo Node.js qua cu. Can ban 22 tro len. Tai ban LTS moi tai https://nodejs.org
  start "" https://nodejs.org/
  pause
  exit /b 1
)
node src\main.mjs
pause

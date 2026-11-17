@echo off
chcp 65001 >nul
cd /d "%~dp0"
node --test test\*.test.mjs
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
node --test test\units.test.mjs test\gateway.test.mjs test\web.test.mjs
pause

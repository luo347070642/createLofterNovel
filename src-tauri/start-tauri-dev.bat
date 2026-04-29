@echo off
cd /d "%~dp0\.."
call npm run build:css
set TAURI=1
start "LofterNovelServer" /MIN node index.js

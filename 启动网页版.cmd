@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo [ERROR] node_modules missing.
  echo Double-click the "install" .cmd in this folder first.
  pause
  exit /b 1
)
start "" http://127.0.0.1:5173/
"E:\Deepseek harness\node.exe" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173
pause
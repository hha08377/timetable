@echo off
chcp 65001 >nul
cd /d "%~dp0"
call "E:\Deepseek harness\npm.cmd" install --no-fund --no-audit
pause
@echo off
chcp 65001 >nul
"%~dp0runtime\python.exe" -B -X utf8 "%~dp0peek.py" --watch 10 %*
pause

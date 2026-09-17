@echo off
cd /d "%~dp0"
call .\venv\Scripts\uvicorn.exe %*

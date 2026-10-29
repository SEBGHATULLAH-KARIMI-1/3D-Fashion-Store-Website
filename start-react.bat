@echo off
rem Double-click to install (or update) packages and run the React site.
cd /d "%~dp0"
call npm install
call npm run dev
pause

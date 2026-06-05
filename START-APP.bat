@echo off
title AttendancePro Launcher
echo.
echo  ========================================
echo    AttendancePro - Starting...
echo  ========================================
echo.
echo  [1/2] Starting Backend Server (port 5000)...
start "AttendancePro - Backend" cmd /k "cd /d C:\Users\waqar\Desktop\attendance-portal\backend && node server.js"
timeout /t 5 /nobreak >nul

echo  [2/2] Starting Frontend (port 3000)...
start "AttendancePro - Frontend" cmd /k "cd /d C:\Users\waqar\Desktop\attendance-portal\frontend && npm run dev"
timeout /t 4 /nobreak >nul

echo  Opening browser...
start http://localhost:3000

echo.
echo  ========================================
echo    App is running!
echo    Open: http://localhost:3000
echo    Trainer login: trainer@institute.com
echo    Password:      trainer123
echo  ========================================
echo.
echo  To stop the app: close the two black
echo  windows labeled "Backend" and "Frontend"
echo.
pause

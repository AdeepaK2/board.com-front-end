@echo off
cd /d "%~dp0"
cls
echo ===================================================
echo    WHITEBOARD FRONTEND - NETWORK MODE
echo ===================================================
echo.
echo Starting Vite development server...
echo.
echo IMPORTANT: Share these URLs with collaborators:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    setlocal enabledelayedexpansion
    set IP=!IP: =!
    echo   Network URL: http://!IP!:5173
    endlocal
)
echo   Localhost: http://localhost:5173
echo.
echo Make sure Java server is running on port 8080!
echo ===================================================
echo.
npm run dev

@echo off
REM Filawatch v5 Build Script for Windows

setlocal
set ROOT=%~dp0
echo ==^> Filawatch Build Script
echo ==^> Root: %ROOT%

echo.
echo ==^> Building frontend...
cd /d "%ROOT%frontend"
call npm ci
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1

echo.
echo ==^> Copying built frontend to backend/public...
if exist "%ROOT%backend\public" rmdir /s /q "%ROOT%backend\public"
mkdir "%ROOT%backend\public"
xcopy /e /i /y "%ROOT%frontend\dist\*" "%ROOT%backend\public\"

echo.
echo ==^> Installing backend production dependencies...
cd /d "%ROOT%backend"
call npm ci --omit=dev
if errorlevel 1 exit /b 1

echo.
echo ==^> Build complete!
echo ==^> Du kannst jetzt im backend\ Ordner 'npm start' ausfuehren
echo ==^> Das Backend liefert dann auch das Frontend automatisch aus.
endlocal

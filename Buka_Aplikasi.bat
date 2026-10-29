@echo off
title Mahligai Wedding Organizer Launcher
echo ===================================================
echo     MEMBUKA MAHLIGAI WEDDING ORGANIZER
echo ===================================================
echo.
cd /d "%~dp0"

:: Cek apakah port 8000 sudah berjalan
netstat -ano | findstr :8000 >nul
if %errorlevel% equ 0 (
    echo Server lokal sudah aktif di port 8000.
) else (
    echo Memulai server lokal Python...
    start /b python -m http.server 8000 >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo Membuka aplikasi di browser default Anda...
start http://localhost:8000/

echo.
echo Aplikasi berhasil dibuka di http://localhost:8000/
echo Anda dapat menutup jendela ini kapan saja.
echo.
timeout /t 4
exit

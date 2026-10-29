@echo off
title Mahligai Wedding Organizer - Akses Online HP (Beda Jaringan)
echo ===================================================================
echo     MAHLIGAI WEDDING ORGANIZER - AKSES ONLINE HP & INTERNET PUBLIK
echo ===================================================================
echo.
echo Mode ini memungkinkan Anda membuka dan menginstal aplikasi di:
echo  1. iPhone (Safari) maupun Android (Google Chrome)
echo  2. Dari jaringan mana saja (Paket Data 4G/5G, Wi-Fi lain, luar kota)
echo.
echo Sedang menyiapkan server lokal di port 8000...
echo.

cd /d "%~dp0"

:: Cek apakah port 8000 sudah berjalan
netstat -ano | findstr :8000 >nul
if %errorlevel% neq 0 (
    echo Memulai server lokal Python...
    start /b python -m http.server 8000 >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo [OK] Server lokal aktif di port 8000.
echo.
echo ===================================================================
echo PANDUAN PENTING:
echo 1. Tunggu beberapa detik sampai muncul URL "https://...lhrun.link" di bawah.
echo 2. Buka link HTTPS tersebut di browser HP Anda (Safari / Chrome).
echo 3. Di iPhone (Safari):
echo    - Ketuk tombol Share (kotak panah ke atas)
echo    - Pilih "Tambah ke Layar Utama" (Add to Home Screen)
echo 4. Di Android (Chrome):
echo    - Ketuk "Pasang aplikasi" atau tombol titik tiga -^> "Tambahkan ke Layar Utama"
echo.
echo CATATAN:
echo - Jangan tutup jendela ini selama Anda masih mengakses dari HP!
echo - Untuk hosting permanen 24 jam gratis tanpa perlu laptop menyala,
echo   lihat panduan "PANDUAN_ONLINE_HP.md".
echo ===================================================================
echo.
echo Menghubungkan jalur HTTPS aman...
echo.

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8000 localhost.run

if %errorlevel% neq 0 (
    echo.
    echo Mencoba koneksi alternatif via pinggy...
    ssh -o StrictHostKeyChecking=no -p 443 -R0:localhost:8000 qr@a.pinggy.io
)

pause

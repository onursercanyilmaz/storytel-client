@echo off
title storytel-client
echo ========================================================
echo   storytel-client - Masaustu Oynatici baslatiliyor...
echo   Adres: http://127.0.0.1:3000
echo ========================================================
start http://127.0.0.1:3000
npm run start
if errorlevel 1 (
  echo.
  echo [HATA] Uygulama baslatilamadi. Lutfen 'npm run build' yapildigindan emin olun.
  pause
)

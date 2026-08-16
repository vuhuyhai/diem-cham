@echo off
chcp 65001 >nul
title DIEM CHAM - quet tin
cd /d "%~dp0diem-cham-app"

where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE=node"
) else (
  set "NODE=C:\Program Files\nodejs\node.exe"
)

if "%ANTHROPIC_API_KEY%"=="" (
  echo.
  echo   Chua dat ANTHROPIC_API_KEY.
  echo   Tin van ve du, nhung se KHONG co ban dich tieng Viet va Goc nhin ung dung.
  echo.
  echo   Dat mot lan bang lenh nay trong Command Prompt roi mo lai cua so:
  echo       setx ANTHROPIC_API_KEY "khoa-cua-ban"
  echo.
  choice /c YN /m "Van chay tiep khong (Y/N)"
  if errorlevel 2 exit /b
)

echo.
echo   Dang quet tin. Mat khoang 8 den 10 phut vi Reddit chan toc do.
echo   Cu de day, dung tat cua so.
echo.
"%NODE%" thu-thap.js
echo.
echo   Xong. Mo MO-APP.bat de xem.
pause

@echo off
chcp 65001 >nul
title DIEM CHAM - dich bu ca kho
cd /d "%~dp0diem-cham-app"

where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE=node"
) else (
  set "NODE=C:\Program Files\nodejs\node.exe"
)

if "%ANTHROPIC_API_KEY%"=="" (
  echo.
  echo   Chua dat ANTHROPIC_API_KEY nen khong dich duoc.
  echo   Dat mot lan bang lenh nay trong Command Prompt roi mo lai cua so:
  echo       setx ANTHROPIC_API_KEY "khoa-cua-ban"
  echo.
  pause
  exit /b
)

rem CHI_DICH=1: bo qua buoc lay tin, chi dich tiep nhung bai chua co ban tieng Viet.
rem Dung cho lan dau, de dich het ca kho ma khong phai cho Reddit them 10 phut.
set CHI_DICH=1
set MAX_PHANTICH=300

echo.
echo   Dang dich ca kho sang tieng Viet. Khong lay tin moi.
echo   Mat vai phut tuy so bai con lai.
echo.
"%NODE%" thu-thap.js
echo.
echo   Xong. Mo MO-APP.bat de xem.
pause

@echo off
chcp 65001 >nul
title DIEM CHAM - mo app
cd /d "%~dp0diem-cham-app"

rem Tim node: uu tien node trong PATH, khong co thi lay duong dan cai mac dinh.
where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE=node"
) else (
  set "NODE=C:\Program Files\nodejs\node.exe"
)

if not exist "du-lieu\tin-tuc.json" (
  echo.
  echo   Chua co du lieu. Chay QUET-TIN.bat truoc de lay tin ve.
  echo.
  pause
  exit /b
)

start "" http://localhost:8765
"%NODE%" may-chu.js
pause

@echo off
title Kynto Studio
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
  echo.
  echo Der Start ist fehlgeschlagen. Fenster bleibt offen.
  pause
)

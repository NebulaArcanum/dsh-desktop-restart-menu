@echo off
setlocal
cd /d "%~dp0"
title DeepSeek Harness restart menu - install

where node >nul 2>nul
if errorlevel 1 (
	echo Node.js is required but was not found.
	echo Download and install it from https://nodejs.org/ then run this file again.
	echo.
	pause
	exit /b 1
)

echo Patching DeepSeek Harness...
echo.
node "%~dp0apply.js" %*
if errorlevel 1 (
	echo.
	echo Install failed. See the message above; nothing was written.
	echo.
	pause
	exit /b 1
)

echo.
echo Done. Fully quit DeepSeek Harness (right-click the tray icon - Quit) and
echo reopen it; the new Restart entries appear on the next launch.
echo.
pause

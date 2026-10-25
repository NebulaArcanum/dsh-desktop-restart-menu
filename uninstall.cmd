@echo off
setlocal
cd /d "%~dp0"
title DeepSeek Harness restart menu - uninstall

where node >nul 2>nul
if errorlevel 1 (
	echo Node.js is required but was not found.
	echo Download and install it from https://nodejs.org/ then run this file again.
	echo.
	pause
	exit /b 1
)

if not exist "%~dp0backup\main.orig.mjs" (
	echo Nothing to uninstall: no backup found in this folder.
	echo Run install.cmd first; the backup is created when the patch is applied.
	echo.
	pause
	exit /b 1
)

echo Restoring the original Electron shell...
echo.
node "%~dp0restore.js" %*
if errorlevel 1 (
	echo.
	echo Uninstall failed. See the message above.
	echo.
	pause
	exit /b 1
)

echo.
echo Done. Fully quit DeepSeek Harness and reopen it; the Restart entries
echo are gone on the next launch.
echo.
pause

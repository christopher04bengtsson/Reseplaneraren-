@echo off
cd /d "%~dp0"
if not exist out mkdir out
echo Checking... please wait 1-3 minutes.
echo === node === > out\check_log.txt
node -v >> out\check_log.txt 2>&1
echo === npm === >> out\check_log.txt
call npm -v >> out\check_log.txt 2>&1
echo === compositions === >> out\check_log.txt
call npx remotion compositions src/index.jsx --log=verbose >> out\check_log.txt 2>&1
echo === browser === >> out\check_log.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get_browser.ps1" >> out\check_log.txt 2>&1
echo === render 30 frames === >> out\check_log.txt
call npx remotion render src/index.jsx Story out\check.mp4 --frames=0-29 --gl=angle --concurrency=2 --log=verbose --browser-executable="%~dp0node_modules\.remotion\chrome-headless-shell\win64\chrome-headless-shell-win64\chrome-headless-shell.exe" >> out\check_log.txt 2>&1
echo Finished. Tell Claude "checked", or send Claude out\check_log.txt
pause

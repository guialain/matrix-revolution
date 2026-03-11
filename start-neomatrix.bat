@echo off
echo Starting NEO MATRIX...

start /B node server.js
start /B cloudflared.exe tunnel --config cloudflare-config.yml run neomatrix
start chrome https://neomatrix-trading.com

echo NEO MATRIX running. Close this window to stop.
pause

@echo off
echo Starting NEO MATRIX...

start cmd /k node server.js
start cmd /k cloudflared.exe tunnel --config cloudflare-config.yml run neomatrix
start chrome https://neomatrix-trading.com

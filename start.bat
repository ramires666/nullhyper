@echo off
title NullHyper TV - Pine Script v6 Backtester
cd /d "%~dp0"

echo ========================================================
echo   NullHyper TV: Local TradingView Pine Script Backtester
echo ========================================================
echo.
echo Starting local development server...
start http://localhost:5173/
npm run dev

pause

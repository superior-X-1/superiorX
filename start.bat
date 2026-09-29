@echo off
title Measure X Fullstack Launcher
echo ===================================================
echo   Starting Measure X (FastAPI + MySQL + Frontend)
echo ===================================================
echo.
echo [1/2] Starting Python FastAPI Backend (Port 8000)...
start "MeasureX Backend" cmd /k ".\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Frontend Web Server (Port 3000)...
start "MeasureX Frontend" cmd /k "node server.js"

echo.
echo Waiting 3 seconds for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo ===================================================
echo   Measure X is now LIVE locally!
echo   - Frontend: http://localhost:3000
echo   - Backend API: http://127.0.0.1:8000
echo   - API Swagger Docs: http://127.0.0.1:8000/docs
echo ===================================================
echo Close the backend and frontend command windows to stop.

# ── Script de démarrage unique des 4 Services ───────────────────────
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "🚀 Démarrage des 4 services de l'application..." -ForegroundColor Cyan

# 1. Service ML (Python FastAPI)
Write-Host "🤖 1/4 Lancement du Service ML Python (Port 8000)..." -ForegroundColor Magenta
Start-Process powershell -WorkingDirectory (Join-Path $projectRoot "MlService") -ArgumentList "-NoExit", "-Command", "python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

# 2. GeoService (Python FastAPI)
Write-Host "🌍 2/4 Lancement du GeoService Python (Port 8001)..." -ForegroundColor Blue
Start-Process powershell -WorkingDirectory (Join-Path $projectRoot "GeoService") -ArgumentList "-NoExit", "-Command", "python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"

# 3. Backend API Gateway (Node.js Express)
Write-Host "⚙️ 3/4 Lancement du Backend Express API (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory (Join-Path $projectRoot "Backend") -ArgumentList "-NoExit", "-Command", "npm run dev"

# 4. Frontend (React Vite)
Write-Host "🎨 4/4 Lancement du Frontend React (Port 5173)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory (Join-Path $projectRoot "Frontend") -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "" -ForegroundColor White
Write-Host "✅ Les 4 services sont en cours d'exécution !" -ForegroundColor Green
Write-Host "🎨 Frontend React  : http://localhost:5173" -ForegroundColor White
Write-Host "⚙️ Backend Express  : http://localhost:5000" -ForegroundColor White
Write-Host "🤖 Service ML Python: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "🌍 GeoService Python: http://127.0.0.1:8001" -ForegroundColor White


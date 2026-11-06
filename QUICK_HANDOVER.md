# FarmIntel Quick Handover Context

## What This Is
**FarmIntel** (also called TerraÂ·AI / AgroSense AI) - University final-year project combining AI agriculture features (disease detection, soil analysis, crop recommendation) with Google OAuth auth and MongoDB-backed farm management.

## Critical Path Info

**Repository:** `D:\Website-Projects\Agriculture-AI` on Windows
**Branch:** `main`
**Active Frontend:** `agriculture-ai-frontend/agriculture-ai-frontend/` (nested intentionally)

## Tech Stack Core
- Backend: FastAPI + PyTorch (MobileNetV2, EfficientNet-B0) + CatBoost + MongoDB + Google OAuth
- Frontend: React 19 + Vite + TanStack Router + Radix UI
- Auth: Google OAuth â†’ JWT session (5-60 min)
- Database: MongoDB Atlas (farmintel db)

## Git Worktree WARNING
- Outer `agriculture-ai-frontend/` files deleted from tracking (80+ files)
- **Nested** `agriculture-ai-frontend/agriculture-ai-frontend/` is **untracked** and contains active app
- 5 modified backend files, many untracked backend files
- Run `git status --short` before ANY changes

## What Works Now
âœ… Disease detection (38 classes)
âœ… Soil classification (4 types)
âœ… Crop recommendation (22 crops, has centroid fallback)
âœ… Weather + LLM advice
âœ… Google OAuth authentication
âœ… Farm/field management (CRUD, ownership isolation)
âœ… Analysis history (immutable snapshots)
âœ… 79 backend tests + 6 frontend tests (all mock-backed, deps need install)

## Known Issues
1. **Farm deletion race:** Field creation can race with cascade â†’ orphaned field if compensating delete fails (documented, needs distributed fix)
2. **Tests fail:** Missing deps (`pip install -r backend/requirements.txt` to fix)
3. **No live testing:** MongoDB, OAuth, browser E2E not verified
4. **Nested frontend:** Deployment configs may reference wrong path

## Config Files (Never Commit Secrets!)
- `backend/.env` - MongoDB URI, Google OAuth, JWT secret, model paths
- `agriculture-ai-frontend/agriculture-ai-frontend/.env` - API base URL (empty for dev)

## Quick Start
```powershell
# Backend
cd backend
pip install -r requirements.txt
# Configure backend/.env with your MongoDB URI and Google OAuth
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd agriculture-ai-frontend\agriculture-ai-frontend
npm install
npm run dev
# Opens http://localhost:5173
```

## Test Commands
```powershell
# Backend tests (after pip install)
cd backend
python -m unittest discover -s tests -p "test_*.py"

# Frontend tests
cd agriculture-ai-frontend\agriculture-ai-frontend
npm test

# TypeScript
npx tsc --noEmit
```

## Critical Files to Know
- `backend/main.py` - App entry, all routes
- `backend/middleware/auth.py` - OAuth + JWT
- `backend/farms.py` - Farm/field CRUD
- `backend/analysis_history.py` - Analysis persistence
- `agriculture-ai-frontend/agriculture-ai-frontend/src/lib/api.ts` - Frontend API client
- `agriculture-ai-frontend/agriculture-ai-frontend/vite.config.ts` - Dev proxy

## API Quick Ref
- Auth: `/api/v1/auth/google/start`, `/api/v1/auth/me`, `/api/v1/auth/logout`
- AI: `/api/v1/analyze/{disease|soil}`, `/api/v1/recommend/crop`, `/api/v1/advice`
- Farms: `/api/v1/farms`, `/api/v1/farms/{id}`, `/api/v1/farms/{id}/fields`
- History: `/api/v1/analyses`
- Health: `/api/v1/health`

## Model Details
- **Disease:** MobileNetV2, 38 PlantVillage classes, FP16â†’FP32
- **Soil:** EfficientNet-B0, 4 types (Alluvial, Black, Clay, Red)
- **Crop:** CatBoost primary, centroid fallback (response includes `model_source`)
- Models in: `backend/models/*.pth`, `backend/models/*.pkl`

## Security Implemented
- Owner-scoped DB queries (every query filters by user_id)
- Cross-owner returns 404 (not 403)
- HttpOnly/Secure cookies
- JWT signature verification
- Google ID token verification
- Analysis snapshots server-generated only
- Database errors sanitized

## Full Details
See `FARMINTEL_PROJECT_STATE_REPORT.md` (15 sections, 40+ pages)

## Before You Start
1. Read full state report
2. Check git status
3. Install backend deps
4. Configure backend/.env
5. Run tests
6. Check health endpoint

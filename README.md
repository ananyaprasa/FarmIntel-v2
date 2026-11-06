---
title: Agri AI
emoji: 🌿
colorFrom: green
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# Agriculture-AI

[![Live Demo](https://img.shields.io/badge/Live%20Demo-agri.akashg.me-brightgreen?style=for-the-badge&logo=vercel)](https://agri.akashg.me/)

Multi-model agricultural AI: disease detection, soil analysis, crop recommendation, and LLM-powered advice — with full multilingual support (English, Tamil, Hindi, Telugu).

---

## Project Structure

```
agri-ai/
├── backend/
│   ├── main.py                    # FastAPI app (all routes)
│   ├── requirements.txt
│   ├── .env.example               # Copy to .env and configure
│   ├── models/
│   │   ├── disease_model.py       # Disease CNN wrapper
│   │   ├── soil_model.py          # Soil CNN wrapper
│   │   └── crop_model.py          # CatBoost crop wrapper
│   ├── services/
│   │   ├── orchestrator.py        # Merges model outputs + confidence thresholds
│   │   ├── rag_service.py         # FAISS RAG over your .txt knowledge base
│   │   └── llm_service.py         # Anthropic Claude streaming advice
│   ├── middleware/
│   │   └── auth.py                # JWT auth (disable by leaving JWT_SECRET_KEY empty)
│   ├── utils/
│   │   ├── preprocessing.py       # Image validation + transforms
│   │   └── cache.py               # Redis cache with in-memory fallback
│   └── rag_docs/                  # Drop .txt files here for RAG knowledge base
└── agriculture-ai-frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── routes/                 # TanStack Router routes
        ├── styles.css              # Styling
        ├── lib/
        │   ├── api.ts              # FastAPI integration & data mapping
        │   ├── agri-store.ts       # Global state management
        │   └── i18n.ts             # Translations
        └── components/agri/
            ├── DiseaseTab.tsx
            ├── SoilTab.tsx
            ├── CropTab.tsx
            ├── AdviceTab.tsx
            ├── ImageDrop.tsx
            └── ConfidenceBar.tsx
```

---

## Setup

### 1. Copy your trained models

```bash
# Paths are configured in backend/.env
# Default expects your models relative to backend/
ls ../dataset/agri_ai_dataset/models/
# crop_model.pkl  disease_model_fp16.pth  label_enoder_crop.pkl  soil_model.pth
```

### 2. Backend (Python virtual environment)

```bash
# From the project root, activate the existing project-root virtual environment (Windows)
npm run venv:activate

# In the activated Command Prompt, install backend dependencies
python -m pip install -r backend\requirements.txt

# Configure backend/.env:
#   - Set model paths
#   - Add your OPENAI_API_KEY / LLM keys
#   - Optionally set REDIS_URL, JWT_SECRET_KEY
#   - Set MONGODB_URI to your private Atlas connection string
#   - Set MONGODB_DATABASE=farmintel

# Start server
npm start

# API docs available at:
# http://localhost:8000/docs
# MongoDB-aware health check:
curl http://localhost:8000/api/v1/health

# When finished, type exit to close the activated Command Prompt
```

### 3. Add RAG knowledge (optional but recommended)

```bash
mkdir -p backend/rag_docs

# Add any .txt files with agricultural knowledge:
# - crop disease treatment guides
# - soil management practices
# - regional crop calendars
# The RAG service auto-indexes them on first query.

# Example:
echo "Late blight in tomatoes is caused by Phytophthora infestans.
Apply metalaxyl + mancozeb fungicide at first sign of infection.
Destroy infected plant material immediately." > backend/rag_docs/tomato_diseases.txt
```

### 4. Frontend

```bash
cd agriculture-ai-frontend

npm install
npm run dev

# Opens at http://localhost:5173
# API calls proxy to http://localhost:8000 via vite.config.ts / VITE_API_BASE_URL
```

---

## Model configuration

Edit `backend/.env` to match your exact setup:

| Variable             | Default                                           | Description                        |
|----------------------|---------------------------------------------------|------------------------------------|
| `DISEASE_MODEL_PATH` | `../dataset/agri_ai_dataset/models/disease_model_fp16.pth` | Your disease CNN |
| `SOIL_MODEL_PATH`    | `../dataset/agri_ai_dataset/models/soil_model.pth`         | Your soil CNN    |
| `CROP_MODEL_PATH`    | `../dataset/agri_ai_dataset/models/crop_model.pkl`         | Your CatBoost    |
| `LABEL_ENCODER_PATH` | `../dataset/agri_ai_dataset/models/label_enoder_crop.pkl`  | Label encoder    |
| `DISEASE_NUM_CLASSES`| `38`                                              | CNN output classes                 |
| `SOIL_NUM_CLASSES`   | `4`                                               | CNN output classes                 |

**If your model architecture differs from ResNet-50 (disease) / ResNet-18 (soil)**, edit the `_build_resnet50` / `_build_resnet18` functions in the respective model files to match your architecture exactly.

---

## API Endpoints

| Method | Endpoint                  | Description                               |
|--------|---------------------------|-------------------------------------------|
| GET    | `/api/v1/health`          | Check all model + service status          |
| POST   | `/api/v1/analyze/disease` | Upload plant leaf image → disease result  |
| POST   | `/api/v1/analyze/soil`    | Upload soil image → soil classification   |
| POST   | `/api/v1/analyze/full`    | Upload both images together               |
| POST   | `/api/v1/recommend/crop`  | Send N/P/K + climate → crop recommendation|
| GET    | `/api/v1/weather`         | Get a location/date forecast and profile comparisons |
| POST   | `/api/v1/advice`          | Get streaming LLM advice from all results |
| GET    | `/api/v1/auth/google/start` | Start Google OAuth sign-in                |
| POST   | `/api/v1/auth/google/callback` | Complete Google sign-in callback         |
| GET    | `/api/v1/auth/me`         | Get the current signed-in user            |
| POST   | `/api/v1/auth/logout`     | Clear the FarmIntel session               |

### Crop recommendation data and scores

`POST /api/v1/recommend/crop` accepts `N`, `P`, `K`, `temperature`, `humidity`,
`ph`, `rainfall`, and the optional UI `language` value. The API currently
validates inputs against these ranges: N 0–140, P 0–145, K 0–205, temperature
8–45 °C, humidity 14–100%, pH 3.5–10, and rainfall 20–300 mm.

The checked-in training CSV provides numeric N/P/K and rainfall values but does
not identify their units or the rainfall time period. Do not convert these
values or substitute current/daily weather for rainfall. Use soil-test results
and rainfall measurements only when they are on a comparable scale; the app's
weather view does not populate crop inputs.

When available, the CatBoost model returns class scores. If its artifacts
cannot be loaded, the existing fallback ranks stored crop centroids using
feature differences divided by the existing standard-deviation values. The
fallback's displayed percentages are shares of the similarity scores across
the stored profiles, not calibrated probabilities. Neither score is a
probability of crop success or yield. Responses retain the existing
`recommended_crop`, `tip`, `recommendations`, and `input_warnings` fields and
add `model_source` and `score_kind` to identify the method and score meaning.
Per-factor agronomic ranges and explanations are not present in the crop data;
recommendations are general model output, not a yield guarantee.

## MongoDB Atlas connectivity

The backend uses PyMongo's asynchronous client and reads `MONGODB_URI` and
`MONGODB_DATABASE` from `backend/.env`. Set `MONGODB_DATABASE=farmintel` and
paste the private connection string copied from Atlas into `MONGODB_URI`.
Keep the URI only in the ignored backend `.env` file; URL-encode reserved
characters in the database username or password. The repository's
`env.example` intentionally leaves the URI blank.

On startup, the backend attempts a read-only `ping`. `/api/v1/health` repeats
that ping and reports `application_status` independently from
`mongodb.status` (`connected`, `disconnected`, or `not_configured`). A failed
database connection does not create an in-memory substitute or disable the
existing non-database features. No database writes are used for health checks.

## Google sign-in configuration

The backend starts Google OAuth at `GET /api/v1/auth/google/start` and receives
the authorization-code `form_post` at
`POST /api/v1/auth/google/callback`. Register the exact callback URL with the
Google OAuth client. The backend verifies the Google ID token, then upserts a
minimal user record by the unique Google `sub` identity.

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`, `FRONTEND_ORIGIN`, `JWT_SECRET_KEY`,
`JWT_ALGORITHM=HS256`, `JWT_EXPIRE_MINUTES` (5–60), and an exact
`CORS_ORIGINS` entry matching `FRONTEND_ORIGIN`. Use HTTPS origins except for
localhost development. Generate a signing secret with at least 32 bytes of
randomness; keep it and the Google client secret in the ignored backend
`.env`, never in frontend build variables. Authentication fails closed when
these settings are missing or invalid.

The callback sets a short-lived HttpOnly, Secure, SameSite=None FarmIntel
session cookie; it does not return Google tokens to the browser. `GET
/api/v1/auth/me` resolves the session to the MongoDB user and
`POST /api/v1/auth/logout` clears it after checking the request Origin. The
frontend should navigate to the sign-in start URL and use
`credentials: "include"` for `/api/v1/auth/me` and `/api/v1/auth/logout`.
Existing prediction, weather, and advice routes remain anonymous.

Run the offline/mock-backed test suite from the repository root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py"
```

For an optional real Atlas connectivity smoke test, start the backend with the
private values in `backend/.env`, then call:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health | ConvertTo-Json -Depth 5
```

This performs only a MongoDB `ping`; it inserts no records. Atlas must still
allow the development machine's public IP address in Network Access, and the
connection string's database user must have access to the configured database.

The weather endpoint preserves its selected-day Open-Meteo forecast fields and
adds `crop_recommendations`. This weather-only comparison uses the forecast's
hourly mean temperature and humidity against the temperature and humidity
values in the stored crop centroids. The centroid derivation is undocumented;
the returned 0–100 similarity score is not a crop suitability rating or a
probability of success. The page excludes daily precipitation because the
crop dataset does not specify the rainfall period, and it never fills the
soil-based model's N/P/K, pH, or rainfall inputs. Use Crop Suggestion
separately with measured soil values for its full model workflow.

---

## Customization

### Add crop disease labels
Edit `DISEASE_CLASSES` list and `TREATMENTS` dict in `backend/models/disease_model.py`.

### Add soil types
Edit `SOIL_CLASSES` and `SOIL_PROPERTIES` in `backend/models/soil_model.py`.

### Add a language
1. Add entry to `LANGUAGES` array in `frontend/src/i18n/translations.js`
2. Add full translation object under your new language code
3. Add to `lang` validation regex in `backend/main.py` (`pattern="^(en|ta|hi|te|xx)$"`)

### Change LLM behavior
Edit `SYSTEM_PROMPT` in `backend/services/llm_service.py`.

### Adjust confidence thresholds
Edit `DISEASE_THRESHOLD`, `SOIL_THRESHOLD`, `CROP_MIN_PROB` in `backend/services/orchestrator.py`.

---

## Production deployment

```bash
# Backend — use gunicorn + uvicorn workers
pip install gunicorn
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend — build static files
cd frontend && npm run build
# Serve dist/ with nginx or any static host

# Redis — strongly recommended in production
docker run -d -p 6379:6379 redis:alpine
# Set REDIS_URL=redis://localhost:6379 in .env

# Set a real JWT_SECRET_KEY
export JWT_SECRET_KEY=$(openssl rand -hex 32)
```

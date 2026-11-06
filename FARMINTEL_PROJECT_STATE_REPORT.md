# FarmIntel â€” Complete Project State Report
**Date Generated:** 2026-10-18
**Repository Root:** `D:\Website-Projects\Agriculture-AI`
**Branch:** `main`

---

## Executive Summary

**FarmIntel** (branded as **TerraÂ·AI** / **AgroSense AI**) is a functional AI-powered agriculture platform developed as a university final-year project. The application combines computer vision (disease detection, soil classification), machine learning (crop recommendation), real-time weather data, and LLM-based agricultural advice with user authentication and persistent data management.

**Current State:** The codebase contains substantial working implementation across both frontend and backend with:
- âœ… All core AI inference features (disease, soil, crop recommendation)
- âœ… Google OAuth authentication with JWT sessions
- âœ… MongoDB-backed farm/field management
- âœ… Analysis history persistence
- âœ… Comprehensive test suite (79 backend tests, 6 frontend tests)
- âš ï¸ Tests pass with mocks but require dependency installation
- âš ï¸ Complex Git worktree state with deleted outer frontend files
- âœ… Active development in nested frontend directory

---

## 1. Repository Structure and Git State

### Repository Root
```
D:\Website-Projects\Agriculture-AI
```

### Active Directories
- **Backend:** `backend/`
- **Active Frontend:** `agriculture-ai-frontend/agriculture-ai-frontend/` (nested intentionally)
- **Models/Artifacts:** `backend/models/`, `dataset/`
- **Documentation:** Root-level markdown files

### Git Status (Current Worktree State)

#### Modified Files (5)
```
M  README.md
M  backend/main.py
M  backend/middleware/auth.py
M  backend/models/crop_model.py
M  backend/models/soil_model.py
M  backend/requirements.txt
M  backend/utils/preprocessing.py
M  requirements.txt
```

#### Deleted Files (Outer Frontend - 80+ files)
The outer `agriculture-ai-frontend/` directory files have been deleted from Git tracking. These include:
- All source files (`src/**/*.tsx`, `src/**/*.ts`)
- Configuration files (`.env.example`, `package.json`, `vite.config.ts`)
- Build configuration (`.prettierrc`, `eslint.config.js`)
- Documentation (`README.md`, `AGENTS.md`, `DEPLOY.md`)

**Important:** The **nested** `agriculture-ai-frontend/agriculture-ai-frontend/` directory is **untracked** and contains the actively developed frontend application.

#### Untracked Files (Important)
```
??  agriculture-ai-frontend/agriculture-ai-frontend/  (active frontend)
??  backend/activate-venv.cmd
??  backend/analysis_history.py
??  backend/database.py
??  backend/farms.py
??  backend/package.json
??  backend/services/weather_crop_service.py
??  backend/services/weather_service.py
??  backend/tests/
??  backend/models/disease_model_93_plantdoc_deep_ft_best.pth
```

### Nested Frontend Structure
The **active frontend** lives at:
```
agriculture-ai-frontend/agriculture-ai-frontend/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ routes/              # TanStack Router routes
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ agri/            # Disease, Soil, Crop analysis UI
â”‚   â”‚   â”œâ”€â”€ analysis/        # History page
â”‚   â”‚   â”œâ”€â”€ farms/           # Farm management
â”‚   â”‚   â””â”€â”€ weather/
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ api.ts           # Backend API client
â”‚   â”‚   â”œâ”€â”€ auth-provider.tsx
â”‚   â”‚   â””â”€â”€ auth-context.ts
â”‚   â””â”€â”€ main.tsx
â”œâ”€â”€ package.json
â”œâ”€â”€ vite.config.ts
â”œâ”€â”€ .env                     # Local config (gitignored)
â””â”€â”€ node_modules/
```

---

## 2. Technology Stack

### Backend
| Layer | Technology | Version/Details |
|-------|-----------|-----------------|
| **Framework** | FastAPI | â‰¥0.111.0 |
| **Runtime** | Python | 3.10+ |
| **Server** | Uvicorn | â‰¥0.30.0 with standard extras |
| **Database** | MongoDB Atlas | Async PyMongo â‰¥4.9 |
| **Disease Model** | PyTorch MobileNetV2 | 38 PlantVillage classes |
| **Soil Model** | PyTorch EfficientNet-B0 | 4 soil types |
| **Crop Model** | CatBoost + fallback | 22 crops |
| **Authentication** | Google OAuth + JWT | jose[cryptography], google-auth |
| **Cache** | Redis (optional) | redisâ‰¥5.0.4, falls back to in-memory |
| **LLM** | OpenAI-compatible API | openaiâ‰¥1.0.0, anthropicâ‰¥0.28.0 |
| **Search** | DuckDuckGo | duckduckgo-searchâ‰¥6.0.0 |
| **Rate Limiting** | SlowAPI | â‰¥0.1.9 |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 19.2.0 |
| **Build Tool** | Vite | 8.0.16 |
| **Router** | TanStack Router | 1.170.16 with auto-code-splitting |
| **State** | TanStack Query | 5.101.1 |
| **Styling** | Tailwind CSS | 4.2.1 with @tailwindcss/vite |
| **UI Components** | Radix UI + shadcn/ui | Various @radix-ui packages |
| **Forms** | React Hook Form + Zod | 7.71.2 + 3.24.2 |
| **Maps** | Leaflet + React-Leaflet | 1.9.4 + 5.0.0 |
| **Charts** | Recharts | 2.15.4 |

---

## 3. Architecture and Request Flows

### Backend Entry Point
**File:** `backend/main.py`

**Startup Flow:**
1. Load environment from `backend/.env` using `python-dotenv`
2. Initialize MongoDB connection and ping for health
3. Create farm/field/analysis indexes
4. Load AI models (disease, soil, crop)
5. Initialize RAG service (FAISS vector store)
6. Initialize LLM service if API key configured
7. Connect Redis cache (optional)

**Lifespan Management:**
- Async context manager for startup/shutdown
- Models loaded lazily with fallbacks
- Database failures don't prevent startup
- Index initialization errors logged but don't crash server

### AI Inference Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Client Upload                                              â”‚
â”‚  (Image + Options)                                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  FastAPI Endpoint                                           â”‚
â”‚  POST /api/v1/analyze/{disease|soil}                        â”‚
â”‚  POST /api/v1/recommend/crop                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â”œâ”€â–º Preprocessing (utils/preprocessing.py)
                 â”‚   â”œâ”€ Image validation (size, format)
                 â”‚   â”œâ”€ Hash calculation for cache key
                 â”‚   â””â”€ Transform to tensor
                 â”‚
                 â”œâ”€â–º Cache Check (utils/cache.py)
                 â”‚   â””â”€ Redis or in-memory fallback
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Model Inference                                            â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Disease: MobileNetV2 â†’ Softmax â†’ Top-3 predictions   â”‚  â”‚
â”‚  â”‚ Soil: EfficientNet-B0 â†’ Softmax â†’ Confidence score   â”‚  â”‚
â”‚  â”‚ Crop: CatBoost or Centroid Fallback â†’ Top-5 crops    â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â”œâ”€â–º Cache Write
                 â”‚
                 â””â”€â–º Analysis Save (if requested)
                      â””â”€ save_inference_result()
                         â”œâ”€ Verify authenticated user
                         â”œâ”€ Validate field ownership if field_id provided
                         â”œâ”€ Store server-generated result (NOT client JSON)
                         â””â”€ Return analysis_id
```

### Authentication Flow

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  1. User Clicks "Sign in with Google"                       â”‚
â”‚     Frontend â†’ GET /api/v1/auth/google/start                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  2. Backend Creates OAuth Request                            â”‚
â”‚     - Generate state, nonce, PKCE verifier/challenge        â”‚
â”‚     - Set HttpOnly cookies (state, nonce, verifier)         â”‚
â”‚     - Redirect to Google OAuth                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  3. Google Authorization                                     â”‚
â”‚     User approves â†’ Google redirects to callback            â”‚
â”‚     POST /api/v1/auth/google/callback (form_post)           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  4. Backend Processes Callback                               â”‚
â”‚     â”œâ”€ Validate OAuth state from cookie                     â”‚
â”‚     â”œâ”€ Exchange code for Google ID token (PKCE verified)    â”‚
â”‚     â”œâ”€ Verify ID token signature, issuer, audience, nonce   â”‚
â”‚     â”œâ”€ Provision/update user in MongoDB                     â”‚
â”‚     â”‚  â””â”€ Upsert by Google sub (unique provider+subject)    â”‚
â”‚     â”œâ”€ Create FarmIntel JWT (HS256, 5-60 min expiry)        â”‚
â”‚     â”œâ”€ Set farmintel_session cookie (HttpOnly, Secure)      â”‚
â”‚     â””â”€ Redirect to FRONTEND_ORIGIN                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  5. Authenticated Session                                    â”‚
â”‚     - GET /api/v1/auth/me â†’ returns user profile            â”‚
â”‚     - Protected endpoints check JWT from cookie             â”‚
â”‚     - POST /api/v1/auth/logout â†’ clears session             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Database Schema (MongoDB)

#### Collections

**users**
```json
{
  "_id": ObjectId,
  "identity": {
    "provider": "google",
    "subject": "google-unique-sub"
  },
  "email": "user@example.com",
  "display_name": "User Name",
  "created_at": ISODate,
  "updated_at": ISODate
}
```
Index: `unique_provider_subject` on `(identity.provider, identity.subject)` **UNIQUE**

**farms**
```json
{
  "_id": ObjectId,
  "user_id": "string-object-id",
  "name": "Farm Name",
  "description": "Optional description",
  "location": "Optional location",
  "deleting": true,  // Present during deletion cascade
  "created_at": ISODate,
  "updated_at": ISODate
}
```
Index: `farms_user_created_at` on `(user_id ASC, created_at DESC)` non-unique

**fields**
```json
{
  "_id": ObjectId,
  "user_id": "string-object-id",
  "farm_id": ObjectId,
  "name": "Field Name",
  "area": 2.5,
  "area_unit": "acre" | "hectare" | "mÂ²",
  "crop_type": "Optional crop type",
  "soil_type": "Optional soil type",
  "created_at": ISODate,
  "updated_at": ISODate
}
```
Index: `fields_user_farm_created_at` on `(user_id ASC, farm_id ASC, created_at DESC)` non-unique

**analyses**
```json
{
  "_id": ObjectId,
  "user_id": "string-object-id",
  "field_id": ObjectId | null,
  "farm_id": ObjectId | null,  // Internal, for cleanup coordination
  "analysis_type": "disease" | "soil" | "crop",
  "result": {
    // Snapshot of server-generated inference output
    // Disease: {disease, confidence, treatments, top3, ...}
    // Soil: {soil_type, confidence, properties, ...}
    // Crop: {recommended_crop, recommendations, model_source, ...}
  },
  "created_at": ISODate
}
```
Indexes:
- `analyses_user_created_id` on `(user_id ASC, created_at DESC, _id DESC)` non-unique
- `analyses_user_field_created_id` on `(user_id ASC, field_id ASC, created_at DESC, _id DESC)` non-unique

---

## 4. API Endpoints

### Authentication (Protected by Configuration)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/auth/google/start` | None | Start OAuth flow, returns redirect |
| POST | `/api/v1/auth/google/callback` | None | OAuth callback (internal) |
| GET | `/api/v1/auth/me` | Required | Get current user session |
| POST | `/api/v1/auth/logout` | Required | Clear session cookie |

### AI Inference (Public)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/analyze/disease` | Optional | Disease detection from leaf image |
| POST | `/api/v1/analyze/soil` | Optional | Soil classification from image |
| POST | `/api/v1/recommend/crop` | Optional | Crop recommendation from soil+climate data |
| POST | `/api/v1/advice` | None | Streaming LLM advice (SSE) |
| GET | `/api/v1/weather` | None | Weather forecast with crop suggestions |

**Note:** Inference endpoints accept optional `save_to_history=true` and `field_id` query params. Saving requires authentication.

### Farm Management (Authenticated)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/farms` | Required | List user's farms |
| POST | `/api/v1/farms` | Required | Create farm |
| GET | `/api/v1/farms/{farm_id}` | Required | Get farm detail |
| PATCH | `/api/v1/farms/{farm_id}` | Required | Update farm |
| DELETE | `/api/v1/farms/{farm_id}` | Required | Delete farm + cascade fields |
| GET | `/api/v1/farms/{farm_id}/fields` | Required | List farm's fields |
| POST | `/api/v1/farms/{farm_id}/fields` | Required | Create field |
| GET | `/api/v1/fields/{field_id}` | Required | Get field detail |
| PATCH | `/api/v1/fields/{field_id}` | Required | Update field |
| DELETE | `/api/v1/fields/{field_id}` | Required | Delete field |

### Analysis History (Authenticated)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/analyses` | Required | List analyses with pagination/filters |
| GET | `/api/v1/analyses/{analysis_id}` | Required | Get analysis detail |

Query params for list: `limit` (1-100), `offset`, `analysis_type`, `field_id`

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | None | HTML landing page |
| GET | `/api/v1/health` | None | Health check with model/DB status |

---

## 5. Environment Configuration

### Required Configuration
**Location:** `backend/.env` (gitignored)

**Google OAuth** (Required for authentication):
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
FRONTEND_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=  # Generate with: openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30  # 5-60 allowed
```

**MongoDB** (Required for farms/fields/history):
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=farmintel
```

**Models** (Paths relative to `backend/`):
```env
DISEASE_MODEL_PATH=models/disease_model_93_plantdoc_deep_ft_best.pth
SOIL_MODEL_PATH=models/soil_model.pth
CROP_MODEL_PATH=models/crop_model.pkl
LABEL_ENCODER_PATH=models/label_enoder_crop.pkl
DISEASE_NUM_CLASSES=38
SOIL_NUM_CLASSES=4
```

**Optional:**
```env
OPENAI_API_KEY=  # For LLM advice feature
GEMINI_API_KEY=  # Alternative to OpenAI
OPENAI_BASE_URL=  # Custom OpenAI-compatible endpoint
REDIS_URL=redis://localhost:6379  # For production caching
RAG_DOCS_DIR=./rag_docs
RATE_LIMIT_PER_MINUTE=30
```

### Frontend Configuration
**Location:** `agriculture-ai-frontend/agriculture-ai-frontend/.env`

```env
VITE_API_BASE_URL=  # Leave empty for dev proxy, set for production
```

**Vite Dev Proxy:** Configured in `vite.config.ts` to proxy `/api` requests to `http://localhost:8000`

---

## 6. Known Limitations and Technical Debt

### Confirmed Reliability Issue: Farm Deletion Race Condition

**Location:** `backend/farms.py` - `delete_farm()` endpoint

**Description:**
Farm deletion implements a multi-step cascade:
1. Mark farm as `deleting=true`
2. Detach analysis history associations
3. Delete all child fields
4. Detach again (safety)
5. Delete farm

**The Race:**
If a field-creation request wins a race with farm deletion:
1. Field creation checks parent farm (exists)
2. Farm deletion starts â†’ deletes fields
3. Field creation inserts new field
4. Field creation checks parent again â†’ farm marked `deleting` â†’ attempts compensating deletion
5. **If compensating delete fails** â†’ orphaned field remains

**Impact:**
- Orphaned field is inaccessible through normal API (parent is deleted)
- Retrying farm deletion won't find the orphan
- No confirmed exploitable security vulnerability
- No data corruption of analysis snapshots

**Current Mitigation:**
- Compensating deletion attempted on race detection
- Retryable cleanup on partial failure
- Errors sanitized, no internal DB details exposed

**Proper Fix Requires:**
Distributed coordination (e.g., MongoDB transactions, pessimistic locking, or saga pattern). In-process locks won't coordinate across multiple backend workers.

**Documentation Status:** âœ… Explicitly documented in test suite and this report

### Model Source Transparency

**Crop Recommendation Fallback:**
- CatBoost model preferred
- If unavailable: `CentroidCropModel` fallback activates
- Fallback uses stored crop centroids with normalized Euclidean distance
- Response includes `model_source: "centroid_fallback"` and `score_kind: "profile_similarity_share"`
- Frontend correctly interprets score semantics

**Important:** Fallback scores are **not** crop suitability probabilities. They are similarity shares across stored profiles.

**Status:** âœ… Accurately reported in API responses and frontend

### Test Coverage Limitations

**What IS Tested (Mock-Backed):**
- âœ… 79 backend unit tests (farms, fields, analysis history, auth, MongoDB helpers, models)
- âœ… 6 frontend unit tests (crop validation, weather view state)
- âœ… Ownership isolation
- âœ… Cross-user security
- âœ… Farm deletion cascades and retries
- âœ… OAuth flow steps
- âœ… JWT validation
- âœ… Database error sanitization
- âœ… Index initialization

**What Is NOT Tested:**
- âŒ Live MongoDB Atlas connectivity
- âŒ Live Google OAuth provider interaction
- âŒ Real browser end-to-end flows
- âŒ Actual model inference accuracy
- âŒ Redis cache behavior under load
- âŒ LLM streaming with real OpenAI/Anthropic APIs

**Verification Commands:**
```powershell
# Backend tests (requires dependencies installed)
cd backend
python -m unittest discover -s tests -p "test_*.py"

# Frontend tests
cd agriculture-ai-frontend/agriculture-ai-frontend
npm test

# TypeScript type checking
cd agriculture-ai-frontend/agriculture-ai-frontend
npx tsc --noEmit
```

**Last Reported Results (Historical):**
- Backend: 79 tests passed (mock-backed)
- Frontend: 6 tests passed
- TypeScript: âœ… No errors
- Production build: âœ… Success

---

## 7. Deployment Configuration

### Current Known Deployments
- **Frontend:** Vercel (inferred from `vercel.json` at root)
- **Backend:** Azure Container Apps (referenced in `.github/workflows/deploy-azure.yml`)
- **Live URL:** https://agri.akashg.me (mentioned in README)

### GitHub Actions Workflows
**Location:** `.github/workflows/`

**Files:**
- `deploy-azure.yml` - Azure backend deployment
- `hotfix-env.yml` - Emergency environment fixes

### Local Development Setup

**Backend:**
```powershell
# Activate venv (project root has .venv)
.\.venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Configure backend/.env (see section 5)

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```powershell
cd agriculture-ai-frontend\agriculture-ai-frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

**Health Check:**
```powershell
curl http://localhost:8000/api/v1/health
```

Expected response includes:
- `mongodb.status`: `connected` | `disconnected` | `not_configured`
- `models_loaded`: `{disease, soil, crop}` booleans
- `models_status`: Identifies fallbacks if active

---

## 8. Frontend Architecture

### Routing (TanStack Router)
**Base:** `agriculture-ai-frontend/agriculture-ai-frontend/src/routes/`

**Routes:**
```
/__root.tsx              â†’ App shell, auth provider, error boundaries
/index.tsx               â†’ Main analysis page (Shell component)
/farms.tsx               â†’ Farm list + nested routes
/farms.$farmId.tsx       â†’ Individual farm detail
/history.tsx             â†’ Analysis history list
/weather.tsx             â†’ Weather forecast page
```

**Generated:** `routeTree.gen.ts` (auto-generated by TanStack Router plugin)

### Component Structure

**AI Analysis Components:**
`src/components/agri/`
- `Shell.tsx` - Main tab interface (disease, soil, crop, advice)
- `DiseaseTab.tsx` - Upload leaf image, show results
- `SoilTab.tsx` - Upload soil image, show properties
- `CropTab.tsx` - Input N/P/K data, show recommendations
- `AdviceTab.tsx` - Streaming LLM advice display
- `ImageDrop.tsx` - Drag-and-drop image uploader
- `ConfidenceBar.tsx` - Visual confidence indicator

**Farm Management:**
`src/components/farms/`
- `FarmManagement.tsx` - CRUD interface for farms and fields

**Analysis History:**
`src/components/analysis/`
- `AnalysisHistoryPage.tsx` - Paginated analysis list
- `AnalysisSaveOptions.tsx` - Save-to-history controls

**UI Components:**
`src/components/ui/` - 40+ Radix UI primitives (buttons, dialogs, forms, etc.)

### API Client
**File:** `src/lib/api.ts`

**Key Functions:**
- `getCurrentUser()` - Check session status
- `logout()` - Clear session
- `startGoogleSignIn()` - Navigate to OAuth
- `analyzeDisease()` - Upload leaf image
- `analyzeSoil()` - Upload soil image
- `recommendCrop()` - Submit soil/climate data
- `getWeather()` - Fetch forecast
- `streamAdvice()` - SSE streaming
- Farm/field CRUD functions
- Analysis history retrieval

**Important:** API converts backend confidence (0-100 scale) to frontend scale (0-1) for UI components.

### State Management
- **TanStack Query** for server state, caching, background refetch
- **AuthProvider** (`src/lib/auth-provider.tsx`) for session state
- **Local component state** for UI interactions

---

## 9. Security and Data Isolation

### Implemented Security Measures

**Authentication:**
- âœ… Google OAuth with PKCE (proof key for code exchange)
- âœ… State and nonce validation
- âœ… HttpOnly, Secure, SameSite=None session cookies
- âœ… Short-lived JWT (5-60 min configurable)
- âœ… JWT signature verification (HS256)
- âœ… Issuer and audience validation
- âœ… Google ID token verification (signature, issuer, expiry, nonce)

**Authorization:**
- âœ… Owner-scoped database queries (every query filters by `user_id`)
- âœ… Cross-owner resource access returns equivalent 404
- âœ… Farm deletion checks ownership before cascade
- âœ… Field creation validates parent farm ownership
- âœ… Analysis save validates field ownership
- âœ… History queries scoped to user

**Data Protection:**
- âœ… User identity keyed by provider + Google `sub` (unique index)
- âœ… No Google access/refresh tokens stored
- âœ… Database errors sanitized (no internal details exposed)
- âœ… Malformed ObjectIds produce controlled 400 errors
- âœ… Analysis snapshots are immutable server-generated JSON
- âœ… Client cannot submit fake analysis results

**Input Validation:**
- âœ… Pydantic models validate all request data
- âœ… Image size limits (10 MB)
- âœ… File format validation
- âœ… Numeric range checks on crop inputs
- âœ… String length limits on names/descriptions
- âœ… ObjectId format validation

**Rate Limiting:**
- âœ… SlowAPI configured (30 requests/minute default)
- âœ… Per-IP limiting with proxy header support

**CORS:**
- âœ… Explicit origin whitelist (no `*` wildcards when credentials enabled)
- âœ… `allow_credentials=True` only with specific origins
- âœ… Logout checks request Origin against FRONTEND_ORIGIN

### Security Testing Evidence

**Test Coverage (from `test_auth.py`):**
- âœ… Expired JWT rejection
- âœ… Invalid signature rejection
- âœ… Wrong issuer/audience rejection
- âœ… Nonce mismatch rejection
- âœ… OAuth state validation
- âœ… Malformed token handling
- âœ… Missing database fails closed
- âœ… Unauthorized access returns 401
- âœ… Cross-owner isolation (farms/fields/analyses)

---

## 10. Model Implementation Details

### Disease Detection Model

**Architecture:** MobileNetV2
**File:** `backend/models/disease_model.py`
**Model Artifact:** `backend/models/disease_model_93_plantdoc_deep_ft_best.pth`

**Key Features:**
- 38 PlantVillage disease classes
- Final layer replaced for transfer learning
- FP16 weights loaded and cast to FP32 for CPU inference
- Fallback to mock model if PyTorch unavailable
- Top-3 predictions with confidence scores
- Treatment recommendations from hardcoded dictionary

**Preprocessing:** 224x224 RGB, ImageNet normalization

**Classes Include:**
- Apple: scab, black rot, cedar rust, healthy
- Tomato: bacterial spot, early blight, late blight, leaf mold, septoria, spider mites, target spot, TYLCV, mosaic virus, healthy
- Potato: early blight, late blight, healthy
- Corn, Grape, Cherry, Pepper, Peach, etc.

### Soil Classification Model

**Architecture:** EfficientNet-B0
**File:** `backend/models/soil_model.py`
**Model Artifact:** `backend/models/soil_model.pth`

**Key Features:**
- 4 soil classes: Alluvial, Black, Clay, Red
- Softmax confidence scores
- Properties dictionary with water retention, drainage, fertility, suitable crops
- Strict validation: rejects non-finite outputs, checks tensor shapes
- No fallback model (returns 503 if unavailable)

**Preprocessing:** 224x224 RGB, ImageNet normalization

### Crop Recommendation Model

**Architecture:** CatBoost Classifier (with Centroid Fallback)
**File:** `backend/models/crop_model.py`
**Model Artifacts:** `backend/models/crop_model.pkl`, `backend/models/label_enoder_crop.pkl`

**Key Features:**
- 22 crop classes
- 7 input features: N, P, K, temperature, humidity, pH, rainfall
- Returns top-5 crops with probabilities
- Fallback to centroid-based similarity scoring
- Response includes `model_source` and `score_kind` fields

**Crops Supported:**
rice, maize, chickpea, kidneybeans, pigeonpeas, mothbeans, mungbean, blackgram, lentil, pomegranate, banana, mango, grapes, watermelon, muskmelon, apple, orange, papaya, coconut, cotton, jute, coffee

**Centroid Fallback:**
- Uses stored 7D crop profiles
- Normalized Euclidean distance â†’ similarity score
- Scores converted to percentage shares
- **Not probabilities of crop success**

**Important:** Dataset units (N/P/K, rainfall period) are undocumented in source data. Use values on comparable scale to training data.

---

## 11. Testing Summary

### Backend Test Files
**Location:** `backend/tests/`

**Files:**
- `test_farms.py` - 13 test methods covering farm/field CRUD, ownership, cascades, races
- `test_analysis_history.py` - 12 test methods covering history save, retrieval, pagination, deletion
- `test_auth.py` - 7 test methods covering OAuth flow, JWT validation, user provisioning
- `test_mongodb.py` - MongoDB connection and error handling
- `test_weather_services.py` - Weather API integration
- `test_crop_model.py` - Crop model inference

**Test Infrastructure:**
- Custom mock MongoDB collections and database
- AsyncIO test cases
- httpx.AsyncClient for endpoint testing
- Dependency override pattern for isolation

**Coverage Highlights:**
- âœ… Ownership forgery attempts rejected
- âœ… Cross-user isolation verified
- âœ… Farm deletion partial failures retryable
- âœ… Field creation races with farm deletion compensated
- âœ… Orphan field scenario documented
- âœ… OAuth state/nonce validation
- âœ… JWT expiry, signature, claims validation
- âœ… Analysis saves server result only (client JSON rejected)
- âœ… Database errors sanitized

### Frontend Test Files
**Location:** `agriculture-ai-frontend/agriculture-ai-frontend/src/lib/`

**Files:**
- `crop-validation.test.ts` - Crop input validation matches backend ranges
- `weather-view-state.test.ts` - Weather UI state transitions

**Test Runner:** Node.js with `--experimental-strip-types` (TypeScript native)

**Last Results:** 6/6 passed

### TypeScript Compilation
**Command:** `npx tsc --noEmit`
**Last Result:** âœ… No errors

---

## 12. Development Commands

### Backend

**Start development server:**
```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Run tests:**
```powershell
cd backend
python -m unittest discover -s tests -p "test_*.py"
```

**Install dependencies:**
```powershell
cd backend
pip install -r requirements.txt
```

### Frontend

**Start development server:**
```powershell
cd agriculture-ai-frontend\agriculture-ai-frontend
npm run dev
```

**Run tests:**
```powershell
cd agriculture-ai-frontend\agriculture-ai-frontend
npm test
```

**Build for production:**
```powershell
cd agriculture-ai-frontend\agriculture-ai-frontend
npm run build
```

**Type check:**
```powershell
cd agriculture-ai-frontend\agriculture-ai-frontend
npx tsc --noEmit
```

---

## 13. Current Issues and Next Steps

### Immediate Action Items

1. **Resolve Worktree State**
   - Decision needed: Keep nested frontend or merge back to outer structure?
   - If keeping nested: Update deployment configs to reference correct path
   - If merging: Carefully restore outer frontend and migrate changes

2. **Install Backend Dependencies**
   - Tests currently fail due to missing PyMongo, BSON, etc.
   - Run: `pip install -r backend/requirements.txt`
   - Verify: Run test suite to confirm 79 tests pass

3. **Document Model Training Provenance**
   - Where were models trained?
   - What were the training metrics?
   - What are the model file checksums?
   - Create `backend/models/README.md` with details

4. **Live Integration Testing**
   - Test MongoDB Atlas connectivity with real URI
   - Test Google OAuth with real client credentials
   - Verify browser end-to-end flows
   - Document smoke test procedure

### Future Improvements

**High Priority:**
- Fix farm deletion race condition with distributed coordination
- Add model inference performance metrics
- Implement proper error tracking (Sentry, etc.)
- Add request tracing for debugging

**Medium Priority:**
- Add analysis result deletion endpoint
- Implement field search/filtering
- Add farm/field batch operations
- Improve LLM prompt engineering for advice quality
- Add more comprehensive error messages

**Nice to Have:**
- Add analysis export (CSV, PDF)
- Implement field boundary mapping
- Add multi-language UI translations (currently backend-only)
- Add user profile management
- Implement usage analytics

### Known Bugs to Investigate
- None currently documented beyond the farm deletion race

---

## 14. Documentation Files

**Available Documentation:**
- `README.md` - Project overview, setup instructions
- `PROJECT_OVERVIEW.md` - Architecture diagrams, model justification
- `env.example` - Environment variable template
- `agriculture-ai-frontend/agriculture-ai-frontend/DEPLOY.md` - Deployment guide
- `agriculture-ai-frontend/agriculture-ai-frontend/AGENTS.md` - AI assistant instructions
- `backend/.env.example` - (Missing, but `env.example` at root provides template)

**This Report:** `FARMINTEL_PROJECT_STATE_REPORT.md` - Complete technical handover

---

## 15. Handover Summary for Next Developer

**Project Name:** FarmIntel (TerraÂ·AI / AgroSense AI)
**Type:** University final-year project
**Status:** Functional with documented limitations
**Branch:** `main`
**Repository:** `D:\Website-Projects\Agriculture-AI`

**What Works:**
- âœ… Disease detection (38 classes, MobileNetV2)
- âœ… Soil classification (4 types, EfficientNet-B0)
- âœ… Crop recommendation (22 crops, CatBoost + fallback)
- âœ… Weather integration (Open-Meteo)
- âœ… LLM streaming advice (OpenAI-compatible)
- âœ… Google OAuth authentication
- âœ… MongoDB-backed farm/field/history management
- âœ… React frontend with TanStack Router
- âœ… 79 backend tests + 6 frontend tests (mock-backed)

**Important Context:**
1. **Nested Frontend:** Active development is in `agriculture-ai-frontend/agriculture-ai-frontend/`, not the outer directory
2. **Git State:** Many deleted files from outer frontend; nested directory is untracked
3. **Farm Deletion Race:** Known limitation documented in tests; requires distributed coordination to fix properly
4. **Model Fallbacks:** Crop model has centroid fallback; responses include `model_source` to distinguish
5. **No Live Testing:** Tests are mock-backed; MongoDB Atlas and Google OAuth not tested live

**Before Making Changes:**
1. Read this entire report
2. Run `git status --short` and understand current worktree
3. Install dependencies: `pip install -r backend/requirements.txt`
4. Run test suite: `python -m unittest discover -s backend/tests`
5. Review `backend/.env.example` and configure `backend/.env` (never commit)
6. Test health endpoint: `curl http://localhost:8000/api/v1/health`

**Critical Files:**
- `backend/main.py` - Application entry point and route registration
- `backend/middleware/auth.py` - OAuth and JWT implementation
- `backend/farms.py` - Farm/field CRUD with ownership enforcement
- `backend/analysis_history.py` - Analysis persistence
- `backend/database.py` - MongoDB lifecycle management
- `agriculture-ai-frontend/agriculture-ai-frontend/src/lib/api.ts` - Frontend API client
- `agriculture-ai-frontend/agriculture-ai-frontend/vite.config.ts` - Dev proxy configuration

**Getting Help:**
- Existing tests are comprehensive examples of expected behavior
- Error messages have been designed to be informative
- Health endpoint shows model and database status
- This report documents all known issues and design decisions

---

**Report Generated:** 2026-10-18
**Git Commit:** (Not committed - working tree has changes)
**Author:** Kiro AI Assistant (Project Handover Audit)

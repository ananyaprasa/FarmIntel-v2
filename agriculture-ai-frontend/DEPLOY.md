# Deploying to Vercel

This is the **frontend** (TanStack Start). Your FastAPI backend from
`Agriculture-AI-main/backend/` deploys separately.

---

## 1. Frontend on Vercel

1. Push this project to GitHub.
2. In Vercel → **New Project** → import the repo.
3. Framework preset: **Other**. Vercel picks up `vercel.json`:
   - Build command: `bun run build`
   - Output directory: `.output/public`
4. **Environment variables**:
   - `VITE_API_BASE_URL` — full URL of your FastAPI backend
     (e.g. `https://agri-api.onrender.com`). Leave empty to use the
     same-origin `/api/v1/...` rewrite in `vercel.json` (edit the
     `destination` in `vercel.json` first).
5. Deploy.

## 2. FastAPI backend

Vercel serverless (Python runtime) is only suitable for the **light**
routes. Heavy PyTorch/CatBoost models exceed the 250 MB unzipped
serverless limit — deploy the backend on a container host instead.

**Recommended hosts:**
- **Render** — free tier fits small models; add a `Procfile`
  `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Railway / Fly.io** — Docker image, no size limit
- **Hugging Face Spaces (Docker)** — free GPU option for the CNN

**Dockerfile** you can drop into `backend/`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
```

After the backend is live, set `VITE_API_BASE_URL` in Vercel to its URL
and redeploy, or update `vercel.json` `destination` and rely on the
rewrite so the browser calls same-origin (no CORS setup needed).

## 3. CORS (if not using the rewrite)

Add to `backend/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-vercel-app.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## API contract expected by this UI

- `POST /api/v1/analyze/disease` — multipart `file`, `lang` → `{ disease, scientific_name?, confidence, treatment?, urgency? }`
- `POST /api/v1/analyze/soil` — multipart `file`, `lang` → `{ soil_type, confidence, properties? }`
- `POST /api/v1/recommend/crop` — JSON `{ N,P,K,temperature,humidity,ph,rainfall,lang }` → `{ recommendations: [{crop, probability}] }`
- `POST /api/v1/advice` — JSON `{ question?, disease?, soil?, crop?, lang }` → streaming text/plain body

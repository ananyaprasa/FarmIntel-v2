"""
AgroSense AI — FastAPI Backend
================================
Run:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs
"""

import logging
import os
from pathlib import Path
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import Query
# Disable TensorFlow to prevent Keras 3 compatibility issues in transformers
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"

from contextlib import asynccontextmanager
from typing import Optional, Annotated

from dotenv import load_dotenv
from fastapi import (
    FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, FiniteFloat
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("agrosense")

LLM_KEY_PLACEHOLDERS = {"your_openai_api_key_here", "your_gemini_api_key_here"}


def _get_llm_api_key() -> str:
    for name in ("OPENAI_API_KEY", "GEMINI_API_KEY"):
        value = (os.getenv(name) or "").strip()
        if value and value not in LLM_KEY_PLACEHOLDERS:
            return value
    return ""


# ── Lazy imports (keep startup fast even if some deps missing) ────────────────
try:
    from models.disease_model import DiseaseModel
    from models.soil_model import SoilModel
    from models.crop_model import CropModel
    from services.orchestrator import Orchestrator
    from services.rag_service import RAGService
    from services.llm_service import LLMService
    from services.search_service import WebSearchService
    from utils.preprocessing import preprocess_image, preprocess_soil_image
    from utils.cache import cache
    from middleware.auth import (
        AuthConfigurationError,
        AuthStorageError,
        AuthenticatedUser,
        GoogleSignInError,
        complete_google_sign_in,
        get_current_user,
        logout_google_user,
        start_google_sign_in,
    )
    from analysis_history import (
        AnalysisIndexError,
        AnalysisSaveOptions,
        initialize_analysis_indexes,
        router as analyses_router,
        save_inference_result,
    )
    from farms import FarmIndexError, initialize_farm_indexes, router as farms_router
    from services.weather_service import get_weather, WeatherServiceError
    from services.weather_crop_service import recommend_weather_crops
    from database import MongoDBError, MongoDatabase
except ImportError:
    from backend.services.weather_service import get_weather, WeatherServiceError
    from backend.services.weather_crop_service import recommend_weather_crops
    from backend.database import MongoDBError, MongoDatabase
    from backend.farms import (
        FarmIndexError,
        initialize_farm_indexes,
        router as farms_router,
    )
    from backend.analysis_history import (
        AnalysisIndexError,
        AnalysisSaveOptions,
        initialize_analysis_indexes,
        router as analyses_router,
        save_inference_result,
    )
    from backend.models.disease_model import DiseaseModel
    from backend.models.soil_model import SoilModel
    from backend.models.crop_model import CropModel
    from backend.services.orchestrator import Orchestrator
    from backend.services.rag_service import RAGService
    from backend.services.llm_service import LLMService
    from backend.services.search_service import WebSearchService
    from backend.utils.preprocessing import preprocess_image, preprocess_soil_image
    from backend.utils.cache import cache
    from backend.middleware.auth import (
        AuthConfigurationError,
        AuthStorageError,
        AuthenticatedUser,
        GoogleSignInError,
        complete_google_sign_in,
        get_current_user,
        logout_google_user,
        start_google_sign_in,
    )


def safe_get_remote_address(request: Request) -> str:
    """Extract client IP safely across proxy and serverless environments."""
    if not request:
        return "127.0.0.1"
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
    if getattr(request, "client", None) and getattr(request.client, "host", None):
        return request.client.host
    return "127.0.0.1"


# ── App-level singletons ──────────────────────────────────────────────────────
disease_model  : Optional[DiseaseModel] = None
soil_model     : Optional[SoilModel]    = None
crop_model_obj : Optional[CropModel]    = None
orchestrator   : Orchestrator           = Orchestrator()
rag_service    : Optional[RAGService]   = None
llm_service    : Optional[LLMService]   = None
search_service : Optional[WebSearchService] = None

RATE_LIMIT = os.getenv("RATE_LIMIT_PER_MINUTE", "30") + "/minute"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global disease_model, soil_model, crop_model_obj, rag_service, llm_service, search_service
    search_service = WebSearchService()

    # ── MongoDB ─────────────────────────────────────────────────────────────
    app.state.farm_indexes_unavailable = True
    app.state.analysis_indexes_unavailable = True
    try:
        app.state.mongo_database = MongoDatabase.from_env()
        app.state.mongo_error = None
        try:
            await app.state.mongo_database.ping()
            await initialize_farm_indexes(app.state.mongo_database.database)
            app.state.farm_indexes_unavailable = False
            await initialize_analysis_indexes(app.state.mongo_database.database)
            app.state.analysis_indexes_unavailable = False
            logger.info("MongoDB connectivity check succeeded.")
        except MongoDBError as exc:
            app.state.mongo_error = exc
            logger.warning("MongoDB connectivity check failed (%s): %s", exc.code, exc)
        except FarmIndexError:
            logger.error("Farm and field indexes could not be initialized.")
        except AnalysisIndexError:
            logger.error("Analysis history indexes could not be initialized.")
    except MongoDBError as exc:
        app.state.mongo_database = None
        app.state.mongo_error = exc
        logger.error("MongoDB is unavailable (%s): %s", exc.code, exc)

    # ── Cache ────────────────────────────────────────────────────────────────
    cache._redis_url = os.getenv("REDIS_URL")
    await cache.connect()

    base_dir = Path(__file__).parent

    def resolve_backend_path(env_var: str, default_rel: str) -> str:
        val = (os.getenv(env_var) or "").strip()
        if val:
            p = Path(val)
            if p.is_absolute() and p.exists():
                return str(p)
            if (base_dir / val).exists():
                return str(base_dir / val)
            if p.exists():
                return str(p)
        return str(base_dir / default_rel)

    disease_model = DiseaseModel(
        model_path  = resolve_backend_path("DISEASE_MODEL_PATH", "models/disease_model_93_plantdoc_deep_ft_best.pth"),
        num_classes = int(os.getenv("DISEASE_NUM_CLASSES", "38")),
    )
    try:
        disease_model.load()
    except Exception as e:
        logger.error("Disease model load failed: %s", e)

    soil_model = SoilModel(
        model_path  = resolve_backend_path("SOIL_MODEL_PATH", "models/soil_model.pth"),
        num_classes = int(os.getenv("SOIL_NUM_CLASSES", "4")),
    )
    try:
        soil_model.load()
    except Exception as e:
        logger.error("Soil model load failed: %s", e)

    crop_model_obj = CropModel(
        model_path          = resolve_backend_path("CROP_MODEL_PATH", "models/crop_model.pkl"),
        label_encoder_path  = resolve_backend_path("LABEL_ENCODER_PATH", "models/label_enoder_crop.pkl"),
    )
    try:
        crop_model_obj.load()
    except Exception as e:
        logger.error("Crop model load failed: %s", e)

    # ── RAG ──────────────────────────────────────────────────────────────────
    rag_service = RAGService(docs_dir=resolve_backend_path("RAG_DOCS_DIR", "rag_docs"))

    # ── LLM ──────────────────────────────────────────────────────────────────
    api_key = _get_llm_api_key()
    base_url = (os.getenv("OPENAI_BASE_URL") or "").strip() or None
    if api_key:
        llm_service = LLMService(api_key=api_key, base_url=base_url)
        logger.info("LLM service initialized (base_url=%s).", base_url or "default")
    else:
        logger.warning("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured — LLM endpoints disabled.")

    logger.info("AgroSense AI startup complete.")
    try:
        yield
    finally:
        mongo_database = getattr(app.state, "mongo_database", None)
        try:
            if mongo_database is not None:
                await mongo_database.close()
        finally:
            await cache.close()
            logger.info("AgroSense AI shutdown complete.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=safe_get_remote_address, default_limits=[RATE_LIMIT])
app     = FastAPI(
    title       = "AgroSense AI API",
    description = "Multi-model agricultural AI: disease detection, soil analysis, crop recommendation, LLM advice.",
    version     = "1.0.0",
    lifespan    = lifespan,
)
app.state.limiter = limiter
app.state.farm_indexes_unavailable = True
app.state.analysis_indexes_unavailable = True
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

cors_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if cors_origins_env == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(farms_router)
app.include_router(analyses_router)

# ── Request / Response Schemas ────────────────────────────────────────────────
class CropInput(BaseModel):
    N: FiniteFloat = Field(
        ..., ge=0, le=140,
        description="Nitrogen feature; the training CSV does not specify its unit.",
    )
    P: FiniteFloat = Field(
        ..., ge=0, le=145,
        description="Phosphorus feature; the training CSV does not specify its unit.",
    )
    K: FiniteFloat = Field(
        ..., ge=0, le=205,
        description="Potassium feature; the training CSV does not specify its unit.",
    )
    temperature: FiniteFloat = Field(..., ge=8.0, le=45.0, description="Temperature in °C")
    humidity: FiniteFloat = Field(..., ge=14.0, le=100.0, description="Relative humidity %")
    ph: FiniteFloat = Field(..., ge=3.5, le=10.0, description="Soil pH level")
    rainfall: FiniteFloat = Field(
        ..., ge=20.0, le=300.0,
        description="Rainfall in mm; the training CSV does not specify the time period.",
    )
    language: str = Field(
        "en",
        description="UI language; crop labels and model tips are returned in English.",
    )


class AdviceRequest(BaseModel):
    question: Optional[str] = Field(None, description="Optional custom question from user")
    disease_result: Optional[dict] = Field(None, description="Output from /analyze/disease")
    soil_result: Optional[dict] = Field(None, description="Output from /analyze/soil")
    crop_result: Optional[dict] = Field(None, description="Output from /recommend/crop")
    language: str = Field("en", description="Response language: en | ta | hi | te")


class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: dict[str, bool]
    redis_connected: bool


# ── Root Landing Page ─────────────────────────────────────────────────────────
from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terra·AI — Agricultural Intelligence API</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 600px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
            h1 { color: #4ade80; margin-top: 0; display: flex; align-items: center; gap: 0.5rem; }
            p { color: #94a3b8; line-height: 1.6; }
            .status { display: inline-flex; align-items: center; gap: 0.5rem; background: #166534; color: #4ade80; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
            .status-dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; display: inline-block; }
            ul { list-style: none; padding: 0; margin: 1.5rem 0; }
            li { padding: 0.75rem; background: #0f172a; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #334155; }
            code { color: #38bdf8; font-family: monospace; font-size: 0.9em; }
            .btn { display: inline-block; background: #22c55e; color: #0f172a; font-weight: bold; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; margin-top: 1rem; text-align: center; }
            .btn:hover { background: #16a34a; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="status"><span class="status-dot"></span> Backend Online & Operational</div>
            <h1>🌿 Terra·AI Agricultural Intelligence</h1>
            <p>Multi-Model Artificial Intelligence API powered by MobileNetV2 (Plant Disease), EfficientNet-B0 (Soil Analysis), and CatBoost (Crop Recommendation).</p>
            <h3>Available Endpoints:</h3>
            <ul>
                <li><code>POST /api/v1/analyze/disease</code> — Leaf disease diagnosis</li>
                <li><code>POST /api/v1/analyze/soil</code> — Soil type classification</li>
                <li><code>POST /api/v1/recommend/crop</code> — Crop recommendation</li>
                <li><code>GET  /api/v1/health</code> — Backend status check</li>
            </ul>
            <a href="/docs" class="btn">Explore & Test API (Swagger UI) →</a>
        </div>
    </body>
    </html>
    """



@app.get("/api/v1/weather", tags=["weather"])
async def weather_forecast(
    latitude: FiniteFloat = Query(..., ge=-90, le=90),
    longitude: FiniteFloat = Query(..., ge=-180, le=180),
    selected_date: date | None = Query(None, alias="date"),
    timezone: str = Query("auto", min_length=1, max_length=64),
):
    try:
        local_timezone = None
        if timezone != "auto":
            try:
                local_timezone = ZoneInfo(timezone)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise HTTPException(
                    status_code=422,
                    detail="Timezone must be 'auto' or a valid IANA timezone.",
                ) from exc
        forecast_date = selected_date
        if forecast_date is None:
            forecast_date = (
                datetime.now(local_timezone).date()
                if local_timezone
                else date.today()
            )
        cache_key = (
            f"weather:{latitude:.5f}:{longitude:.5f}:"
            f"{forecast_date}:{timezone}"
        )
        cached = await cache.get(cache_key)
        if cached:
            return cached

        result = await get_weather(
            latitude=latitude,
            longitude=longitude,
            selected_date=forecast_date,
            timezone=timezone,
        )
        result["crop_recommendations"] = recommend_weather_crops(result)
        await cache.set(cache_key, result, ttl=300)
        return result

    except HTTPException:
        raise

    except WeatherServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    except Exception:
        logger.exception("Weather endpoint failed")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while fetching weather.",
        )

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", response_model=None, tags=["system"])
@app.get("/api/v1/health", response_model=None, tags=["system"])
async def health_check(request: Request):
    disease_loaded = disease_model is not None and getattr(disease_model, "model", None) is not None
    soil_loaded = soil_model is not None and getattr(soil_model, "model", None) is not None
    crop_loaded = crop_model_obj is not None and getattr(crop_model_obj, "model", None) is not None

    disease_is_fallback = type(getattr(disease_model, "model", None)).__name__ == "FallbackDiseaseModel"
    crop_is_fallback = type(getattr(crop_model_obj, "model", None)).__name__ == "CentroidCropModel"

    mongo_database = getattr(request.app.state, "mongo_database", None)
    mongo_error = getattr(request.app.state, "mongo_error", None)
    if mongo_database is None:
        mongodb_status = "not_configured" if (
            mongo_error is not None and mongo_error.code == "not_configured"
        ) else "disconnected"
        mongodb_error = (
            {"code": mongo_error.code, "message": str(mongo_error)}
            if mongo_error is not None
            else None
        )
    else:
        try:
            await mongo_database.ping()
            mongodb_status = "connected"
            mongodb_error = None
            request.app.state.mongo_error = None
        except MongoDBError as exc:
            mongodb_status = "disconnected"
            mongodb_error = {"code": exc.code, "message": str(exc)}
            request.app.state.mongo_error = exc

    return {
        "status": "healthy",
        "application_status": "running",
        "mongodb": {
            "status": mongodb_status,
            "error": mongodb_error,
        },
        "version": "1.0.0",
        "models_loaded": {
            "disease": disease_loaded and not disease_is_fallback,
            "soil":    soil_loaded,
            "crop":    crop_loaded and not crop_is_fallback,
        },
        "models_status": {
            "disease": "neural_network" if (disease_loaded and not disease_is_fallback) else ("fallback" if disease_loaded else "unloaded"),
            "soil":    "neural_network" if soil_loaded else "unloaded",
            "crop":    "catboost" if (crop_loaded and not crop_is_fallback) else ("centroid_fallback" if crop_loaded else "unloaded"),
        },
        "redis_connected": cache._redis_url is not None and cache._backend is not None,
    }


# ── Auth ──────────────────────────────────────────────────────────────────────
@app.get("/api/v1/auth/google/start", tags=["auth"])
async def google_sign_in_start():
    try:
        return start_google_sign_in()
    except AuthConfigurationError:
        raise HTTPException(
            status_code=503, detail="Google sign-in is not configured."
        ) from None


@app.post("/api/v1/auth/google/callback", tags=["auth"], include_in_schema=False)
async def google_sign_in_callback(request: Request):
    try:
        return await complete_google_sign_in(request)
    except AuthConfigurationError:
        raise HTTPException(
            status_code=503, detail="Google sign-in is not configured."
        ) from None
    except GoogleSignInError as exc:
        raise HTTPException(
            status_code=exc.status_code, detail=str(exc)
        ) from None
    except AuthStorageError:
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable.",
        ) from None


@app.get("/api/v1/auth/me", response_model=AuthenticatedUser, tags=["auth"])
async def auth_me(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    return user


@app.post("/api/v1/auth/logout", status_code=204, tags=["auth"])
async def auth_logout(request: Request):
    return logout_google_user(request)


# ── Disease detection ─────────────────────────────────────────────────────────
@app.post("/api/v1/analyze/disease", tags=["models"])
@limiter.limit(RATE_LIMIT)
async def analyze_disease(
    request : Request,
    file    : UploadFile = File(..., description="Plant leaf image"),
    lang    : Optional[str] = Form("en"),
    save_options: Annotated[AnalysisSaveOptions, Depends()] = AnalysisSaveOptions(),
):
    global disease_model
    if disease_model is None:
        base_dir = Path(__file__).parent
        disease_model = DiseaseModel(model_path=str(base_dir / "models/disease_model_fp16.pth"))
        disease_model.load()

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")

    try:
        tensor, cache_key = preprocess_image(image_bytes)
        logger.info(f"File Size: {len(image_bytes)} | Hash: {cache_key}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Preprocessing failed")
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {exc}")

    try:
        cached = await cache.get(f"disease:{cache_key}")
        if cached and isinstance(cached, dict):
            response = {**cached, "cached": True}
            analysis_id = await save_inference_result(
                request, save_options, "disease", response
            )
            if analysis_id is not None:
                response["analysis_id"] = analysis_id
            return response
    except Exception as e:
        logger.warning("Cache check skipped: %s", e)

    try:
        result = disease_model.predict(tensor)
    except Exception as exc:
        logger.exception("Disease inference failed")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    try:
        await cache.set(f"disease:{cache_key}", result, ttl=3600)
    except Exception as e:
        logger.warning("Cache write skipped: %s", e)

    response = {**result, "cached": False}
    analysis_id = await save_inference_result(
        request, save_options, "disease", response
    )
    if analysis_id is not None:
        response["analysis_id"] = analysis_id
    return response


# ── Soil analysis ─────────────────────────────────────────────────────────────
@app.post("/api/v1/analyze/soil", tags=["models"])
@limiter.limit(RATE_LIMIT)
async def analyze_soil(
    request : Request,
    file    : UploadFile = File(..., description="Soil image"),
    lang    : Optional[str] = Form("en"),
    save_options: Annotated[AnalysisSaveOptions, Depends()] = AnalysisSaveOptions(),
):
    global soil_model
    if soil_model is None:
        base_dir = Path(__file__).parent
        soil_model = SoilModel(model_path=str(base_dir / "models/soil_model.pth"))
        soil_model.load()

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")

    try:
        tensor, cache_key = preprocess_soil_image(image_bytes)
        logger.info(f"File Size: {len(image_bytes)} | Hash: {cache_key}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Preprocessing failed")
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {exc}")

    try:
        cached = await cache.get(f"soil:{cache_key}")
        if (
            isinstance(cached, dict)
            and isinstance(cached.get("soil_type"), str)
            and isinstance(cached.get("confidence"), (int, float))
            and 0 <= cached["confidence"] <= 100
            and cached.get("confidence_method") == "softmax_score"
            and isinstance(cached.get("all_classes"), list)
        ):
            response = {**cached, "cached": True}
            analysis_id = await save_inference_result(
                request, save_options, "soil", response
            )
            if analysis_id is not None:
                response["analysis_id"] = analysis_id
            return response
    except Exception as e:
        logger.warning("Cache check skipped: %s", e)

    try:
        result = soil_model.predict(tensor)
    except RuntimeError as exc:
        logger.error("Soil inference unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Soil analysis is temporarily unavailable because the classification model could not complete inference.",
        ) from exc
    except ValueError as exc:
        logger.exception("Soil model returned an invalid prediction.")
        raise HTTPException(status_code=500, detail="Soil model returned an invalid prediction.") from exc
    except Exception as exc:
        logger.exception("Soil inference failed")
        raise HTTPException(status_code=500, detail="Soil inference failed.") from exc

    try:
        await cache.set(f"soil:{cache_key}", result, ttl=3600)
    except Exception as e:
        logger.warning("Cache write skipped: %s", e)

    response = {**result, "cached": False}
    analysis_id = await save_inference_result(
        request, save_options, "soil", response
    )
    if analysis_id is not None:
        response["analysis_id"] = analysis_id
    return response


# ── Crop recommendation ───────────────────────────────────────────────────────
@app.post("/api/v1/recommend/crop", tags=["models"])
@limiter.limit(RATE_LIMIT)
async def recommend_crop(
    request : Request,
    data    : CropInput,
    save_options: Annotated[AnalysisSaveOptions, Depends()] = AnalysisSaveOptions(),
):
    global crop_model_obj
    if crop_model_obj is None:
        base_dir = Path(__file__).parent
        crop_model_obj = CropModel(
            model_path          = str(base_dir / "models/crop_model.pkl"),
            label_encoder_path  = str(base_dir / "models/label_enoder_crop.pkl"),
        )
        crop_model_obj.load()

    cache_key = f"crop:{data.N}:{data.P}:{data.K}:{data.temperature}:{data.humidity}:{data.ph}:{data.rainfall}"
    try:
        cached = await cache.get(cache_key)
        if cached and isinstance(cached, dict):
            response = {**cached, "cached": True}
            analysis_id = await save_inference_result(
                request, save_options, "crop", response
            )
            if analysis_id is not None:
                response["analysis_id"] = analysis_id
            return response
    except Exception as e:
        logger.warning("Cache check skipped: %s", e)

    try:
        recs = crop_model_obj.predict(
            n=data.N,
            p=data.P,
            k=data.K,
            temperature=data.temperature,
            humidity=data.humidity,
            ph=data.ph,
            rainfall=data.rainfall,
        )
    except Exception as exc:
        logger.exception("Crop recommendation failed")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    result = recs
    try:
        await cache.set(cache_key, result, ttl=3600)
    except Exception as e:
        logger.warning("Cache write skipped: %s", e)

    response = {**result, "cached": False}
    analysis_id = await save_inference_result(
        request, save_options, "crop", response
    )
    if analysis_id is not None:
        response["analysis_id"] = analysis_id
    return response


# ── Advice (Streaming RAG + LLM) ──────────────────────────────────────────────
@app.post("/api/v1/advice", tags=["llm"])
@limiter.limit(RATE_LIMIT)
async def get_advice(
    request: Request,
    payload: AdviceRequest,
):
    if not llm_service:
        async def mock_stream():
            yield "data: [OPENAI_API_KEY is not configured in backend/.env. Demo mode active.]\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(mock_stream(), media_type="text/event-stream")

    try:
        generator = orchestrator.stream_advice(
            payload        = payload.dict(),
            rag_service    = rag_service,
            llm_service    = llm_service,
            search_service = search_service,
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as exc:
        logger.exception("Advice streaming failed")
        raise HTTPException(status_code=500, detail=f"Orchestrator error: {exc}")

// Development requests stay same-origin so Vite can proxy them to FastAPI.
// Production can use VITE_API_BASE_URL when the backend is hosted separately.
const configuredApiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const API_BASE: string = import.meta.env.DEV ? "" : configuredApiBase;

const url = (p: string) => `${API_BASE}${p}`;

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  display_name: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await fetch(url("/api/v1/auth/me"), {
    credentials: "include",
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Unable to check sign-in status (HTTP ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The sign-in status response was invalid.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("The sign-in status response was invalid.");
  }

  const user = data as Record<string, unknown>;
  if (
    typeof user.id !== "string" ||
    !user.id ||
    (user.email !== null && typeof user.email !== "string") ||
    (user.display_name !== null && typeof user.display_name !== "string")
  ) {
    throw new Error("The sign-in status response was invalid.");
  }

  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
  };
}

export async function logout(): Promise<void> {
  const response = await fetch(url("/api/v1/auth/logout"), {
    method: "POST",
    credentials: "include",
  });

  if (response.status !== 204) {
    throw new Error(`Unable to sign out (HTTP ${response.status}).`);
  }
}

export function startGoogleSignIn(): void {
  window.location.assign(url("/api/v1/auth/google/start"));
}

export type Farm = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

export type FarmInput = {
  name: string;
  description?: string | null;
  location?: string | null;
};

export type FarmUpdate = Partial<FarmInput>;

export type FieldAreaUnit = "acre" | "hectare" | "m²";

export type FarmField = {
  id: string;
  farm_id: string;
  name: string;
  area: number | null;
  area_unit: FieldAreaUnit | null;
  crop_type: string | null;
  soil_type: string | null;
  created_at: string;
  updated_at: string;
};

export type FarmFieldInput = {
  name: string;
  area?: number | null;
  area_unit?: FieldAreaUnit | null;
  crop_type?: string | null;
  soil_type?: string | null;
};

export type FarmFieldUpdate = Partial<FarmFieldInput>;

export type AnalysisType = "disease" | "soil" | "crop";

export type Analysis = {
  id: string;
  field_id: string | null;
  analysis_type: AnalysisType;
  result: Record<string, unknown>;
  created_at: string;
};

export type AnalysisPage = {
  items: Analysis[];
  limit: number;
  offset: number;
  has_more: boolean;
};

export type AnalysisSaveOptions = {
  saveToHistory?: boolean;
  fieldId?: string;
};

export type FarmFieldWithFarm = FarmField & { farm_name: string };

export async function listOwnedFarmFields(): Promise<FarmFieldWithFarm[]> {
  const farms = await listFarms();
  const fields = await Promise.all(
    farms.map(async (farm) =>
      (await listFarmFields(farm.id)).map((field) => ({
        ...field,
        farm_name: farm.name,
      })),
    ),
  );
  return fields.flat();
}

export async function listAnalyses(params: {
  limit: number;
  offset: number;
  analysisType?: AnalysisType;
  fieldId?: string;
  farmId?: string;
}): Promise<AnalysisPage> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.analysisType) query.set("analysis_type", params.analysisType);
  if (params.fieldId) query.set("field_id", params.fieldId);
  if (params.farmId) query.set("farm_id", params.farmId);
  return farmApiJson(`/api/v1/analyses?${query.toString()}`);
}

export function getAnalysis(id: string): Promise<Analysis> {
  return farmApiJson(`/api/v1/analyses/${encodeURIComponent(id)}`);
}

function analysisOptionsQuery(options?: AnalysisSaveOptions): string {
  if (!options?.saveToHistory) return "";
  const query = new URLSearchParams({ save_to_history: "true" });
  if (options.fieldId) query.set("field_id", options.fieldId);
  return `?${query.toString()}`;
}

export class FarmApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FarmApiError";
  }
}

async function farmApiResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(url(path), {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    let message =
      response.status === 401
        ? "Your sign-in session has expired. Sign in again to manage farms."
        : `Farm request failed (HTTP ${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "detail" in body &&
        typeof body.detail === "string"
      ) {
        message = body.detail;
      } else if (
        typeof body === "object" &&
        body !== null &&
        "detail" in body &&
        Array.isArray(body.detail)
      ) {
        const validationMessages = body.detail.flatMap((item: unknown) =>
          typeof item === "object" && item !== null && "msg" in item && typeof item.msg === "string"
            ? [item.msg]
            : [],
        );
        if (validationMessages.length > 0) {
          message = validationMessages.join(" ");
        }
      }
    } catch {
      // Keep the status-based message when an error response is not JSON.
    }
    throw new FarmApiError(response.status, message);
  }

  return response;
}

async function farmApiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await farmApiResponse(path, init);
  if (response.status === 204) {
    throw new FarmApiError(response.status, "The farm service returned an empty response.");
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new FarmApiError(response.status, "The farm service returned an invalid response.");
  }
}

async function farmApiDelete(path: string): Promise<void> {
  const response = await farmApiResponse(path, { method: "DELETE" });
  if (response.status !== 204) {
    throw new FarmApiError(
      response.status,
      "The farm service returned an unexpected delete response.",
    );
  }
}

export function listFarms(): Promise<Farm[]> {
  return farmApiJson("/api/v1/farms");
}

export function createFarm(input: FarmInput): Promise<Farm> {
  return farmApiJson("/api/v1/farms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFarm(id: string, input: FarmUpdate): Promise<Farm> {
  return farmApiJson(`/api/v1/farms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFarm(id: string): Promise<void> {
  return farmApiDelete(`/api/v1/farms/${encodeURIComponent(id)}`);
}

export function getFarm(id: string): Promise<Farm> {
  return farmApiJson(`/api/v1/farms/${encodeURIComponent(id)}`);
}

export function listFarmFields(farmId: string): Promise<FarmField[]> {
  return farmApiJson(`/api/v1/farms/${encodeURIComponent(farmId)}/fields`);
}

export function createFarmField(farmId: string, input: FarmFieldInput): Promise<FarmField> {
  return farmApiJson(`/api/v1/farms/${encodeURIComponent(farmId)}/fields`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFarmField(id: string, input: FarmFieldUpdate): Promise<FarmField> {
  return farmApiJson(`/api/v1/fields/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFarmField(id: string): Promise<void> {
  return farmApiDelete(`/api/v1/fields/${encodeURIComponent(id)}`);
}

export type DiseaseResult = {
  analysis_id?: string;
  disease: string;
  scientific_name?: string;
  confidence: number;
  treatment?: string;
  urgency?: "low" | "moderate" | "high";
};

export type SoilResult = {
  analysis_id?: string;
  soil_type: string;
  confidence: number;
  top_predictions?: { label: string; confidence: number }[];
  properties?: Record<string, string | number>;
};

export type CropInput = {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
};

export type CropModelSource = "catboost" | "centroid_fallback" | "unknown";
export type CropScoreKind = "model_class_score" | "profile_similarity_share" | "unknown";
export type CropSuggestion = { crop: string; probability: number };
export type CropRecommendationResult = {
  analysis_id?: string;
  recommendations: CropSuggestion[];
  modelSource: CropModelSource;
  scoreKind: CropScoreKind;
  tip?: string;
  inputWarnings: string[];
};

export type WeatherHourly = {
  time: string;
  temperature?: number;
  feels_like?: number;
  humidity?: number;
  precipitation_probability?: number;
  precipitation?: number;
  wind_speed?: number;
  weather_code?: number;
  condition?: string;
  is_day?: boolean;
};

export type WeatherCropComparison = {
  factor: "temperature" | "humidity";
  forecast_average: number;
  profile_average: number;
  difference: number;
  unit: "°C" | "%";
};

export type WeatherCropSuggestion = {
  crop: string;
  score: number;
  comparisons: WeatherCropComparison[];
};

export type WeatherCropRecommendations = {
  status: "available" | "insufficient_data";
  method: "stored_crop_profile_similarity";
  forecast_date: string;
  timezone: string;
  score_kind: "stored_crop_profile_similarity";
  score_note: string;
  soil_note: string;
  missing_variables: string[];
  excluded_variables: string[];
  forecast_averages: {
    temperature_c: number | null;
    humidity_pct: number | null;
  };
  suggestions: WeatherCropSuggestion[];
  message?: string;
};

export type WeatherResult = {
  latitude: number;
  longitude: number;
  date: string;
  timezone: string;
  temperature_max?: number;
  temperature_min?: number;
  precipitation_sum?: number;
  precipitation_probability_max?: number;
  sunrise?: string;
  sunset?: string;
  weather_code?: number;
  condition?: string;
  hourly: WeatherHourly[];
  crop_recommendations?: WeatherCropRecommendations;
};

export type WeatherPlace = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

export async function analyzeDisease(
  file: File,
  lang: string,
  options?: AnalysisSaveOptions,
): Promise<DiseaseResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("lang", lang);
  const r = await fetch(url(`/api/v1/analyze/disease${analysisOptionsQuery(options)}`), {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${r.status}`;
    throw new Error(
      r.status === 401
        ? "Your sign-in session expired. Sign in again to save this analysis."
        : detail,
    );
  }
  const data = await r.json();
  const rawConf = data.confidence ?? 0;
  // Backend returns confidence as 0..100 (e.g. 98.45). UI components expect 0..1 scale.
  const confidence = rawConf > 1 ? rawConf / 100 : rawConf;
  const isHealthy = data.is_healthy ?? false;
  const treatmentsList = Array.isArray(data.treatments)
    ? data.treatments.join(". ")
    : (data.treatment ?? "");
  const urgency: "low" | "moderate" | "high" = isHealthy
    ? "low"
    : confidence > 0.8
      ? "high"
      : "moderate";

  return {
    analysis_id: typeof data.analysis_id === "string" ? data.analysis_id : undefined,
    disease: data.disease ?? "Unknown",
    scientific_name: data.scientific_name,
    confidence,
    treatment: treatmentsList,
    urgency,
  };
}

export async function analyzeSoil(
  file: File,
  lang: string,
  options?: AnalysisSaveOptions,
): Promise<SoilResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("lang", lang);
  const r = await fetch(url(`/api/v1/analyze/soil${analysisOptionsQuery(options)}`), {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const detail =
      body && typeof body.detail === "string"
        ? body.detail
        : `Soil analysis failed (HTTP ${r.status}).`;
    throw new Error(
      r.status === 401
        ? "Your sign-in session expired. Sign in again to save this analysis."
        : detail,
    );
  }
  const data = await r.json();
  const rawConf = data.confidence ?? 0;
  // Backend returns confidence as 0..100 (e.g. 92.1). UI components expect 0..1 scale.
  const confidence = rawConf > 1 ? rawConf / 100 : rawConf;

  const properties: Record<string, string | number> = {};
  if (data.water_retention) properties["Water Retention"] = data.water_retention;
  if (data.drainage) properties["Drainage"] = data.drainage;
  if (data.fertility) properties["Fertility"] = data.fertility;
  if (Array.isArray(data.suitable_crops) && data.suitable_crops.length > 0) {
    properties["Potentially suitable crops"] = data.suitable_crops.join(", ");
  }
  if (Array.isArray(data.tips) && data.tips.length > 0) {
    properties["General next steps"] = data.tips.join(". ");
  }
  if (data.properties && typeof data.properties === "object") {
    Object.assign(properties, data.properties);
  }

  return {
    analysis_id: typeof data.analysis_id === "string" ? data.analysis_id : undefined,
    soil_type: data.soil_type ?? "Unknown",
    confidence,
    top_predictions: Array.isArray(data.top_predictions)
      ? data.top_predictions.map((prediction: { label: string; confidence: number }) => ({
          label: prediction.label,
          confidence:
            prediction.confidence > 1 ? prediction.confidence / 100 : prediction.confidence,
        }))
      : undefined,
    properties,
  };
}

export async function recommendCrop(
  input: CropInput,
  lang: string,
  options?: AnalysisSaveOptions,
): Promise<CropRecommendationResult> {
  const payload = { ...input, language: lang };

  const r = await fetch(url(`/api/v1/recommend/crop${analysisOptionsQuery(options)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  // Parse the response body only once.
  const data = await r.json().catch(() => null);

  if (!r.ok) {
    console.error("Crop recommendation API error:", JSON.stringify(data, null, 2));

    const detail = data?.detail;
    const message =
      typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : `HTTP ${r.status}`;

    throw new Error(
      r.status === 401
        ? "Your sign-in session expired. Sign in again to save this analysis."
        : message,
    );
  }

  const rawRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];

  const seenCrops = new Set<string>();
  const recommendations: CropSuggestion[] = [];
  for (const item of rawRecs as { crop?: string; probability?: number }[]) {
    const crop = typeof item.crop === "string" ? item.crop.trim() : "";
    const rawProbability = Number(item.probability);
    const key = crop.toLocaleLowerCase();
    if (!crop || seenCrops.has(key) || !Number.isFinite(rawProbability)) continue;
    seenCrops.add(key);
    recommendations.push({
      crop,
      probability: rawProbability > 1 ? rawProbability / 100 : rawProbability,
    });
    if (recommendations.length === 5) break;
  }

  const modelSource: CropModelSource =
    data?.model_source === "catboost" || data?.model_source === "centroid_fallback"
      ? data.model_source
      : "unknown";
  const scoreKind: CropScoreKind =
    data?.score_kind === "model_class_score" || data?.score_kind === "profile_similarity_share"
      ? data.score_kind
      : "unknown";

  return {
    analysis_id: typeof data?.analysis_id === "string" ? data.analysis_id : undefined,
    recommendations,
    modelSource,
    scoreKind,
    tip: typeof data?.tip === "string" ? data.tip : undefined,
    inputWarnings: Array.isArray(data?.input_warnings)
      ? data.input_warnings.filter(
          (warning: unknown): warning is string => typeof warning === "string",
        )
      : [],
  };
}

export async function getWeather(
  latitude: number,
  longitude: number,
  date: string,
  timezone = "auto",
  signal?: AbortSignal,
): Promise<WeatherResult> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    date,
    timezone,
  });

  const r = await fetch(url(`/api/v1/weather?${params.toString()}`), {
    signal,
  });

  if (!r.ok) {
    let message = `Weather request failed (HTTP ${r.status})`;

    try {
      const errorBody = await r.json();
      if (errorBody?.detail) {
        message = errorBody.detail;
      }
    } catch {
      // Keep the default error message if the response is not JSON.
    }

    throw new Error(message);
  }

  return (await r.json()) as WeatherResult;
}

export async function searchWeatherPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<WeatherPlace[]> {
  const params = new URLSearchParams({
    name: query.trim(),
    count: "8",
    language: "en",
    format: "json",
  });
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Place search failed (HTTP ${response.status}).`);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("results" in data) ||
    !Array.isArray(data.results)
  ) {
    return [];
  }

  return data.results.filter(
    (place): place is WeatherPlace =>
      typeof place === "object" &&
      place !== null &&
      "name" in place &&
      typeof place.name === "string" &&
      "latitude" in place &&
      typeof place.latitude === "number" &&
      "longitude" in place &&
      typeof place.longitude === "number",
  );
}

export async function streamAdvice(
  payload: {
    question?: string;
    disease?: DiseaseResult | null;
    soil?: SoilResult | null;
    crop?: CropSuggestion[] | null;
    lang: string;
  },
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body = {
    prompt: payload.question || undefined,
    disease_result: payload.disease || undefined,
    soil_result: payload.soil || undefined,
    crop_result:
      payload.crop && payload.crop.length > 0 ? { recommendations: payload.crop } : undefined,
    language: payload.lang ?? "en",
    stream: true,
  };

  const r = await fetch(url(`/api/v1/advice`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

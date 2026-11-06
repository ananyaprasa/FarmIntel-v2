import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { listAnalyses, listOwnedFarmFields, listFarms, startGoogleSignIn, type AnalysisType } from "@/lib/api";

const PAGE_SIZE = 20;

export function AnalysisHistoryPage({
  initialAnalysisType,
  initialFieldId,
  initialFarmId,
}: {
  initialAnalysisType?: "disease" | "soil" | "crop";
  initialFieldId?: string;
  initialFarmId?: string;
} = {}) {
  const auth = useAuth();
  const [analysisType, setAnalysisType] = useState<AnalysisType | "">(initialAnalysisType || "");
  const [fieldId, setFieldId] = useState(initialFieldId || "");
  const [farmId, setFarmId] = useState(initialFarmId || "");
  const [offset, setOffset] = useState(0);
  const historyQuery = useQuery({
    queryKey: ["analysis-history", analysisType, fieldId, farmId, offset],
    queryFn: () =>
      listAnalyses({
        limit: PAGE_SIZE,
        offset,
        analysisType: analysisType || undefined,
        fieldId: fieldId || undefined,
        farmId: farmId || undefined,
      }),
    enabled: auth.status === "authenticated",
  });
  const fieldsQuery = useQuery({
    queryKey: ["analysis-save-fields"],
    queryFn: listOwnedFarmFields,
    enabled: auth.status === "authenticated",
  });
  const farmsQuery = useQuery({
    queryKey: ["farms"],
    queryFn: listFarms,
    enabled: auth.status === "authenticated",
  });
  const fieldsById = new Map((fieldsQuery.data ?? []).map((field) => [field.id, field]));

  if (auth.status === "loading") {
    return <StatusPanel>Checking your sign-in…</StatusPanel>;
  }
  if (auth.status === "error") {
    return (
      <StatusPanel title="Session unavailable">
        <p>{auth.error}</p>
        <button className="mt-4 font-semibold text-emerald-800 underline" onClick={auth.retry}>
          Retry session check
        </button>
      </StatusPanel>
    );
  }
  if (auth.status === "unauthenticated") {
    return (
      <StatusPanel title="Sign in to view your analysis history">
        <p>Saved disease, soil, and crop results are private to your account.</p>
        <button
          className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white"
          onClick={startGoogleSignIn}
        >
          Continue with Google
        </button>
      </StatusPanel>
    );
  }

  function changeType(value: AnalysisType | "") {
    setAnalysisType(value);
    setOffset(0);
  }

  function changeField(value: string) {
    setFieldId(value);
    setOffset(0);
  }

  function changeFarm(value: string) {
    setFarmId(value);
    setFieldId(""); // Clear field filter when farm changes
    setOffset(0);
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-white/70 bg-white/60 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Your account
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
          Analysis history
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review saved results from actual server-generated disease, soil, and crop analyses.
          Results are snapshots and are not recalculated when models change.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm sm:flex-row sm:flex-wrap">
        <label className="text-sm font-semibold text-slate-700">
          Analysis type
          <select
            className="mt-1 block min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={analysisType}
            onChange={(event) => changeType(event.target.value as AnalysisType | "")}
          >
            <option value="">All types</option>
            <option value="disease">Disease</option>
            <option value="soil">Soil</option>
            <option value="crop">Crop</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Farm
          <select
            className="mt-1 block min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={farmId}
            onChange={(event) => changeFarm(event.target.value)}
            disabled={farmsQuery.isPending || farmsQuery.isError}
          >
            <option value="">All farms</option>
            {farmsQuery.data?.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Field
          <select
            className="mt-1 block min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={fieldId}
            onChange={(event) => changeField(event.target.value)}
            disabled={fieldsQuery.isPending || fieldsQuery.isError}
          >
            <option value="">All fields</option>
            {fieldsQuery.data
              ?.filter((field) => !farmId || field.farm_id === farmId)
              .map((field) => (
                <option key={field.id} value={field.id}>
                  {field.farm_name} — {field.name}
                </option>
              ))}
          </select>
        </label>
        {(fieldsQuery.isError || farmsQuery.isError) && (
          <p className="self-end pb-2 text-sm text-rose-700" role="alert">
            {fieldsQuery.isError
              ? "Your fields could not be loaded for filtering."
              : "Your farms could not be loaded for filtering."}
          </p>
        )}
      </section>

      {historyQuery.isPending && <StatusPanel>Loading saved analyses…</StatusPanel>}
      {historyQuery.isError && (
        <StatusPanel title="Could not load analysis history">
          <p>{historyQuery.error.message}</p>
          <button
            className="mt-4 rounded-xl border border-slate-200 px-4 py-2 font-semibold"
            onClick={() => void historyQuery.refetch()}
          >
            Retry
          </button>
        </StatusPanel>
      )}
      {historyQuery.data?.items.length === 0 && (
        <StatusPanel title="No saved analyses">
          Choose “Save this result to Analysis History” before running a disease, soil, or crop
          analysis.
        </StatusPanel>
      )}
      <div className="space-y-4">
        {historyQuery.data?.items.map((analysis) => {
          const field = analysis.field_id ? fieldsById.get(analysis.field_id) : undefined;
          return (
            <article
              key={analysis.id}
              className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    {analysis.analysis_type}
                  </span>
                  <h2 className="mt-3 text-lg font-bold text-slate-800">
                    {analysisSummary(analysis.analysis_type, analysis.result)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(analysis.created_at).toLocaleString()}
                  </p>
                  {analysis.field_id && (
                    <p className="mt-2 text-sm text-slate-600">
                      Field:{" "}
                      {field ? (
                        <Link
                          to="/farms/$farmId"
                          params={{ farmId: field.farm_id }}
                          hash={`field-${field.id}`}
                          className="font-semibold text-emerald-800 underline"
                        >
                          {field.farm_name} — {field.name}
                        </Link>
                      ) : (
                        "Association unavailable"
                      )}
                    </p>
                  )}
                </div>
              </div>
              <AnalysisResultCard
                analysisType={analysis.analysis_type}
                result={analysis.result}
              />
              <details className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-900">
                  View complete stored result
                </summary>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Object.entries(analysis.result).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {key.replaceAll("_", " ")}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          );
        })}
      </div>
      {historyQuery.data && historyQuery.data.items.length > 0 && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Analysis history pages"
        >
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={offset === 0 || historyQuery.isFetching}
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Showing {offset + 1}–{offset + historyQuery.data.items.length}
          </span>
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={!historyQuery.data.has_more || historyQuery.isFetching}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

function StatusPanel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
      {title && <h2 className="mb-2 font-bold text-slate-800">{title}</h2>}
      {children}
    </div>
  );
}

function analysisSummary(type: AnalysisType, result: Record<string, unknown>): string {
  if (type === "disease") return stringValue(result.disease) ?? "Disease analysis";
  if (type === "soil") return stringValue(result.soil_type) ?? "Soil analysis";
  const recommendations = result.recommendations;
  if (
    Array.isArray(recommendations) &&
    recommendations[0] &&
    typeof recommendations[0] === "object"
  ) {
    const first = recommendations[0] as Record<string, unknown>;
    return `Crop recommendation: ${stringValue(first.crop) ?? stringValue(result.recommended_crop) ?? "result"}`;
  }
  return `Crop recommendation: ${stringValue(result.recommended_crop) ?? "result"}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatValue(value: unknown): string {
  if (value === null || typeof value !== "object") return String(value);
  return JSON.stringify(value, null, 2);
}

function AnalysisResultCard({
  analysisType,
  result,
}: {
  analysisType: AnalysisType;
  result: Record<string, unknown>;
}) {
  if (analysisType === "disease") {
    return <DiseaseResultCard result={result} />;
  }
  if (analysisType === "soil") {
    return <SoilResultCard result={result} />;
  }
  if (analysisType === "crop") {
    return <CropResultCard result={result} />;
  }
  return null;
}

function DiseaseResultCard({ result }: { result: Record<string, unknown> }) {
  const disease = stringValue(result.disease);
  const confidence = numberValue(result.confidence);
  const isHealthy = result.is_healthy === true;
  const treatments = arrayValue(result.treatments);
  const top3 = result.top3;
  const top3Predictions =
    Array.isArray(top3) && top3.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      ? top3
      : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900">
            {disease || "Disease analysis result"}
          </h3>
          {confidence !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">Confidence</span>
                <span className="font-bold text-emerald-700">{confidence.toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, confidence)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            isHealthy
              ? "bg-green-100 text-green-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {isHealthy ? "Healthy" : "Disease Detected"}
        </span>
      </div>

      {treatments && treatments.length > 0 && !isHealthy && (
        <div className="mb-4 rounded-xl bg-amber-50 p-4">
          <h4 className="mb-2 text-sm font-bold text-amber-900">Recommended Treatments</h4>
          <ul className="space-y-1.5">
            {treatments.map((treatment, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-amber-900">
                <span className="shrink-0">•</span>
                <span>{treatment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {top3Predictions.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-slate-700">Top Predictions</h4>
          <div className="space-y-2">
            {top3Predictions.slice(0, 3).map((pred, idx) => {
              const label = stringValue(pred.label);
              const conf = numberValue(pred.confidence);
              if (!label || conf === null) return null;
              return (
                <div key={idx} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{label}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-600">
                      {conf.toFixed(1)}%
                    </span>
                  </div>
                  <div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, conf)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SoilResultCard({ result }: { result: Record<string, unknown> }) {
  const soilType = stringValue(result.soil_type);
  const confidence = numberValue(result.confidence);
  const description = stringValue(result.description);
  const properties = result.properties;
  const propertiesList =
    typeof properties === "object" && properties !== null
      ? Object.entries(properties as Record<string, unknown>)
      : [];
  const top3 = result.top3;
  const top3Predictions =
    Array.isArray(top3) && top3.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      ? top3
      : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">
          {soilType || "Soil analysis result"}
        </h3>
        {confidence !== null && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-600">Confidence</span>
              <span className="font-bold text-emerald-700">{confidence.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, confidence)}%` }}
              />
            </div>
          </div>
        )}
        {description && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
        )}
      </div>

      {propertiesList.length > 0 && (
        <div className="mb-4 rounded-xl bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-bold text-blue-900">Soil Properties</h4>
          <dl className="space-y-1.5">
            {propertiesList.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 text-sm">
                <dt className="font-medium text-blue-900">
                  {String(key).replaceAll("_", " ")}:
                </dt>
                <dd className="font-semibold text-blue-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {top3Predictions.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-slate-700">Alternative Classifications</h4>
          <div className="space-y-2">
            {top3Predictions.slice(0, 3).map((pred, idx) => {
              const label = stringValue(pred.label);
              const conf = numberValue(pred.confidence);
              if (!label || conf === null) return null;
              return (
                <div key={idx} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{label}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-600">
                      {conf.toFixed(1)}%
                    </span>
                  </div>
                  <div className="ml-8 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(100, conf)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CropResultCard({ result }: { result: Record<string, unknown> }) {
  const recommendedCrop = stringValue(result.recommended_crop);
  const confidence = numberValue(result.confidence);
  const recommendations = result.recommendations;
  const recommendationsList =
    Array.isArray(recommendations) &&
    recommendations.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      ? recommendations
      : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">
          {recommendedCrop || "Crop recommendation result"}
        </h3>
        {confidence !== null && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-600">Confidence</span>
              <span className="font-bold text-emerald-700">{confidence.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, confidence)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {recommendationsList.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-slate-700">Top Crop Recommendations</h4>
          <div className="space-y-3">
            {recommendationsList.slice(0, 5).map((rec, idx) => {
              const crop = stringValue(rec.crop);
              const conf = numberValue(rec.confidence);
              const reason = stringValue(rec.reason);
              if (!crop) return null;
              return (
                <div key={idx} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                        {idx + 1}
                      </span>
                      <span className="text-base font-bold text-slate-900">{crop}</span>
                    </div>
                    {conf !== null && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        {conf.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {reason && (
                    <p className="ml-9 text-sm text-slate-600">{reason}</p>
                  )}
                  {conf !== null && (
                    <div className="ml-9 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, conf)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function numberValue(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return isNaN(num) ? null : num;
}

function arrayValue(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length > 0 ? strings : null;
}

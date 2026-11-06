import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionHeader, TabWrapper } from "./Shell";
import { useAgri } from "@/lib/agri-store";
import { TRANSLATIONS } from "@/lib/i18n";
import {
  CROP_EXAMPLE_VALUES,
  CROP_FIELDS,
  CROP_INPUT_LIMITS,
  validateCropValues,
  type CropField,
  type CropFieldErrors,
  type CropFieldValues,
} from "@/lib/crop-validation";
import { recommendCrop, type CropInput, type CropRecommendationResult } from "@/lib/api";
import { AnalysisSaveOptions } from "@/components/analysis/AnalysisSaveOptions";

export function CropTab() {
  const { lang, crops, setCrops } = useAgri();
  const t = TRANSLATIONS[lang]?.crop ?? TRANSLATIONS.en.crop;
  const [values, setValues] = useState<CropFieldValues>({ ...CROP_EXAMPLE_VALUES });
  const [editedFields, setEditedFields] = useState<Set<CropField>>(new Set());
  const [errors, setErrors] = useState<CropFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<CropRecommendationResult | null>(null);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [fieldId, setFieldId] = useState("");

  const labels: Record<CropField, string> = {
    N: t.n,
    P: t.p,
    K: t.k,
    temperature: t.temperature,
    humidity: t.humidity,
    ph: t.ph,
    rainfall: t.rainfall,
  };

  const helpers: Record<CropField, string> = {
    N: t.helpNutrients,
    P: t.helpNutrients,
    K: t.helpNutrients,
    temperature: t.helpTemperature,
    humidity: t.helpHumidity,
    ph: t.helpPh,
    rainfall: t.helpRainfall,
  };

  const setField = (field: CropField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setEditedFields((current) => new Set(current).add(field));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setApiError(null);
    setResultInfo(null);
    setCrops(null);
  };

  const resetForm = () => {
    setValues({ ...CROP_EXAMPLE_VALUES });
    setEditedFields(new Set());
    setErrors({});
    setApiError(null);
    setResultInfo(null);
    setCrops(null);
  };

  const fieldError = (field: CropField) => {
    const error = errors[field];
    if (!error) return null;
    if (error === "required") return t.required;
    if (error === "number") return t.invalidNumber;
    const { min, max } = CROP_INPUT_LIMITS[field];
    return t.outOfRange.replace("{min}", String(min)).replace("{max}", String(max));
  };

  const renderField = (field: CropField, step = "0.1") => {
    const error = fieldError(field);
    const helpId = `crop-${field}-help`;
    const errorId = `crop-${field}-error`;

    return (
      <div key={field}>
        <label
          htmlFor={`crop-${field}`}
          className="mb-2 block text-[10px] font-bold uppercase tracking-widest opacity-70"
        >
          {labels[field]}
        </label>
        <input
          id={`crop-${field}`}
          type="number"
          step={step}
          min={CROP_INPUT_LIMITS[field].min}
          max={CROP_INPUT_LIMITS[field].max}
          value={values[field]}
          aria-invalid={Boolean(error)}
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
          onChange={(event) => setField(field, event.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive"
        />
        <p id={helpId} className="mt-1 text-[11px] leading-relaxed text-foreground/60">
          {helpers[field]}
        </p>
        <p className="mt-1 text-[10px] font-medium text-primary">
          {editedFields.has(field) ? t.manualSource : t.exampleSource}
        </p>
        {error && (
          <p id={errorId} className="mt-1 text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const validationErrors = validateCropValues(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const input: CropInput = {
      N: Number(values.N),
      P: Number(values.P),
      K: Number(values.K),
      temperature: Number(values.temperature),
      humidity: Number(values.humidity),
      ph: Number(values.ph),
      rainfall: Number(values.rainfall),
    };

    setLoading(true);
    setApiError(null);
    setResultInfo(null);
    setCrops(null);
    try {
      const result = await recommendCrop(input, lang, {
        saveToHistory,
        fieldId: fieldId || undefined,
      });
      setCrops(result.recommendations);
      setResultInfo(result);
    } catch (error) {
      console.error("Crop recommendation request failed:", error);
      setApiError(error instanceof Error ? `${t.requestFailed} ${error.message}` : t.requestFailed);
    } finally {
      setLoading(false);
    }
  };

  const safeCrops = Array.isArray(crops) ? crops : [];
  const sourceLabel =
    resultInfo?.modelSource === "catboost"
      ? t.catboostSource
      : resultInfo?.modelSource === "centroid_fallback"
        ? t.fallbackSource
        : t.unknownSource;
  const scoreLabel =
    resultInfo?.scoreKind === "model_class_score"
      ? t.modelScore
      : resultInfo?.scoreKind === "profile_similarity_share"
        ? t.profileScore
        : t.unknownScore;
  const scoreNote =
    resultInfo?.scoreKind === "model_class_score"
      ? t.scoreNoteCatboost
      : resultInfo?.scoreKind === "profile_similarity_share"
        ? t.scoreNoteFallback
        : t.scoreNoteUnknown;
  const explanation =
    resultInfo?.modelSource === "catboost"
      ? t.explanationCatboost
      : resultInfo?.modelSource === "centroid_fallback"
        ? t.explanationFallback
        : t.explanationUnknown;
  const hasExampleInputs = CROP_FIELDS.some((field) => !editedFields.has(field));

  return (
    <TabWrapper>
      <SectionHeader title={t.title} subtitle={t.subtitle} />

      <div className="rounded-3xl border border-border bg-sage-soft/40 p-5 sm:p-8">
        <div className="grid gap-10 md:grid-cols-2">
          <form noValidate onSubmit={(event) => void submit(event)} className="space-y-6">
            <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed text-foreground/70">
              {t.exampleDataNote}
            </p>
            <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed text-foreground/70">
              {t.weatherNote} {t.rainfallPeriodNote}
            </p>
            <AnalysisSaveOptions
              saveToHistory={saveToHistory}
              onSaveToHistoryChange={setSaveToHistory}
              fieldId={fieldId}
              onFieldIdChange={setFieldId}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {renderField("N")}
              {renderField("P")}
              {renderField("K")}
              {renderField("temperature")}
              {renderField("humidity")}
              {renderField("ph")}
              {renderField("rainfall")}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold tracking-tight text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t.submitting}
                  </>
                ) : (
                  t.submit
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-card/80 disabled:opacity-60"
              >
                {t.reset}
              </button>
            </div>
          </form>

          <section aria-labelledby="crop-results-heading" aria-live="polite" className="space-y-3">
            <h3
              id="crop-results-heading"
              className="text-sm font-bold uppercase tracking-widest text-foreground/70"
            >
              {t.recommended}
            </h3>
            {resultInfo?.analysis_id && (
              <p
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                role="status"
              >
                Result saved.{" "}
                <Link to="/history" className="font-semibold underline">
                  View analysis history
                </Link>
              </p>
            )}

            {apiError && (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm"
              >
                <p>{apiError}</p>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={loading}
                  className="mt-3 rounded-xl border border-border px-4 py-2 font-semibold hover:bg-sage-soft disabled:opacity-60"
                >
                  {loading ? t.submitting : t.retry}
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t.submitting}
                </span>
              </div>
            ) : apiError ? null : safeCrops.length === 0 ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-foreground/60">
                {apiError ? t.requestFailed : resultInfo ? t.emptyResults : t.idleResults}
              </div>
            ) : (
              <>
                <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed">
                  <strong>{t.modelSource}: </strong>
                  {sourceLabel}
                  <br />
                  <strong>{scoreLabel}: </strong>
                  {scoreNote}
                </p>
                <ol className="space-y-3">
                  {safeCrops.map((crop, index) => {
                    const percentage = Math.max(0, Math.min(100, Number(crop.probability) * 100));
                    const cropName = String(crop.crop || "Unknown");
                    return (
                      <li
                        key={`${cropName.toLocaleLowerCase()}-${index}`}
                        className="rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-base font-bold capitalize">
                            <span className="mr-2 text-xs font-normal text-foreground/60">
                              {t.rank} {index + 1}
                            </span>
                            {cropName}
                          </h4>
                          <span className="font-mono text-xs font-bold">
                            {scoreLabel}: {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="mb-3 h-1.5 w-full rounded-full bg-sage-soft"
                          aria-label={`${scoreLabel} ${percentage.toFixed(1)}%`}
                          role="img"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs leading-relaxed text-foreground/70">{explanation}</p>
                      </li>
                    );
                  })}
                </ol>
                <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed">
                  {t.factorsUnavailable}
                </p>
                {hasExampleInputs && (
                  <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed">
                    {t.exampleResultWarning}
                  </p>
                )}
                {resultInfo?.tip && (
                  <p className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed">
                    <strong>{t.tipLabel}: </strong>
                    {resultInfo.tip}
                    <br />
                    {t.tipEnglish}
                  </p>
                )}
                {resultInfo?.inputWarnings.length ? (
                  <div className="rounded-xl border border-border bg-card/70 p-3 text-xs leading-relaxed">
                    <strong>{t.inputWarnings}</strong>
                    <ul className="mt-1 list-inside list-disc">
                      {resultInfo.inputWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </TabWrapper>
  );
}

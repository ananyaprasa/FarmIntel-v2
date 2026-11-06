import { useRef, useState } from "react";
import { toast } from "sonner";
import { SectionHeader, TabWrapper } from "./Shell";
import { ImageDrop } from "./ImageDrop";
import { ConfidenceBar } from "./ConfidenceBar";
import { useAgri } from "@/lib/agri-store";
import { TRANSLATIONS } from "@/lib/i18n";
import { analyzeSoil } from "@/lib/api";
import { AnalysisSaveOptions } from "@/components/analysis/AnalysisSaveOptions";

export function SoilTab() {
  const { lang, soil, setSoil } = useAgri();
  const t = TRANSLATIONS[lang].soil;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [fieldId, setFieldId] = useState("");
  const requestInProgress = useRef(false);

  const onFile = async (f: File) => {
    if (requestInProgress.current) return;
    setSoil(null);
    setError(null);

    if (f.size === 0) {
      setError(t.emptyUpload);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(t.tooLargeUpload);
      return;
    }

    requestInProgress.current = true;
    setLoading(true);
    try {
      const res = await analyzeSoil(f, lang, {
        saveToHistory,
        fieldId: fieldId || undefined,
      });
      setSoil(res);
      if (res.analysis_id) toast.success("Analysis saved to history.");
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : t.error;
      setError(message);
      toast.error(message);
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  };

  const props = soil?.properties ? Object.entries(soil.properties) : [];

  return (
    <TabWrapper>
      <SectionHeader title={t.title} subtitle={t.subtitle} workflowId={t.workflowId} />

      <div className="mb-5">
        <AnalysisSaveOptions
          saveToHistory={saveToHistory}
          onSaveToHistoryChange={setSaveToHistory}
          fieldId={fieldId}
          onFieldIdChange={setFieldId}
        />
      </div>

      <p className="mb-5 text-sm text-foreground/60">{t.uploadGuidance}</p>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ImageDrop
            title={t.dropTitle}
            hint={t.dropHint}
            cta={t.select}
            loading={loading}
            disabled={loading}
            previewAlt="Selected soil photo"
            onFile={onFile}
            onClear={() => {
              setSoil(null);
              setError(null);
            }}
          />
          {loading ? (
            <p className="mt-3 text-sm text-foreground/60" role="status">
              Analyzing the uploaded soil photo…
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-3">
              <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {t.result}
              </span>
              <div className="text-right">
                <span className="block font-mono text-[24px] font-bold text-primary">
                  {soil ? (soil.confidence * 100).toFixed(1) : "—"}
                  <span className="text-sm">%</span>
                </span>
                <span className="text-[10px] uppercase tracking-tighter opacity-40">
                  {t.modelScore} · {t.notCalibrated}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold">{soil?.soil_type ?? "—"}</h3>
            </div>

            <ConfidenceBar label={t.modelScore} value={soil?.confidence ?? 0} />
          </div>

          {props.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">
                {t.generalInfo}
              </h4>
              <dl className="space-y-2">
                {props.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="truncate capitalize text-foreground/70">
                      {k.replace(/_/g, " ")}
                    </dt>
                    <dd className="font-mono text-xs font-semibold text-primary">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {soil?.top_predictions?.length ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">
                {t.otherScores}
              </h4>
              <ul className="space-y-2 text-sm">
                {soil.top_predictions
                  .filter((prediction) => prediction.label !== soil.soil_type)
                  .map((prediction) => (
                    <li key={prediction.label} className="flex justify-between gap-3">
                      <span>{prediction.label}</span>
                      <span className="font-mono">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-foreground/70">
            <h4 className="mb-2 font-semibold text-foreground">{t.disclaimerTitle}</h4>
            <p>{t.disclaimerVisual}</p>
            <p className="mt-2">{t.disclaimerCrop}</p>
          </div>
        </div>
      </div>
    </TabWrapper>
  );
}

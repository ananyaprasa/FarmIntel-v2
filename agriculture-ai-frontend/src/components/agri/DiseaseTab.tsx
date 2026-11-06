import { useState } from "react";
import { toast } from "sonner";
import { SectionHeader, TabWrapper } from "./Shell";
import { ImageDrop } from "./ImageDrop";
import { ConfidenceBar } from "./ConfidenceBar";
import { useAgri } from "@/lib/agri-store";
import { TRANSLATIONS } from "@/lib/i18n";
import { analyzeDisease } from "@/lib/api";
import { AnalysisSaveOptions } from "@/components/analysis/AnalysisSaveOptions";

export function DiseaseTab() {
  const { lang, disease, setDisease } = useAgri();
  const t = TRANSLATIONS[lang].disease;
  const [loading, setLoading] = useState(false);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [fieldId, setFieldId] = useState("");

  const urgencyLabel = (u?: string) => {
    if (u === "high") return t.urgencyHigh;
    if (u === "low") return t.urgencyLow;
    return t.urgencyMid;
  };
  const urgencyPct = (u?: string) =>
    u === "high" ? 0.95 : u === "low" ? 0.3 : 0.66;

  const onFile = async (f: File) => {
    setLoading(true);
    try {
      const res = await analyzeDisease(f, lang, {
        saveToHistory,
        fieldId: fieldId || undefined,
      });
      setDisease(res);
      if (res.analysis_id) toast.success("Analysis saved to history.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TabWrapper>
      <SectionHeader
        title={t.title}
        subtitle={t.subtitle}
        workflowId={t.workflowId}
      />

      <div className="mb-5">
        <AnalysisSaveOptions
          saveToHistory={saveToHistory}
          onSaveToHistoryChange={setSaveToHistory}
          fieldId={fieldId}
          onFieldIdChange={setFieldId}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ImageDrop
            title={t.dropTitle}
            hint={t.dropHint}
            cta={t.select}
            loading={loading}
            onFile={onFile}
            onClear={() => setDisease(null)}
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-3">
              <span className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                {t.result}
              </span>
              <div className="text-right">
                <span className="block font-mono text-[24px] font-bold text-primary">
                  {disease
                    ? (disease.confidence * 100).toFixed(1)
                    : "—"}
                  <span className="text-sm">%</span>
                </span>
                <span className="text-[10px] uppercase tracking-tighter opacity-40">
                  {t.confidence}
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold">
                {disease?.disease ?? "—"}
              </h3>
              {disease?.scientific_name && (
                <p className="mt-1 font-mono text-xs italic text-foreground/50">
                  {disease.scientific_name}
                </p>
              )}
            </div>

            <ConfidenceBar
              label={t.urgency}
              value={disease ? urgencyPct(disease.urgency) : 0}
              valueLabel={disease ? urgencyLabel(disease.urgency) : "—"}
              tone="accent"
            />
          </div>

          {disease?.treatment ? (
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-70">
                {t.action}
              </h4>
              <p className="text-sm leading-relaxed text-sage-soft">
                {disease.treatment}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </TabWrapper>
  );
}

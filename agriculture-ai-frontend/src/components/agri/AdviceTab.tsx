import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Square } from "lucide-react";
import { SectionHeader, TabWrapper } from "./Shell";
import { useAgri } from "@/lib/agri-store";
import { TRANSLATIONS } from "@/lib/i18n";
import { streamAdvice } from "@/lib/api";

export function AdviceTab() {
  const { lang, disease, soil, crops } = useAgri();
  const t = TRANSLATIONS[lang].advice;
  const [question, setQuestion] = useState("");
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasContext = Boolean(disease || soil || (crops && crops.length));

  const start = async () => {
    if (streaming) return;
    setStreaming(true);
    setText("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamAdvice(
        { question: question.trim() || undefined, disease, soil, crop: crops, lang },
        (chunk) => setText((s) => s + chunk),
        ctrl.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error(t.error);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <TabWrapper>
      <SectionHeader title={t.title} subtitle={t.subtitle} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-border bg-sage-soft/50 p-5">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">
              {t.context}
            </h4>
            {!hasContext ? (
              <p className="text-sm text-foreground/50">{t.noContext}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {disease && (
                  <ContextRow
                    k="Disease"
                    v={`${disease.disease} · ${(disease.confidence * 100).toFixed(0)}%`}
                  />
                )}
                {soil && (
                  <ContextRow
                    k="Soil"
                    v={`${soil.soil_type} · ${(soil.confidence * 100).toFixed(0)}%`}
                  />
                )}
                {crops && crops[0] && (
                  <ContextRow
                    k="Top crop"
                    v={`${crops[0].crop} · ${(crops[0].probability * 100).toFixed(0)}%`}
                  />
                )}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest opacity-60">
              {t.ask}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.placeholder}
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={start}
                disabled={streaming}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform hover:scale-[1.01] disabled:opacity-60"
              >
                {streaming ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t.streaming}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> {t.ask}
                  </>
                )}
              </button>
              {streaming && (
                <button
                  onClick={stop}
                  className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground/70 transition hover:bg-sage-soft"
                  aria-label="Stop"
                >
                  <Square className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="min-h-[400px] rounded-3xl border border-border bg-card p-6 shadow-sm">
            {text ? (
              <FormattedAdvice text={text} streaming={streaming} />
            ) : (
              <div className="grid h-full min-h-[340px] place-items-center text-center">
                <div className="max-w-xs text-sm text-foreground/40">
                  <Sparkles className="mx-auto mb-3 size-8 text-primary/40" />
                  {t.placeholder}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TabWrapper>
  );
}

function ContextRow({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider opacity-50">
        {k}
      </span>
      <span className="truncate font-mono text-xs">{v}</span>
    </li>
  );
}

function FormattedAdvice({ text, streaming }: { text: string; streaming: boolean }) {
  const lines = text.split("\n");

  const renderInline = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={i} className="font-semibold text-primary">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const blocks: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2.5 space-y-2 pl-1">
          {currentList}
        </ul>,
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Header standalone line e.g. **Summary:** or ## Summary
    const headerMatch = trimmed.match(/^(?:#{1,3}\s*|\*\*)([^*:]+)(?:\*\*:?|:)?$/i);
    const isHeaderLine =
      Boolean(headerMatch) && !trimmed.startsWith("- ") && !trimmed.startsWith("* ");

    if (isHeaderLine && headerMatch) {
      flushList();
      const headerTitle = headerMatch[1].trim();
      const badge = getBadgeStyle(headerTitle);

      blocks.push(
        <div key={`h-${index}`} className="mt-5 mb-2 first:mt-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${badge.color}`}
          >
            <span>{badge.icon}</span>
            <span>{headerTitle}</span>
          </span>
        </div>,
      );
      return;
    }

    // Bullet points
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      currentList.push(
        <li
          key={`li-${index}`}
          className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
        >
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
          <span>{renderInline(bulletMatch[1])}</span>
        </li>,
      );
      return;
    }

    // Inline header e.g. **Summary:** Rest of the sentence
    const inlineHeaderMatch = trimmed.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    if (inlineHeaderMatch) {
      flushList();
      const title = inlineHeaderMatch[1].trim();
      const rest = inlineHeaderMatch[2].trim();
      const badge = getBadgeStyle(title);

      blocks.push(
        <div key={`inline-${index}`} className="mt-4 mb-2 first:mt-0 space-y-2">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${badge.color}`}
            >
              <span>{badge.icon}</span>
              <span>{title}</span>
            </span>
          </div>
          {rest && (
            <p className="text-sm leading-relaxed text-foreground/90 pl-0.5">
              {renderInline(rest)}
            </p>
          )}
        </div>,
      );
      return;
    }

    // Regular text paragraph
    flushList();
    blocks.push(
      <p key={`p-${index}`} className="my-2 text-sm leading-relaxed text-foreground/90">
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();

  return (
    <div className="space-y-1">
      {blocks}
      {streaming && (
        <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
      )}
    </div>
  );
}

function getBadgeStyle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("warning") || lower.includes("caution")) {
    return {
      color: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
      icon: "⚠️",
    };
  }
  if (lower.includes("action") || lower.includes("immediate")) {
    return {
      color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
      icon: "⚡",
    };
  }
  if (lower.includes("crop") || lower.includes("recommend")) {
    return {
      color: "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400",
      icon: "🌾",
    };
  }
  if (lower.includes("soil")) {
    return {
      color: "bg-amber-700/10 text-amber-800 border-amber-700/20 dark:text-amber-300",
      icon: "🪨",
    };
  }
  if (lower.includes("summary")) {
    return {
      color: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
      icon: "📋",
    };
  }
  return {
    color: "bg-primary/10 text-primary border-primary/20",
    icon: "📌",
  };
}

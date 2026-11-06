export function ConfidenceBar({
  label,
  value,
  valueLabel,
  tone = "primary",
}: {
  label: string;
  value: number; // 0..1
  valueLabel?: string;
  tone?: "primary" | "accent";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px] font-medium uppercase tracking-wide opacity-60">
        <span>{label}</span>
        <span>{valueLabel ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-soft">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            tone === "accent" ? "bg-accent" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

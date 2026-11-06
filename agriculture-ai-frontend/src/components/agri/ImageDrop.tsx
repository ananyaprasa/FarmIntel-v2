import { useRef, useState, type DragEvent } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";

export function ImageDrop({
  title,
  hint,
  cta,
  loading,
  disabled = false,
  previewAlt = "Image preview",
  onFile,
  onClear,
}: {
  title: string;
  hint: string;
  cta: string;
  loading?: boolean;
  disabled?: boolean;
  previewAlt?: string;
  onFile: (f: File) => void;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = (f: File) => {
    if (disabled) return;
    setPreview(URL.createObjectURL(f));
    onFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) handle(f);
  };

  const clear = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  return (
    <div className="group">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed p-6 text-center transition-all sm:p-8 ${
          dragOver
            ? "border-primary bg-sage-mid"
            : "border-sage-mid bg-sage-soft group-hover:border-primary/40"
        }`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt={previewAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {loading ? (
              <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <button
                onClick={clear}
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-105"
                aria-label="Clear"
              >
                <X className="size-4" />
              </button>
            )}
          </>
        ) : (
          <div className="relative z-10">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border border-border bg-white shadow-sm transition-transform duration-300 group-hover:scale-105">
              {loading ? (
                <Loader2 className="size-7 animate-spin text-primary" />
              ) : (
                <UploadCloud className="size-7 text-primary" />
              )}
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-xs text-foreground/50">{hint}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/10 transition-colors hover:bg-primary/90"
            >
              {cta}
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
      </div>
    </div>
  );
}

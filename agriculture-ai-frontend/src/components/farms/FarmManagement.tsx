import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPinned, Sprout, Trash2, Activity, AlertCircle, TrendingUp } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  createFarm,
  createFarmField,
  deleteFarm,
  deleteFarmField,
  FarmApiError,
  getFarm,
  listFarmFields,
  listFarms,
  listAnalyses,
  startGoogleSignIn,
  updateFarm,
  updateFarmField,
  type Farm,
  type FarmField,
  type FarmFieldInput,
  type FarmInput,
  type FieldAreaUnit,
  type Analysis,
} from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60";

export function FarmsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState("");
  const farmsQuery = useQuery({
    queryKey: ["farms"],
    queryFn: listFarms,
    enabled: auth.status === "authenticated",
  });
  const createMutation = useMutation({
    mutationFn: createFarm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      setSuccess("Farm created.");
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FarmInput }) => updateFarm(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      setSuccess("Farm updated.");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFarm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      setSuccess("Farm deleted.");
    },
  });

  if (auth.status !== "authenticated") return <FarmAccessState />;

  return (
    <section className="space-y-6">
      <PageHeading
        eyebrow="Farm management"
        title="Your farms"
        description="Keep your farm details and field records organized in one place."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="h-fit rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-800">Add a farm</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start with a name. Location and notes are optional.
          </p>
          <FarmForm
            submitLabel="Create farm"
            pending={createMutation.isPending}
            onSubmit={(input) => {
              setSuccess("");
              createMutation.mutate(input);
            }}
          />
          <ErrorNotice error={createMutation.error} />
          {success && (
            <p className="mt-3 text-sm text-emerald-700" role="status">
              {success}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Farm list</h2>
              <p className="mt-1 text-sm text-slate-500">
                Only farms associated with your account are shown.
              </p>
            </div>
            {farmsQuery.data && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {farmsQuery.data.length} {farmsQuery.data.length === 1 ? "farm" : "farms"}
              </span>
            )}
          </div>

          {farmsQuery.isPending && <LoadingCard label="Loading your farms…" />}
          <ErrorNotice error={farmsQuery.error} />
          {farmsQuery.isError && <RetryButton onClick={() => void farmsQuery.refetch()} />}
          {farmsQuery.data?.length === 0 && (
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-white/60 p-8 text-center">
              <Sprout className="mx-auto size-8 text-emerald-700" />
              <h3 className="mt-3 font-semibold text-slate-800">No farms yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your first farm to add its fields.
              </p>
            </div>
          )}
          {farmsQuery.data?.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              onUpdate={(input) => updateMutation.mutate({ id: farm.id, input })}
              onDelete={() => {
                if (window.confirm(`Delete "${farm.name}" and its fields?`)) {
                  deleteMutation.mutate(farm.id);
                }
              }}
              updatePending={updateMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          ))}
          <ErrorNotice error={updateMutation.error} />
          <ErrorNotice error={deleteMutation.error} />
        </section>
      </div>
    </section>
  );
}

export function FarmDetailPage({ farmId }: { farmId: string }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [success, setSuccess] = useState("");
  const farmQuery = useQuery({
    queryKey: ["farms", farmId],
    queryFn: () => getFarm(farmId),
    enabled: auth.status === "authenticated",
  });
  const fieldsQuery = useQuery({
    queryKey: ["farms", farmId, "fields"],
    queryFn: () => listFarmFields(farmId),
    enabled: auth.status === "authenticated",
  });
  const analysesQuery = useQuery({
    queryKey: ["farms", farmId, "analyses"],
    queryFn: () => listAnalyses({ limit: 100, offset: 0, farmId }),
    enabled: auth.status === "authenticated",
  });
  const createFieldMutation = useMutation({
    mutationFn: (input: FarmFieldInput) => createFarmField(farmId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["farms", farmId, "fields"],
      });
      setSuccess("Field created.");
    },
  });
  const updateFarmMutation = useMutation({
    mutationFn: (input: FarmInput) => updateFarm(farmId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["farms", farmId] });
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      setSuccess("Farm updated.");
    },
  });
  const deleteFarmMutation = useMutation({
    mutationFn: deleteFarm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      await navigate({ to: "/farms" });
    },
  });
  const updateFieldMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FarmFieldInput }) =>
      updateFarmField(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["farms", farmId, "fields"],
      });
      setSuccess("Field updated.");
    },
  });
  const deleteFieldMutation = useMutation({
    mutationFn: deleteFarmField,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["farms", farmId, "fields"],
      });
      setSuccess("Field deleted.");
    },
  });

  if (auth.status !== "authenticated") return <FarmAccessState />;

  return (
    <section className="space-y-6">
      <Link
        to="/farms"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
      >
        <ArrowLeft className="size-4" />
        All farms
      </Link>

      {farmQuery.isPending && <LoadingCard label="Loading farm…" />}
      <ErrorNotice error={farmQuery.error} />
      {farmQuery.isError && <RetryButton onClick={() => void farmQuery.refetch()} />}
      {farmQuery.data && (
        <>
          <PageHeading
            eyebrow="Farm details"
            title={farmQuery.data.name}
            description={farmQuery.data.location || "Manage this farm and its fields."}
          />

          <FarmOverview
            farm={farmQuery.data}
            fields={fieldsQuery.data || []}
            analyses={analysesQuery.data?.items || []}
            isLoading={fieldsQuery.isPending || analysesQuery.isPending}
          />

          {(fieldsQuery.data || analysesQuery.data) && (
            <>
              <CropInventorySection
                analyses={analysesQuery.data?.items || []}
                fields={fieldsQuery.data || []}
                isLoading={analysesQuery.isPending}
              />
              <FieldHealthSection
                fields={fieldsQuery.data || []}
                analyses={analysesQuery.data?.items || []}
                farmId={farmId}
                isLoading={fieldsQuery.isPending || analysesQuery.isPending}
              />
            </>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Farm information</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {formatDate(farmQuery.data.created_at)}
                    </p>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    type="button"
                    disabled={deleteFarmMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(`Delete "${farmQuery.data.name}" and all of its fields?`)
                      ) {
                        deleteFarmMutation.mutate(farmId);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </div>
                <FarmForm
                  key={farmQuery.data.id}
                  initial={farmQuery.data}
                  submitLabel="Save farm"
                  pending={updateFarmMutation.isPending}
                  onSubmit={(input) => updateFarmMutation.mutate(input)}
                />
                <ErrorNotice error={updateFarmMutation.error} />
                <ErrorNotice error={deleteFarmMutation.error} />
                {success && (
                  <p className="mt-3 text-sm text-emerald-700" role="status">
                    {success}
                  </p>
                )}
              </section>

              <section className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-800">Add a field</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add the field name and any available details.
                </p>
                <FieldForm
                  submitLabel="Create field"
                  pending={createFieldMutation.isPending}
                  onSubmit={(input) => createFieldMutation.mutate(input)}
                />
                <ErrorNotice error={createFieldMutation.error} />
              </section>
            </div>

            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Fields</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Field records stay linked to this farm.
                </p>
              </div>
              {fieldsQuery.isPending && <LoadingCard label="Loading fields…" />}
              <ErrorNotice error={fieldsQuery.error} />
              {fieldsQuery.isError && <RetryButton onClick={() => void fieldsQuery.refetch()} />}
              {fieldsQuery.data?.length === 0 && (
                <div className="rounded-3xl border border-dashed border-emerald-300 bg-white/60 p-8 text-center">
                  <MapPinned className="mx-auto size-8 text-emerald-700" />
                  <h3 className="mt-3 font-semibold text-slate-800">No fields yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add a field to begin organizing crops and soil details.
                  </p>
                </div>
              )}
              {fieldsQuery.data?.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onUpdate={(input) => updateFieldMutation.mutate({ id: field.id, input })}
                  onDelete={() => {
                    if (window.confirm(`Delete field "${field.name}"?`)) {
                      deleteFieldMutation.mutate(field.id);
                    }
                  }}
                  updatePending={updateFieldMutation.isPending}
                  deletePending={deleteFieldMutation.isPending}
                />
              ))}
              <ErrorNotice error={updateFieldMutation.error} />
              <ErrorNotice error={deleteFieldMutation.error} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function FarmAccessState() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <LoadingCard label="Checking your sign-in…" />;
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/80 bg-white/85 p-8 text-center shadow-sm">
      <Sprout className="mx-auto size-9 text-emerald-700" />
      <h1 className="mt-4 text-xl font-bold text-slate-800">
        {auth.status === "error" ? "Session unavailable" : "Sign in to manage farms"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {auth.status === "error"
          ? auth.error
          : "Farm and field records are private to your signed-in account."}
      </p>
      <button
        type="button"
        className={`${buttonClass} mt-5`}
        onClick={auth.status === "error" ? auth.retry : startGoogleSignIn}
      >
        {auth.status === "error" ? "Retry session check" : "Continue with Google"}
      </button>
    </div>
  );
}

function FarmCard({
  farm,
  onUpdate,
  onDelete,
  updatePending,
  deletePending,
}: {
  farm: Farm;
  onUpdate: (input: FarmInput) => void;
  onDelete: () => void;
  updatePending: boolean;
  deletePending: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm">
      {editing ? (
        <>
          <h3 className="font-bold text-slate-800">Edit farm</h3>
          <FarmForm
            initial={farm}
            submitLabel="Save changes"
            pending={updatePending}
            onSubmit={(input) => {
              onUpdate(input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/farms/$farmId"
                params={{ farmId: farm.id }}
                className="text-lg font-bold text-emerald-900 hover:text-emerald-700"
              >
                {farm.name}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                {farm.location || "Location not specified"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                type="button"
                disabled={deletePending}
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </div>
          </div>
          {farm.description && (
            <p className="mt-3 text-sm leading-6 text-slate-600">{farm.description}</p>
          )}
          <p className="mt-4 text-xs text-slate-400">Created {formatDate(farm.created_at)}</p>
        </>
      )}
    </article>
  );
}

function FarmForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<Farm, "name" | "description" | "location">;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: FarmInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [validationError, setValidationError] = useState("");
  const submitting = useRef(false);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending) submitting.current = false;
    wasPending.current = pending;
  }, [pending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitting.current) return;
    const normalizedName = name.trim();
    if (!normalizedName) {
      setValidationError("Farm name must not be blank.");
      return;
    }
    setValidationError("");
    submitting.current = true;
    onSubmit({
      name: normalizedName,
      description: description.trim() || null,
      location: location.trim() || null,
    });
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <label className="block text-sm font-semibold text-slate-700">
        Farm name
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          autoComplete="organization"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Location <span className="font-normal text-slate-400">(optional)</span>
        <input
          className={inputClass}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          maxLength={300}
          placeholder="Town, district, or region"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Notes <span className="font-normal text-slate-400">(optional)</span>
        <textarea
          className={inputClass}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2_000}
        />
      </label>
      {validationError && (
        <p className="text-sm text-rose-700" role="alert">
          {validationError}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button className={buttonClass} type="submit" disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className={secondaryButtonClass} type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function FieldForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: FarmField;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: FarmFieldInput) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [area, setArea] = useState(
    initial?.area === null || initial?.area === undefined ? "" : String(initial.area),
  );
  const [areaUnit, setAreaUnit] = useState(initial?.area_unit ?? "");
  const [cropType, setCropType] = useState(initial?.crop_type ?? "");
  const [soilType, setSoilType] = useState(initial?.soil_type ?? "");
  const [validationError, setValidationError] = useState("");
  const submitting = useRef(false);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending) submitting.current = false;
    wasPending.current = pending;
  }, [pending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitting.current) return;
    if (!name.trim()) {
      setValidationError("Field name must not be blank.");
      return;
    }
    const numericArea = area.trim() === "" ? null : Number(area);
    if (numericArea !== null && (!Number.isFinite(numericArea) || numericArea <= 0)) {
      setValidationError("Area must be a positive number.");
      return;
    }
    setValidationError("");
    submitting.current = true;
    onSubmit({
      name: name.trim(),
      area: numericArea,
      area_unit: parseAreaUnit(areaUnit),
      crop_type: cropType.trim() || null,
      soil_type: soilType.trim() || null,
    });
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <label className="block text-sm font-semibold text-slate-700">
        Field name
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Area <span className="font-normal text-slate-400">(optional)</span>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder="e.g. 2.5"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Area unit
          <select
            className={inputClass}
            value={areaUnit}
            onChange={(event) => setAreaUnit(event.target.value)}
          >
            <option value="">Not specified</option>
            <option value="acre">Acre</option>
            <option value="hectare">Hectare</option>
            <option value="m²">m²</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Crop type <span className="font-normal text-slate-400">(optional)</span>
          <input
            className={inputClass}
            value={cropType}
            onChange={(event) => setCropType(event.target.value)}
            maxLength={120}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Soil type <span className="font-normal text-slate-400">(optional)</span>
          <input
            className={inputClass}
            value={soilType}
            onChange={(event) => setSoilType(event.target.value)}
            maxLength={120}
          />
        </label>
      </div>
      {validationError && (
        <p className="text-sm text-rose-700" role="alert">
          {validationError}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button className={buttonClass} type="submit" disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className={secondaryButtonClass} type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function FieldCard({
  field,
  onUpdate,
  onDelete,
  updatePending,
  deletePending,
}: {
  field: FarmField;
  onUpdate: (input: FarmFieldInput) => void;
  onDelete: () => void;
  updatePending: boolean;
  deletePending: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article
      id={`field-${field.id}`}
      className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm"
    >
      {editing ? (
        <>
          <h3 className="font-bold text-slate-800">Edit {field.name}</h3>
          <FieldForm
            key={field.id}
            initial={field}
            submitLabel="Save field"
            pending={updatePending}
            onSubmit={(input) => {
              onUpdate(input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">{field.name}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {field.area === null
                  ? "Area not specified"
                  : `${field.area} ${field.area_unit ?? ""}`.trim()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                type="button"
                disabled={deletePending}
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {field.crop_type && <Tag label={`Crop: ${field.crop_type}`} />}
            {field.soil_type && <Tag label={`Soil: ${field.soil_type}`} />}
          </div>
        </>
      )}
    </article>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="rounded-3xl border border-white/70 bg-white/60 p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </header>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div
      className="rounded-2xl border border-white/80 bg-white/70 p-5 text-sm text-slate-600"
      role="status"
    >
      {label}
    </div>
  );
}

function ErrorNotice({ error }: { error: Error | null }) {
  if (!error) return null;
  const needsSignIn = error instanceof FarmApiError && error.status === 401;

  return (
    <div
      className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
      role="alert"
    >
      <p>{error.message}</p>
      {needsSignIn && (
        <button type="button" className="mt-2 font-semibold underline" onClick={startGoogleSignIn}>
          Sign in again
        </button>
      )}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={secondaryButtonClass} type="button" onClick={onClick}>
      Retry
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
      {label}
    </span>
  );
}

function parseAreaUnit(value: string): FieldAreaUnit | null {
  if (value === "acre" || value === "hectare" || value === "m²") return value;
  return null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleDateString();
}

function FarmOverview({
  farm,
  fields,
  analyses,
  isLoading,
}: {
  farm: Farm;
  fields: FarmField[];
  analyses: Analysis[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingCard label="Loading farm intelligence…" />;
  }

  // Extract crops from disease analyses
  const cropInventory = extractCropInventory(analyses, fields);
  
  // Count attention-requiring findings
  const attentionRequired = analyses.filter((a) => {
    if (a.analysis_type === "disease") {
      const result = a.result as Record<string, unknown>;
      const isHealthy = result.is_healthy === true;
      const confidence = typeof result.confidence === "number" ? result.confidence : 0;
      // High confidence disease findings require attention
      return !isHealthy && confidence > 70;
    }
    return false;
  }).length;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<MapPinned className="size-5" />}
        label="Fields"
        value={fields.length}
        bgColor="bg-emerald-50"
        textColor="text-emerald-800"
      />
      <StatCard
        icon={<Sprout className="size-5" />}
        label="Identified Crops"
        value={cropInventory.length}
        bgColor="bg-blue-50"
        textColor="text-blue-800"
      />
      <StatCard
        icon={<Activity className="size-5" />}
        label="Analyses"
        value={analyses.length}
        bgColor="bg-purple-50"
        textColor="text-purple-800"
      />
      <StatCard
        icon={<AlertCircle className="size-5" />}
        label="Needs Attention"
        value={attentionRequired}
        bgColor={attentionRequired > 0 ? "bg-amber-50" : "bg-slate-50"}
        textColor={attentionRequired > 0 ? "text-amber-800" : "text-slate-600"}
      />
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
  textColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl ${bgColor} p-2.5 ${textColor}`}>{icon}</div>
        <span className={`text-3xl font-bold ${textColor}`}>{value}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}

type CropInventoryItem = {
  crop: string;
  fieldId: string | null;
  fieldName: string | null;
  latestAnalysisId: string;
  latestAnalysisDate: string;
  confidence: number;
  isHealthy: boolean;
  analysisCount: number;
};

function extractCropInventory(analyses: Analysis[], fields: FarmField[]): CropInventoryItem[] {
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const cropMap = new Map<string, CropInventoryItem>();

  // Process disease analyses to extract crops
  const diseaseAnalyses = analyses
    .filter((a) => a.analysis_type === "disease")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const analysis of diseaseAnalyses) {
    const result = analysis.result as Record<string, unknown>;
    const disease = typeof result.disease === "string" ? result.disease : null;
    if (!disease || disease === "Unknown") continue;

    // Extract crop/plant name from disease name
    const crop = extractCropFromDiseaseName(disease);
    if (!crop) continue;

    const field = analysis.field_id ? fieldMap.get(analysis.field_id) : null;
    const key = `${crop.toLowerCase()}_${analysis.field_id || "none"}`;

    if (!cropMap.has(key)) {
      cropMap.set(key, {
        crop,
        fieldId: analysis.field_id,
        fieldName: field?.name || null,
        latestAnalysisId: analysis.id,
        latestAnalysisDate: analysis.created_at,
        confidence: typeof result.confidence === "number" ? result.confidence : 0,
        isHealthy: result.is_healthy === true,
        analysisCount: 1,
      });
    } else {
      const existing = cropMap.get(key)!;
      existing.analysisCount += 1;
    }
  }

  return Array.from(cropMap.values()).sort((a, b) => a.crop.localeCompare(b.crop));
}

function extractCropFromDiseaseName(disease: string): string | null {
  // Common patterns in disease names: "Tomato Early Blight", "Apple Black Rot"
  const parts = disease.split(/[\s_-]+/);
  if (parts.length === 0) return null;
  
  // First word is often the crop name
  const firstWord = parts[0];
  
  // Filter out common non-crop words
  const nonCropWords = ["healthy", "unknown", "disease", "blight", "rot", "spot", "rust", "wilt"];
  if (nonCropWords.includes(firstWord.toLowerCase())) return null;
  
  return firstWord;
}

function CropInventorySection({
  analyses,
  fields,
  isLoading,
}: {
  analyses: Analysis[];
  fields: FarmField[];
  isLoading: boolean;
}) {
  const cropInventory = extractCropInventory(analyses, fields);

  if (isLoading) {
    return <LoadingCard label="Loading crop inventory…" />;
  }

  if (cropInventory.length === 0) {
    return (
      <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Crop Inventory</h2>
        <p className="mt-1 text-sm text-slate-500">
          Crops identified from disease analyses will appear here.
        </p>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
          <Sprout className="mx-auto size-6 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">
            No crops identified yet. Run disease analyses on your field images to start building your crop inventory.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">Crop Inventory</h2>
      <p className="mt-1 text-sm text-slate-500">
        ML-identified crops from disease analyses. Not authoritative planting records.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cropInventory.map((item, index) => (
          <CropInventoryCard key={`${item.crop}-${item.fieldId || "none"}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function CropInventoryCard({ item }: { item: CropInventoryItem }) {
  const statusColor = item.isHealthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  const statusLabel = item.isHealthy ? "Healthy" : "Issue detected";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-slate-800">{item.crop}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      {item.fieldName && (
        <p className="mt-1 text-xs text-slate-500">
          <MapPinned className="mr-1 inline size-3" />
          {item.fieldName}
        </p>
      )}
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>Latest analysis:</span>
          <span className="font-medium">{formatDate(item.latestAnalysisDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Confidence:</span>
          <span className="font-medium">{Math.round(item.confidence)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Total analyses:</span>
          <span className="font-medium">{item.analysisCount}</span>
        </div>
      </div>
      <Link
        to="/history"
        search={{ analysisType: "disease" }}
        className="mt-3 block text-xs font-semibold text-emerald-700 hover:text-emerald-900"
      >
        View all analyses →
      </Link>
    </article>
  );
}

function FieldHealthSection({
  fields,
  analyses,
  farmId,
  isLoading,
}: {
  fields: FarmField[];
  analyses: Analysis[];
  farmId: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <LoadingCard label="Loading field health data…" />;
  }

  if (fields.length === 0) {
    return null; // Don't show this section if there are no fields
  }

  return (
    <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">Field Health</h2>
      <p className="mt-1 text-sm text-slate-500">
        Latest observations from analyses for each field.
      </p>
      <div className="mt-4 space-y-4">
        {fields.map((field) => (
          <FieldHealthCard key={field.id} field={field} analyses={analyses} farmId={farmId} />
        ))}
      </div>
    </section>
  );
}

function FieldHealthCard({
  field,
  analyses,
  farmId,
}: {
  field: FarmField;
  analyses: Analysis[];
  farmId: string;
}) {
  // Get analyses for this field
  const fieldAnalyses = analyses.filter((a) => a.field_id === field.id);
  
  // Get latest disease analysis
  const diseaseAnalyses = fieldAnalyses
    .filter((a) => a.analysis_type === "disease")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestDisease = diseaseAnalyses[0];

  // Get latest soil analysis
  const soilAnalyses = fieldAnalyses
    .filter((a) => a.analysis_type === "soil")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestSoil = soilAnalyses[0];

  // Extract crop observations
  const cropObservations = new Set<string>();
  diseaseAnalyses.forEach((a) => {
    const result = a.result as Record<string, unknown>;
    const disease = typeof result.disease === "string" ? result.disease : null;
    if (disease && disease !== "Unknown") {
      const crop = extractCropFromDiseaseName(disease);
      if (crop) cropObservations.add(crop);
    }
  });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-800">{field.name}</h3>
          {field.area && (
            <p className="mt-0.5 text-xs text-slate-500">
              {field.area} {field.area_unit || ""}
            </p>
          )}
        </div>
        <Link
          to="/history"
          search={{ fieldId: field.id }}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
        >
          View history →
        </Link>
      </div>

      {fieldAnalyses.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
          <p className="text-sm text-slate-600">No analyses recorded for this field yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {cropObservations.size > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600">Observed Crops</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {Array.from(cropObservations).map((crop) => (
                  <span
                    key={crop}
                    className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                  >
                    {crop}
                  </span>
                ))}
              </div>
            </div>
          )}

          {latestDisease && (
            <div>
              <p className="text-xs font-semibold text-slate-600">Latest Disease Analysis</p>
              <DiseaseAnalysisSummary analysis={latestDisease} />
            </div>
          )}

          {latestSoil && (
            <div>
              <p className="text-xs font-semibold text-slate-600">Latest Soil Analysis</p>
              <SoilAnalysisSummary analysis={latestSoil} />
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
            <span>{fieldAnalyses.length} total analyses</span>
            <span>•</span>
            <span>
              Last updated {formatDate(fieldAnalyses[0].created_at)}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function DiseaseAnalysisSummary({ analysis }: { analysis: Analysis }) {
  const result = analysis.result as Record<string, unknown>;
  const disease = typeof result.disease === "string" ? result.disease : "Unknown";
  const confidence = typeof result.confidence === "number" ? result.confidence : 0;
  const isHealthy = result.is_healthy === true;
  const treatment = typeof result.treatment === "string" ? result.treatment : null;

  const statusColor = isHealthy
    ? "bg-emerald-100 text-emerald-800"
    : confidence > 70
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  const statusLabel = isHealthy ? "Healthy" : confidence > 70 ? "High risk" : "Monitor";

  return (
    <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-800">{disease}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-slate-600">Confidence:</span>
        <div className="flex-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200">
            <div
              className="h-1.5 rounded-full bg-emerald-600"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
        <span className="font-medium text-slate-700">{Math.round(confidence)}%</span>
      </div>
      {treatment && !isHealthy && (
        <p className="mt-2 text-slate-600">
          <span className="font-semibold">Treatment:</span> {treatment}
        </p>
      )}
      <p className="mt-2 text-slate-500">{formatDate(analysis.created_at)}</p>
    </div>
  );
}

function SoilAnalysisSummary({ analysis }: { analysis: Analysis }) {
  const result = analysis.result as Record<string, unknown>;
  const soilType = typeof result.soil_type === "string" ? result.soil_type : "Unknown";
  const confidence = typeof result.confidence === "number" ? result.confidence : 0;

  return (
    <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-800">{soilType}</span>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">
          {Math.round(confidence)}% confidence
        </span>
      </div>
      <p className="mt-2 text-slate-500">{formatDate(analysis.created_at)}</p>
    </div>
  );
}

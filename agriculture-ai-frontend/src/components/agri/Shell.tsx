import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  ArrowRight,
  CloudSun,
  History,
  Info,
  Leaf,
  LoaderCircle,
  LogIn,
  LogOut,
  MessagesSquare,
  MapPinned,
  RotateCw,
  Sprout,
  TestTube2,
  UserCircle2,
  Wheat,
} from "lucide-react";

import { AgriContext } from "@/lib/agri-store";
import { useAuth } from "@/lib/auth-context";
import { startGoogleSignIn } from "@/lib/api";
import { LANGUAGES, TRANSLATIONS, type LangCode } from "@/lib/i18n";
import type { CropSuggestion, DiseaseResult, SoilResult } from "@/lib/api";

import { DiseaseTab } from "./DiseaseTab";
import { SoilTab } from "./SoilTab";
import { CropTab } from "./CropTab";
import { AdviceTab } from "./AdviceTab";
import { ErrorBoundary } from "./ErrorBoundary";


type TabId = "home" | "disease" | "soil" | "crop" | "weather" | "advice";
type PageId = TabId | "farms" | "history";


const NAV: {
  id: Exclude<TabId, "home">;
  icon: typeof Leaf;
}[] = [
  { id: "disease", icon: Leaf },
  { id: "soil", icon: TestTube2 },
  { id: "crop", icon: Wheat },
  { id: "weather", icon: CloudSun },
  { id: "advice", icon: MessagesSquare },
];


const FEATURES: {
  id: Exclude<TabId, "home">;
  title: string;
  description: string;
  icon: typeof Leaf;
  accent: string;
}[] = [
  {
    id: "disease",
    title: "Disease Detection",
    description: "Upload a leaf image and identify possible plant diseases.",
    icon: Leaf,
    accent: "from-emerald-100 to-green-50",
  },
  {
    id: "soil",
    title: "Soil Analysis",
    description: "Analyze a soil image and understand its predicted soil class.",
    icon: TestTube2,
    accent: "from-amber-100 to-lime-50",
  },
  {
    id: "crop",
    title: "Crop Recommendation",
    description: "Find suitable crops using soil and environmental conditions.",
    icon: Wheat,
    accent: "from-sky-100 to-cyan-50",
  },
  {
    id: "weather",
    title: "Weather Prediction",
    description:
      "Check weather conditions, forecasts, and hourly agricultural weather insights.",
    icon: CloudSun,
    accent: "from-blue-100 to-sky-50",
  },
  {
    id: "advice",
    title: "AI Assistant",
    description:
      "Ask the agricultural AI assistant for personalized guidance.",
    icon: MessagesSquare,
    accent: "from-violet-100 to-indigo-50",
  },
];


export function Shell({
  activePage = "home",
  children,
}: {
  activePage?: PageId;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const auth = useAuth();

  const [lang, setLang] = useState<LangCode>("en");
  const [tab, setTab] = useState<TabId>(() => {
    if (activePage === "farms" || activePage === "history") return "home";
    if (activePage !== "home") return activePage;
    if (typeof window === "undefined") return "home";
    const requestedTab = window.location.hash.slice(1);
    if (
      requestedTab === "disease" ||
      requestedTab === "soil" ||
      requestedTab === "crop" ||
      requestedTab === "advice"
    ) {
      return requestedTab;
    }
    return "home";
  });
  const [disease, setDisease] = useState<DiseaseResult | null>(null);
  const [soil, setSoil] = useState<SoilResult | null>(null);
  const [crops, setCrops] = useState<CropSuggestion[] | null>(null);


  const t = TRANSLATIONS[lang];
  const pageLabel = getPageLabel(activePage, tab, t.nav);


  const store = useMemo(
    () => ({
      lang,
      setLang,
      disease,
      setDisease,
      soil,
      setSoil,
      crops,
      setCrops,
    }),
    [lang, disease, soil, crops],
  );


  const openPage = (page: PageId) => {
    if (page === "farms") {
      void navigate({ to: "/farms" });
      return;
    }

    if (page === "history") {
      void navigate({ to: "/history" });
      return;
    }

    // Weather is a separate TanStack Router route.
    if (page === "weather") {
      void navigate({ to: "/weather" });
      return;
    }

    // When navigating from routed pages back to home with a specific tab
    if (activePage !== "home") {
      // Set the tab state first to avoid flickering
      if (page !== "home") {
        setTab(page);
      }
      void navigate({
        to: "/",
        hash: page === "home" ? "" : `#${page}`,
      });
      return;
    }

    // Other pages continue using the existing Shell-based navigation.
    setTab(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <AgriContext.Provider value={store}>
      <div className="min-h-screen text-slate-800">

        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col border-r border-white/70 bg-white/65 p-5 shadow-xl shadow-sky-900/5 backdrop-blur-xl lg:flex">

          <button
            onClick={() => openPage("home")}
            className="mb-8 flex items-center gap-3 rounded-2xl px-2 py-2 text-left"
          >
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-700/20">
              <Sprout className="size-6" />
            </div>

            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-emerald-800">
                FARMINTEL
              </h1>

              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Smart Agriculture
              </p>
            </div>
          </button>


          {/* User profile */}
          <div className="mb-7 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                <UserCircle2 className="size-7" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">
                  {auth.status === "loading"
                    ? "Checking session..."
                    : auth.status === "authenticated"
                      ? auth.user?.display_name || auth.user?.email || "Signed in"
                      : auth.status === "error"
                        ? "Session unavailable"
                        : "Not signed in"}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {auth.status === "authenticated"
                    ? auth.user?.display_name && auth.user?.email
                      ? auth.user?.email
                      : "FarmIntel account"
                    : auth.status === "error"
                      ? auth.error
                      : "FarmIntel account"}
                </p>
              </div>
            </div>
          </div>


          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Explore
          </p>


          <nav className="space-y-1.5">

            <button
              onClick={() => openPage("home")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                tab === "home" && activePage === "home"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/15"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <Sprout className="size-4" />
              Home
            </button>

            <button
              onClick={() => openPage("farms")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activePage === "farms"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/15"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <MapPinned className="size-4" />
              Farms
            </button>

            <button
              onClick={() => openPage("history")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activePage === "history"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/15"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              <History className="size-4" />
              Analysis history
            </button>


            {NAV.map((n) => {
              const active = tab === n.id;
              const Icon = n.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => openPage(n.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-700/15"
                      : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t.nav[n.id]}</span>
                </button>
              );
            })}

          </nav>


          <div className="mt-auto space-y-3">

            <div className="rounded-2xl border border-white/80 bg-white/60 p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-emerald-700" />

                <div>
                  <p className="text-xs font-bold text-slate-700">
                    About our website
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    AI-powered tools for smarter crop and plant management.
                  </p>
                </div>
              </div>
            </div>


            <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />

              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {t.systemReady}
              </span>
            </div>

          </div>
        </aside>


        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/60 bg-white/55 backdrop-blur-xl lg:pl-72">

          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">

            <div className="flex items-center gap-2 lg:hidden">
              <Sprout className="size-5 text-emerald-700" />

              <span className="font-extrabold text-emerald-800">
                FARMINTEL
              </span>
            </div>


            <div className="hidden items-center gap-2 lg:flex">

              <button
                onClick={() => openPage("home")}
                className="text-sm font-semibold text-slate-500 hover:text-emerald-700"
              >
                Home
              </button>

              {(tab !== "home" || activePage === "farms" || activePage === "history") && (
                <>
                  <span className="text-slate-300">/</span>

                  <span className="text-sm font-semibold text-slate-800">
                    {pageLabel}
                  </span>
                </>
              )}

            </div>


            <div className="flex min-w-0 items-center gap-2">
              <LanguageSelect lang={lang} onChange={setLang} />
              <AuthActions />
            </div>

          </div>
        </header>


        {/* Main */}
        <main className="pb-28 lg:pl-72 lg:pb-12">

          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">

            <ErrorBoundary>

              {tab === "home" && activePage === "home" && <HomePage onOpen={openPage} />}


              {tab === "disease" && (
                <PageWithBack onBack={() => openPage("home")}>
                  <DiseaseTab />
                </PageWithBack>
              )}


              {tab === "soil" && (
                <PageWithBack onBack={() => openPage("home")}>
                  <SoilTab />
                </PageWithBack>
              )}


              {tab === "crop" && (
                <PageWithBack onBack={() => openPage("home")}>
                  <CropTab />
                </PageWithBack>
              )}


              {children !== undefined ? children : null}

              {children === undefined && tab === "advice" && (
                <PageWithBack onBack={() => openPage("home")}>
                  <AdviceTab />
                </PageWithBack>
              )}

            </ErrorBoundary>

          </div>
        </main>


        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-around gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/80 p-2 shadow-2xl backdrop-blur-xl lg:hidden">

          <button
            onClick={() => openPage("home")}
            className={`grid place-items-center rounded-xl p-2 ${
              tab === "home" && activePage === "home"
                ? "bg-emerald-600 text-white"
                : "text-slate-500"
            }`}
            aria-label="Home"
          >
            <Sprout className="size-5" />
          </button>

          <button
            onClick={() => openPage("farms")}
            className={`grid place-items-center rounded-xl p-2 ${
              activePage === "farms" ? "bg-emerald-600 text-white" : "text-slate-500"
            }`}
            aria-label="Farms"
          >
            <MapPinned className="size-5" />
          </button>

          <button
            onClick={() => openPage("history")}
            className={`grid place-items-center rounded-xl p-2 ${
              activePage === "history" ? "bg-emerald-600 text-white" : "text-slate-500"
            }`}
            aria-label="Analysis history"
          >
            <History className="size-5" />
          </button>


          {NAV.map((n) => {
            const active = tab === n.id;
            const Icon = n.icon;

            return (
              <button
                key={n.id}
                onClick={() => openPage(n.id)}
                aria-label={t.nav[n.id]}
                className={`grid place-items-center rounded-xl p-2 ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-slate-500"
                }`}
              >
                <Icon className="size-5" />
              </button>
            );
          })}

        </nav>

      </div>
    </AgriContext.Provider>
  );
}

function getPageLabel(
  activePage: PageId,
  tab: TabId,
  labels: typeof TRANSLATIONS.en.nav,
): string {
  if (activePage === "farms") return "Farms";
  if (activePage === "history") return "Analysis history";

  switch (tab) {
    case "home":
      return "Home";
    case "disease":
      return labels.disease;
    case "soil":
      return labels.soil;
    case "crop":
      return labels.crop;
    case "weather":
      return labels.weather;
    case "advice":
      return labels.advice;
  }
}

function AuthActions() {
  const auth = useAuth();
  const buttonClassName =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60";

  if (auth.status === "loading") {
    return (
      <button className={buttonClassName} type="button" disabled>
        <LoaderCircle className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">Checking...</span>
      </button>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-44 text-xs text-rose-700 sm:inline" role="status">
          {auth.error}
        </span>
        <button
          className={buttonClassName}
          type="button"
          onClick={auth.retry}
          aria-label="Retry sign-in status check"
        >
          <RotateCw className="size-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <button
        className={buttonClassName}
        onClick={startGoogleSignIn}
        type="button"
        aria-label="Sign in with Google"
      >
        <LogIn className="size-3.5" />
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden">Google</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="hidden max-w-32 truncate text-xs font-medium text-slate-600 sm:inline">
        {auth.user?.display_name || auth.user?.email || "Signed in"}
      </span>
      <button
        className={buttonClassName}
        type="button"
        onClick={() => void auth.signOut()}
        disabled={auth.isSigningOut}
      >
        {auth.isSigningOut ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <LogOut className="size-3.5" />
        )}
        <span>{auth.isSigningOut ? "Signing out..." : "Sign out"}</span>
      </button>
      {auth.signOutError && (
        <span className="text-[10px] text-rose-700" role="status">
          {auth.signOutError}
        </span>
      )}
    </div>
  );
}


function HomePage({
  onOpen,
}: {
  onOpen: (page: TabId) => void;
}) {
  return (
    <section className="animate-reveal">

      <div className="mb-8 max-w-3xl">

        <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          Smart Agriculture
        </p>

        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Everything you need for smarter farming.
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Choose a tool below to analyze your crops, soil, weather, and get AI-powered
          agricultural guidance.
        </p>

      </div>


      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

        {FEATURES.map((feature) => {
          const Icon = feature.icon;

          return (
            <button
              key={feature.id}
              onClick={() => onOpen(feature.id)}
              className="group relative min-h-56 overflow-hidden rounded-3xl border border-white/80 bg-white/80 p-6 text-left shadow-lg shadow-slate-900/5 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >

              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-45 transition-opacity group-hover:opacity-70`}
              />

              <div className="relative flex h-full flex-col">

                <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-white/85 text-emerald-700 shadow-sm">
                  <Icon className="size-7" />
                </div>

                <h3 className="text-lg font-bold text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>

                <div className="mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-emerald-700">
                  Open

                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>

              </div>
            </button>
          );
        })}

      </div>

    </section>
  );
}


function PageWithBack({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack: () => void;
}) {
  return (
    <section className="animate-reveal">

      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-emerald-700"
      >
        ← Back to Home
      </button>

      {children}

    </section>
  );
}


function LanguageSelect({
  lang,
  onChange,
}: {
  lang: LangCode;
  onChange: (l: LangCode) => void;
}) {
  return (
    <label className="relative flex shrink-0 items-center">

      <select
        value={lang}
        onChange={(e) => onChange(e.target.value as LangCode)}
        className="cursor-pointer appearance-none rounded-full border border-white/80 bg-white/75 px-4 py-2 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
      >

        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}

      </select>

      <span className="pointer-events-none absolute right-3 text-[8px] text-slate-400">
        ▼
      </span>

    </label>
  );
}


export function SectionHeader({
  title,
  subtitle,
  workflowId,
}: {
  title: string;
  subtitle: string;
  workflowId?: string;
}) {
  return (
    <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">

      <div className="min-w-0">

        <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>

        <p className="text-sm text-slate-600">
          {subtitle}
        </p>

      </div>


      {workflowId ? (
        <div className="hidden text-right sm:block">

          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Workflow ID
          </span>

          <p className="font-mono text-xs text-slate-600">
            {workflowId}
          </p>

        </div>
      ) : null}

    </header>
  );
}


export function TabWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="animate-reveal">{children}</section>;
}
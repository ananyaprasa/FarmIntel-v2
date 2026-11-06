import { createContext, useContext } from "react";
import type { LangCode } from "./i18n";
import type { CropSuggestion, DiseaseResult, SoilResult } from "./api";

export type AgriState = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  disease: DiseaseResult | null;
  setDisease: (d: DiseaseResult | null) => void;
  soil: SoilResult | null;
  setSoil: (s: SoilResult | null) => void;
  crops: CropSuggestion[] | null;
  setCrops: (c: CropSuggestion[] | null) => void;
};

export const AgriContext = createContext<AgriState | null>(null);

export function useAgri(): AgriState {
  const ctx = useContext(AgriContext);
  if (!ctx) throw new Error("useAgri must be used inside AgriProvider");
  return ctx;
}

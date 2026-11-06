import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AnalysisHistoryPage } from "@/components/analysis/AnalysisHistoryPage";
import { Shell } from "@/components/agri/Shell";

const historySearchSchema = z.object({
  analysisType: z.enum(["disease", "soil", "crop"]).optional(),
  fieldId: z.string().optional(),
  farmId: z.string().optional(),
});

export type HistorySearch = z.infer<typeof historySearchSchema>;

export const Route = createFileRoute("/history")({
  validateSearch: historySearchSchema,
  component: HistoryRoute,
});

function HistoryRoute() {
  const search = Route.useSearch();
  
  return (
    <Shell activePage="history">
      <AnalysisHistoryPage
        initialAnalysisType={search.analysisType}
        initialFieldId={search.fieldId}
        initialFarmId={search.farmId}
      />
    </Shell>
  );
}

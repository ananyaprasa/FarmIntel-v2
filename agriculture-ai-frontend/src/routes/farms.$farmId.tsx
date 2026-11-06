import { createFileRoute } from "@tanstack/react-router";

import { FarmDetailPage } from "@/components/farms/FarmManagement";

export const Route = createFileRoute("/farms/$farmId")({
  component: FarmDetailRoute,
});

function FarmDetailRoute() {
  const { farmId } = Route.useParams();

  return <FarmDetailPage farmId={farmId} />;
}

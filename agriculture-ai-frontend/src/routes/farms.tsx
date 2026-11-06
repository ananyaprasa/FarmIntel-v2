import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import { Shell } from "@/components/agri/Shell";
import { FarmsPage } from "@/components/farms/FarmManagement";

export const Route = createFileRoute("/farms")({
  component: FarmsRoute,
});

function FarmsRoute() {
  const { pathname } = useLocation();

  return (
    <Shell activePage="farms">
      {pathname.replace(/\/$/, "") === "/farms" ? <FarmsPage /> : <Outlet />}
    </Shell>
  );
}

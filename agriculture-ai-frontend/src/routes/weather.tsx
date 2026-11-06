import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/agri/Shell";
import { WeatherDashboard } from "@/components/weather/WeatherDashboard";

export const Route = createFileRoute("/weather")({
  component: WeatherRoute,
});

function WeatherRoute() {
  return (
    <Shell activePage="weather">
      <WeatherDashboard />
    </Shell>
  );
}

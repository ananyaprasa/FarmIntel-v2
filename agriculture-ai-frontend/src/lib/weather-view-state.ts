import type { WeatherResult } from "./api";

export type WeatherViewState = "loading" | "error" | "empty" | "ready";

export function getWeatherViewState(
  loading: boolean,
  error: boolean,
  weather: WeatherResult | null,
): WeatherViewState {
  if (loading) return "loading";
  if (error) return "error";
  if (!weather) return "empty";
  const hasDailyData = [
    weather.condition,
    weather.temperature_max,
    weather.temperature_min,
    weather.precipitation_sum,
    weather.precipitation_probability_max,
    weather.sunrise,
    weather.sunset,
  ].some((value) => value !== undefined);
  const hasHourlyData = weather.hourly.some((item) =>
    [
      item.temperature,
      item.feels_like,
      item.humidity,
      item.precipitation_probability,
      item.precipitation,
      item.wind_speed,
      item.condition,
    ].some((value) => value !== undefined),
  );
  return hasDailyData || hasHourlyData ? "ready" : "empty";
}

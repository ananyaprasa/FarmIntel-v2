import { useEffect, useState } from "react";
import {
  AlertCircle,
  CloudSun,
  Droplets,
  LoaderCircle,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from "lucide-react";

import { SectionHeader, TabWrapper } from "@/components/agri/Shell";
import {
  WeatherLocationPicker,
  type WeatherLocation,
} from "@/components/weather/WeatherLocationPicker";
import { getWeather, type WeatherHourly, type WeatherResult } from "@/lib/api";
import { useAgri } from "@/lib/agri-store";
import { getWeatherViewState } from "@/lib/weather-view-state";
import { TRANSLATIONS } from "@/lib/i18n";

const DEFAULT_LOCATION: WeatherLocation = {
  name: "Bhilai, Chhattisgarh",
  latitude: 21.195078,
  longitude: 81.39369,
};

function localDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string, lang: "en" | "hi") {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatLocalTime(value: string, lang: "en" | "hi") {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function weatherIcon(code?: number, isDay = true) {
  if (code === undefined) return "☁";
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code === 1) return isDay ? "🌤️" : "🌙";
  if ([2, 3].includes(code)) return code === 2 ? "⛅" : "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "☁";
}

function meanHourlyValue(hourly: WeatherHourly[], key: "humidity" | "wind_speed") {
  const values = hourly
    .map((item) => item[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function WeatherMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function WeatherDashboard() {
  const { lang } = useAgri();
  const t = TRANSLATIONS[lang].weather;
  const [selectedDate, setSelectedDate] = useState(localDateValue);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!selectedDate) {
      setWeather(null);
      setHasError(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setWeather(null);
    setLoading(true);
    setHasError(false);

    void getWeather(location.latitude, location.longitude, selectedDate, "auto", controller.signal)
      .then(setWeather)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Weather forecast request failed:", reason);
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [location, retryCount, selectedDate]);

  const viewState = getWeatherViewState(loading, hasError, weather);
  const hourly = weather?.hourly ?? [];
  const meanHumidity = meanHourlyValue(hourly, "humidity");
  const meanWind = meanHourlyValue(hourly, "wind_speed");
  const firstHourly = hourly.find(
    (item) =>
      item.temperature !== undefined ||
      item.humidity !== undefined ||
      item.precipitation_probability !== undefined,
  );
  const cropRecommendations = weather?.crop_recommendations;

  return (
    <TabWrapper>
      <SectionHeader title={t.title} subtitle={t.subtitle} />

      <div className="mb-6 grid gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-foreground">{t.location}</p>
          <WeatherLocationPicker location={location} onConfirm={setLocation} />
        </div>

        <div>
          <label
            htmlFor="weather-date"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            {t.selectedDate}
          </label>
          <input
            id="weather-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t.dateRangeWarning}</p>
        </div>
      </div>

      {viewState === "loading" && (
        <section
          className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto mb-3 size-9 animate-spin text-primary"
          />
          <p className="font-semibold text-foreground">{t.loading}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.loadingDescription} {selectedDate && formatDate(selectedDate, lang)}.
          </p>
        </section>
      )}

      {viewState === "error" && (
        <section
          className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-semibold text-foreground">{t.unavailable}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.requestFailed}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {t.retry}
              </button>
            </div>
          </div>
        </section>
      )}

      {viewState === "empty" && (
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <CloudSun aria-hidden="true" className="mx-auto mb-3 size-9 text-primary" />
          <h2 className="font-semibold text-foreground">{t.empty}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyDescription}</p>
        </section>
      )}

      {viewState === "ready" && weather && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">{t.overview}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.selectedDay}: {formatDate(weather.date, lang)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {weather.timezone} · {weather.latitude.toFixed(4)}°,{" "}
                  {weather.longitude.toFixed(4)}°
                </p>
              </div>
              {weather.weather_code !== undefined && (
                <div className="text-right" aria-label={weather.condition ?? t.condition}>
                  <div aria-hidden="true" className="text-4xl">
                    {weatherIcon(weather.weather_code)}
                  </div>
                  {weather.condition && (
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {weather.condition}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {weather.temperature_max !== undefined && (
                <WeatherMetric
                  icon={Thermometer}
                  label={t.high}
                  value={`${weather.temperature_max.toFixed(1)} °C`}
                />
              )}
              {weather.temperature_min !== undefined && (
                <WeatherMetric
                  icon={Thermometer}
                  label={t.low}
                  value={`${weather.temperature_min.toFixed(1)} °C`}
                />
              )}
              {weather.precipitation_probability_max !== undefined && (
                <WeatherMetric
                  icon={CloudSun}
                  label={t.rainChance}
                  value={`${weather.precipitation_probability_max.toFixed(0)}%`}
                />
              )}
              {weather.precipitation_sum !== undefined && (
                <WeatherMetric
                  icon={Droplets}
                  label={t.precipitation}
                  value={`${weather.precipitation_sum.toFixed(1)} mm`}
                />
              )}
              {meanHumidity !== undefined && (
                <WeatherMetric
                  icon={Droplets}
                  label={t.humidity}
                  value={`${meanHumidity.toFixed(0)}%`}
                />
              )}
              {meanWind !== undefined && (
                <WeatherMetric icon={Wind} label={t.wind} value={`${meanWind.toFixed(1)} km/h`} />
              )}
              {weather.sunrise && (
                <WeatherMetric
                  icon={Sunrise}
                  label={t.sunrise}
                  value={formatLocalTime(weather.sunrise, lang)}
                />
              )}
              {weather.sunset && (
                <WeatherMetric
                  icon={Sunset}
                  label={t.sunset}
                  value={formatLocalTime(weather.sunset, lang)}
                />
              )}
              {firstHourly?.feels_like !== undefined && (
                <WeatherMetric
                  icon={Thermometer}
                  label={t.feelsLike}
                  value={`${firstHourly.feels_like.toFixed(1)} °C`}
                />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {t.hourlyForecast}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.hourlyDescription} · {weather.timezone}
              </p>
            </div>
            {hourly.length ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {hourly.map((hour) => (
                  <article
                    key={hour.time}
                    className="min-w-[118px] rounded-2xl border border-border bg-background/70 p-3 text-center"
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      {formatLocalTime(hour.time, lang)}
                    </p>
                    {hour.weather_code !== undefined && (
                      <div aria-hidden="true" className="my-2 text-2xl">
                        {weatherIcon(hour.weather_code, hour.is_day ?? true)}
                      </div>
                    )}
                    {hour.temperature !== undefined && (
                      <p className="text-lg font-bold text-foreground">
                        {hour.temperature.toFixed(1)}°
                      </p>
                    )}
                    {hour.condition && (
                      <p className="mt-1 max-w-32 truncate text-xs text-muted-foreground">
                        {hour.condition}
                      </p>
                    )}
                    <div className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                      {hour.humidity !== undefined && (
                        <p>
                          {t.humidity}: {hour.humidity.toFixed(0)}%
                        </p>
                      )}
                      {hour.precipitation_probability !== undefined && (
                        <p>
                          {t.rainChance}: {hour.precipitation_probability.toFixed(0)}%
                        </p>
                      )}
                      {hour.precipitation !== undefined && (
                        <p>
                          {t.precipitation}: {hour.precipitation.toFixed(1)} mm
                        </p>
                      )}
                      {hour.wind_speed !== undefined && (
                        <p>
                          {t.wind}: {hour.wind_speed.toFixed(1)} km/h
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {t.emptyDescription}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{t.cropTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.cropSubtitle}</p>
              {cropRecommendations?.forecast_date && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(cropRecommendations.forecast_date, lang)} ·{" "}
                  {cropRecommendations.timezone}
                </p>
              )}
            </div>

            <div className="mb-5 space-y-2 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
              <p>{t.scoreNote}</p>
              <p>{t.scoreFormula}</p>
              <p>{t.noRequirements}</p>
              <p>{t.rainfallExcluded}</p>
              <p>{t.soilMissing}</p>
            </div>

            {!cropRecommendations ||
            cropRecommendations.status !== "available" ||
            cropRecommendations.suggestions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                {t.missingData}
              </p>
            ) : (
              <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cropRecommendations.suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.crop}
                    className="rounded-2xl border border-border bg-background/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          #{index + 1}
                        </p>
                        <h3 className="mt-1 text-lg font-bold capitalize text-foreground">
                          {suggestion.crop}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t.profileScore}</p>
                        <p className="text-lg font-bold text-foreground">
                          {suggestion.score.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-muted-foreground">
                      {t.closestProfile}
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {suggestion.comparisons.map((comparison) => (
                        <li
                          key={comparison.factor}
                          className="flex flex-wrap justify-between gap-x-3 gap-y-1"
                        >
                          <span className="text-muted-foreground">
                            {comparison.factor === "temperature" ? t.temperature : t.humidity}
                          </span>
                          <span className="font-medium text-foreground">
                            {comparison.forecast_average.toFixed(1)}
                            {comparison.unit} · {t.referenceAverage}{" "}
                            {comparison.profile_average.toFixed(1)}
                            {comparison.unit} · {t.profileDifference}{" "}
                            {comparison.difference > 0 ? "+" : ""}
                            {comparison.difference.toFixed(1)}
                            {comparison.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}

            <a
              href="/#crop"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t.openCrop}
            </a>
          </section>
        </div>
      )}
    </TabWrapper>
  );
}

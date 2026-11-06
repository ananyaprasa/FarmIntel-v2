import assert from "node:assert/strict";
import test from "node:test";
import { getWeatherViewState } from "./weather-view-state.ts";

const weather = {
  latitude: 21,
  longitude: 81,
  date: "2026-10-12",
  timezone: "Asia/Kolkata",
  hourly: [],
};

test("weather view state covers loading, error, empty, and ready results", () => {
  assert.equal(getWeatherViewState(true, false, null), "loading");
  assert.equal(getWeatherViewState(false, true, null), "error");
  assert.equal(getWeatherViewState(false, false, null), "empty");
  assert.equal(
    getWeatherViewState(false, false, {
      ...weather,
      temperature_max: 30,
    }),
    "ready",
  );
  assert.equal(getWeatherViewState(false, false, weather), "empty");
});

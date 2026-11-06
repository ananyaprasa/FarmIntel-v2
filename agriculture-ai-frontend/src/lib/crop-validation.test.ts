import assert from "node:assert/strict";
import test from "node:test";
import { CROP_EXAMPLE_VALUES, CROP_INPUT_LIMITS, validateCropValues } from "./crop-validation.ts";

test("uses the request limits defined by the crop endpoint", () => {
  assert.deepEqual(CROP_INPUT_LIMITS, {
    N: { min: 0, max: 140 },
    P: { min: 0, max: 145 },
    K: { min: 0, max: 205 },
    temperature: { min: 8, max: 45 },
    humidity: { min: 14, max: 100 },
    ph: { min: 3.5, max: 10 },
    rainfall: { min: 20, max: 300 },
  });
});

test("accepts the displayed example inputs", () => {
  assert.deepEqual(validateCropValues(CROP_EXAMPLE_VALUES), {});
});

test("reports empty and non-finite numeric values on their own fields", () => {
  assert.deepEqual(validateCropValues({ ...CROP_EXAMPLE_VALUES, N: "", temperature: "Infinity" }), {
    N: "required",
    temperature: "number",
  });
});

test("rejects values outside the backend request ranges", () => {
  assert.deepEqual(validateCropValues({ ...CROP_EXAMPLE_VALUES, ph: "10.1", rainfall: "19.9" }), {
    ph: "range",
    rainfall: "range",
  });
});

test("accepts exact backend boundary values", () => {
  assert.deepEqual(
    validateCropValues({
      N: "0",
      P: "145",
      K: "205",
      temperature: "8",
      humidity: "100",
      ph: "3.5",
      rainfall: "300",
    }),
    {},
  );
});

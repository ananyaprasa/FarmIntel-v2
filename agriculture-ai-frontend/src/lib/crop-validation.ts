export const CROP_INPUT_LIMITS = {
  N: { min: 0, max: 140 },
  P: { min: 0, max: 145 },
  K: { min: 0, max: 205 },
  temperature: { min: 8, max: 45 },
  humidity: { min: 14, max: 100 },
  ph: { min: 3.5, max: 10 },
  rainfall: { min: 20, max: 300 },
} as const;

export type CropField = keyof typeof CROP_INPUT_LIMITS;
export type CropFieldValues = Record<CropField, string>;
export type CropFieldErrors = Partial<Record<CropField, "required" | "number" | "range">>;
export const CROP_FIELDS = Object.keys(CROP_INPUT_LIMITS) as CropField[];

export const CROP_EXAMPLE_VALUES: CropFieldValues = {
  N: "42",
  P: "50",
  K: "43",
  temperature: "26",
  humidity: "70",
  ph: "6.5",
  rainfall: "120",
};

export function validateCropValues(values: CropFieldValues): CropFieldErrors {
  const errors: CropFieldErrors = {};

  for (const field of CROP_FIELDS) {
    const text = values[field].trim();
    if (!text) {
      errors[field] = "required";
      continue;
    }

    const value = Number(text);
    if (!Number.isFinite(value)) {
      errors[field] = "number";
      continue;
    }

    const { min, max } = CROP_INPUT_LIMITS[field];
    if (value < min || value > max) errors[field] = "range";
  }

  return errors;
}

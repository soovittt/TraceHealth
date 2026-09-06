// Shared metric metadata used by both server and client.
export type MetricMeta = {
  code: string;
  label: string;
  unit: string;
  // "high_bad" = rising is concerning, "low_bad" = falling is concerning, "neutral"
  direction: "high_bad" | "low_bad" | "neutral";
  refHigh?: number;
  refLow?: number;
};

export const METRIC_META: Record<string, MetricMeta> = {
  LDL: { code: "LDL", label: "LDL Cholesterol", unit: "mg/dL", direction: "high_bad", refHigh: 130 },
  HDL: { code: "HDL", label: "HDL Cholesterol", unit: "mg/dL", direction: "low_bad", refLow: 40 },
  CHOL_TOTAL: { code: "CHOL_TOTAL", label: "Total Cholesterol", unit: "mg/dL", direction: "high_bad", refHigh: 200 },
  TRIG: { code: "TRIG", label: "Triglycerides", unit: "mg/dL", direction: "high_bad", refHigh: 150 },
  HBA1C: { code: "HBA1C", label: "HbA1c", unit: "%", direction: "high_bad", refHigh: 5.7 },
  GLUCOSE: { code: "GLUCOSE", label: "Glucose", unit: "mg/dL", direction: "high_bad", refHigh: 100 },
  WEIGHT: { code: "WEIGHT", label: "Weight", unit: "lb", direction: "neutral" },
  BMI: { code: "BMI", label: "Body Mass Index", unit: "kg/m²", direction: "high_bad", refHigh: 25 },
  VITD: { code: "VITD", label: "Vitamin D, 25-OH", unit: "ng/mL", direction: "low_bad", refLow: 30 },
  BP_SYS: { code: "BP_SYS", label: "Blood pressure (systolic)", unit: "mmHg", direction: "high_bad", refHigh: 130 },
  BP_DIA: { code: "BP_DIA", label: "Blood pressure (diastolic)", unit: "mmHg", direction: "high_bad", refHigh: 80 },
  HR: { code: "HR", label: "Heart rate", unit: "bpm", direction: "neutral" },
  EGFR: { code: "EGFR", label: "eGFR", unit: "mL/min", direction: "low_bad", refLow: 60 },
  CREATININE: { code: "CREATININE", label: "Creatinine", unit: "mg/dL", direction: "high_bad", refHigh: 1.3 },
};

export function metaFor(code: string, fallbackLabel: string, unit: string): MetricMeta {
  return METRIC_META[code] ?? { code, label: fallbackLabel, unit, direction: "neutral" };
}

// Metrics we chart well and lead with in the Overview + Trends tabs.
export const PRIMARY_CODES = new Set([
  "LDL", "HBA1C", "BP_SYS", "WEIGHT", "BMI", "GLUCOSE", "CHOL_TOTAL", "HDL", "TRIG", "HR", "VITD",
]);

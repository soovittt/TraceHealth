// The demo patient. This is the story judges see with one click.
// Sarah Williams, 34 — 8 years, 4 healthcare organizations, 10 documents.
// The arc: a slowly rising LDL across providers, a statin started in 2026,
// LDL falling three months later, plus real cross-record conflicts.

const d = (y: number, m: number, day: number) => Date.UTC(y, m - 1, day);

export type SeedDoc = {
  key: string;
  filename: string;
  org: string;
  kind: string;
  pages: number;
  receivedVia: string;
  receivedAt: number;
  excerpt: string;
};

export const DEMO_PATIENT = {
  name: "Sarah Williams",
  age: 34,
  sex: "F",
  recordsFrom: "2018–2026",
  orgCount: 4,
};

export const DEMO_DOCS: SeedDoc[] = [
  {
    key: "prev",
    filename: "BayValley_Records_2018_2022.pdf",
    org: "Bay Valley Family Medicine",
    kind: "clinical_export",
    pages: 14,
    receivedVia: "demo",
    receivedAt: d(2022, 8, 2),
    excerpt:
      "BAY VALLEY FAMILY MEDICINE — Cumulative record export for Sarah Williams.\n" +
      "2018-03-12 Annual physical. Lipid panel: LDL 104 mg/dL, HDL 58, Total 176. HbA1c 5.1%. Weight 168 lb. BP 118/76. Impression: Healthy.\n" +
      "2019-04-08 Annual physical. LDL 104 mg/dL. Weight 169 lb. BP 120/78.\n" +
      "2021-05-19 Annual physical. LDL 117 mg/dL. Weight 172 lb.\n" +
      "2022-06-15 Lipid panel. LDL 123 mg/dL. Weight 174 lb. Counseled on diet.",
  },
  {
    key: "stan2023",
    filename: "Stanford_NewPatient_2023.pdf",
    org: "Stanford Health",
    kind: "visit_summary",
    pages: 4,
    receivedVia: "demo",
    receivedAt: d(2023, 7, 20),
    excerpt:
      "STANFORD HEALTH CARE — Establish care visit, Dr. Priya Nair (Internal Medicine).\n" +
      "2023-07-18. Lipid panel: LDL 128 mg/dL. HbA1c 5.3%. Weight 174 lb. BP 122/78.\n" +
      "Problem list: High cholesterol (borderline). Allergy: Penicillin (rash).\n" +
      "Plan: lifestyle modification, recheck 12 months.",
  },
  {
    key: "stan2024",
    filename: "Stanford_Labs_2024.pdf",
    org: "Stanford Health",
    kind: "labs",
    pages: 2,
    receivedVia: "demo",
    receivedAt: d(2024, 9, 14),
    excerpt:
      "STANFORD HEALTH CARE — Laboratory report.\n" +
      "2024-09-12. LDL Cholesterol 142 mg/dL (High). HbA1c 5.5%. Weight 178 lb. Triglycerides 165.",
  },
  {
    key: "ucsf2025",
    filename: "UCSF_Cardiology_Note_2025.pdf",
    org: "UCSF",
    kind: "specialist_note",
    pages: 3,
    receivedVia: "demo",
    receivedAt: d(2025, 5, 22),
    excerpt:
      "UCSF CARDIOLOGY — Consult note, Dr. Marcus Feld.\n" +
      "2025-05-20. Referred for dyslipidemia. LDL 158 mg/dL. HbA1c 5.7%.\n" +
      "MRI of the left knee reviewed from Stanford Radiology dated 05/14/24 — no acute findings.\n" +
      "Started Metformin 500 mg daily for prediabetes. No known drug allergies reported by patient.\n" +
      "Assessment: Prediabetes. Dyslipidemia.",
  },
  {
    key: "quest2025",
    filename: "Quest_Labs_Aug2025.pdf",
    org: "Quest Diagnostics",
    kind: "labs",
    pages: 1,
    receivedVia: "demo",
    receivedAt: d(2025, 8, 9),
    excerpt:
      "QUEST DIAGNOSTICS — Patient: Williams, Sarah.\n" +
      "Collected 2025-08-07. LDL Cholesterol 164 mg/dL (High). HbA1c 5.7%. Weight 182 lb.\n" +
      "Vitamin D, 25-OH: 18 ng/mL (Low). Impression: Hyperlipidemia. Vitamin D deficiency.",
  },
  {
    key: "er2026",
    filename: "Stanford_ED_Jan2026.pdf",
    org: "Stanford Health",
    kind: "visit_summary",
    pages: 3,
    receivedVia: "demo",
    receivedAt: d(2026, 1, 11),
    excerpt:
      "STANFORD EMERGENCY DEPARTMENT — Dr. James Whitaker.\n" +
      "2026-01-10. Chief complaint: atypical chest pain. ECG normal. Troponin negative.\n" +
      "BP 138/86. Discharged. Recommend outpatient lipid management.",
  },
  {
    key: "stanFeb2026",
    filename: "Stanford_Labs_Feb_2026.pdf",
    org: "Stanford Health",
    kind: "labs",
    pages: 3,
    receivedVia: "demo",
    receivedAt: d(2026, 2, 14),
    excerpt:
      "STANFORD HEALTH CARE — Laboratory report (page 3).\n" +
      "2026-02-14. LDL Cholesterol 171 mg/dL (High). HbA1c 5.8%. Weight 186 lb. BP 134/84.",
  },
  {
    key: "stanMar2026",
    filename: "Stanford_Visit_Mar2026.pdf",
    org: "Stanford Health",
    kind: "visit_summary",
    pages: 4,
    receivedVia: "demo",
    receivedAt: d(2026, 3, 6),
    excerpt:
      "STANFORD HEALTH CARE — Follow-up, Dr. Priya Nair.\n" +
      "2026-03-05. Diagnosis: Hyperlipidemia. Started Atorvastatin 10 mg daily.\n" +
      "Medication list: Atorvastatin 10 mg, Metformin 1000 mg, Vitamin D3 1000 IU.\n" +
      "Allergy: Penicillin. Recheck lipids in 3 months.",
  },
  {
    key: "quest2026",
    filename: "Quest_Labs_Jun2026.pdf",
    org: "Quest Diagnostics",
    kind: "labs",
    pages: 1,
    receivedVia: "demo",
    receivedAt: d(2026, 6, 18),
    excerpt:
      "QUEST DIAGNOSTICS — Patient: Williams, Sarah.\n" +
      "Collected 2026-06-16. LDL Cholesterol 139 mg/dL. HbA1c 5.7%. Weight 184 lb.\n" +
      "Note: repeat lipid panel following statin initiation.",
  },
  {
    key: "ucsfMed2026",
    filename: "UCSF_MedList_2026.pdf",
    org: "UCSF",
    kind: "clinical_export",
    pages: 2,
    receivedVia: "demo",
    receivedAt: d(2026, 6, 25),
    excerpt:
      "UCSF — Reconciled medication list.\n" +
      "2026-06-24. Metformin 500 mg daily. Atorvastatin 10 mg daily. Vitamin D3.\n" +
      "Allergies: No known drug allergies.",
  },
];

export const DEMO_PROVIDERS = [
  { name: "Dr. Alan Reyes", org: "Bay Valley Family Medicine", specialty: "Family Medicine" },
  { name: "Dr. Priya Nair", org: "Stanford Health", specialty: "Internal Medicine" },
  { name: "Dr. Marcus Feld", org: "UCSF", specialty: "Cardiology" },
  { name: "Dr. Lena Osei", org: "Stanford Radiology", specialty: "Radiology" },
  { name: "Dr. James Whitaker", org: "Stanford Health", specialty: "Emergency Medicine" },
  { name: "Quest Diagnostics", org: "Quest Diagnostics", specialty: "Laboratory" },
];

type Obs = {
  code: string;
  label: string;
  value: number;
  unit: string;
  date: number;
  provider?: string;
  doc: string;
  page: number;
};

export const DEMO_OBSERVATIONS: Obs[] = [
  // LDL — the hero trend: 104 → 171 → 139
  { code: "LDL", label: "LDL Cholesterol", value: 104, unit: "mg/dL", date: d(2018, 3, 12), doc: "prev", page: 2 },
  { code: "LDL", label: "LDL Cholesterol", value: 104, unit: "mg/dL", date: d(2019, 4, 8), doc: "prev", page: 4 },
  { code: "LDL", label: "LDL Cholesterol", value: 117, unit: "mg/dL", date: d(2021, 5, 19), doc: "prev", page: 8 },
  { code: "LDL", label: "LDL Cholesterol", value: 123, unit: "mg/dL", date: d(2022, 6, 15), doc: "prev", page: 11 },
  { code: "LDL", label: "LDL Cholesterol", value: 128, unit: "mg/dL", date: d(2023, 7, 18), provider: "Dr. Priya Nair", doc: "stan2023", page: 2 },
  { code: "LDL", label: "LDL Cholesterol", value: 142, unit: "mg/dL", date: d(2024, 9, 12), doc: "stan2024", page: 1 },
  { code: "LDL", label: "LDL Cholesterol", value: 158, unit: "mg/dL", date: d(2025, 5, 20), provider: "Dr. Marcus Feld", doc: "ucsf2025", page: 1 },
  { code: "LDL", label: "LDL Cholesterol", value: 164, unit: "mg/dL", date: d(2025, 8, 7), doc: "quest2025", page: 1 },
  { code: "LDL", label: "LDL Cholesterol", value: 171, unit: "mg/dL", date: d(2026, 2, 14), doc: "stanFeb2026", page: 3 },
  { code: "LDL", label: "LDL Cholesterol", value: 139, unit: "mg/dL", date: d(2026, 6, 16), doc: "quest2026", page: 1 },

  // HbA1c — 5.1 → 5.8
  { code: "HBA1C", label: "HbA1c", value: 5.1, unit: "%", date: d(2018, 3, 12), doc: "prev", page: 2 },
  { code: "HBA1C", label: "HbA1c", value: 5.3, unit: "%", date: d(2023, 7, 18), doc: "stan2023", page: 2 },
  { code: "HBA1C", label: "HbA1c", value: 5.5, unit: "%", date: d(2024, 9, 12), doc: "stan2024", page: 1 },
  { code: "HBA1C", label: "HbA1c", value: 5.7, unit: "%", date: d(2025, 5, 20), doc: "ucsf2025", page: 1 },
  { code: "HBA1C", label: "HbA1c", value: 5.7, unit: "%", date: d(2025, 8, 7), doc: "quest2025", page: 1 },
  { code: "HBA1C", label: "HbA1c", value: 5.8, unit: "%", date: d(2026, 2, 14), doc: "stanFeb2026", page: 3 },
  { code: "HBA1C", label: "HbA1c", value: 5.7, unit: "%", date: d(2026, 6, 16), doc: "quest2026", page: 1 },

  // Weight — 168 → 186
  { code: "WEIGHT", label: "Weight", value: 168, unit: "lb", date: d(2018, 3, 12), doc: "prev", page: 2 },
  { code: "WEIGHT", label: "Weight", value: 169, unit: "lb", date: d(2019, 4, 8), doc: "prev", page: 4 },
  { code: "WEIGHT", label: "Weight", value: 172, unit: "lb", date: d(2021, 5, 19), doc: "prev", page: 8 },
  { code: "WEIGHT", label: "Weight", value: 174, unit: "lb", date: d(2023, 7, 18), doc: "stan2023", page: 2 },
  { code: "WEIGHT", label: "Weight", value: 178, unit: "lb", date: d(2024, 9, 12), doc: "stan2024", page: 1 },
  { code: "WEIGHT", label: "Weight", value: 182, unit: "lb", date: d(2025, 8, 7), doc: "quest2025", page: 1 },
  { code: "WEIGHT", label: "Weight", value: 186, unit: "lb", date: d(2026, 2, 14), doc: "stanFeb2026", page: 3 },
  { code: "WEIGHT", label: "Weight", value: 184, unit: "lb", date: d(2026, 6, 16), doc: "quest2026", page: 1 },

  // Vitamin D
  { code: "VITD", label: "Vitamin D, 25-OH", value: 18, unit: "ng/mL", date: d(2025, 8, 7), doc: "quest2025", page: 1 },
];

type Med = {
  name: string;
  normalizedName: string;
  dose?: number;
  doseUnit?: string;
  status: string;
  startDate?: number;
  prescriber?: string;
  doc: string;
  page: number;
};

export const DEMO_MEDICATIONS: Med[] = [
  { name: "Metformin", normalizedName: "metformin", dose: 500, doseUnit: "mg", status: "active", startDate: d(2025, 5, 20), prescriber: "Dr. Marcus Feld", doc: "ucsf2025", page: 2 },
  { name: "Atorvastatin", normalizedName: "atorvastatin", dose: 10, doseUnit: "mg", status: "active", startDate: d(2026, 3, 5), prescriber: "Dr. Priya Nair", doc: "stanMar2026", page: 1 },
  { name: "Vitamin D3", normalizedName: "cholecalciferol", dose: 1000, doseUnit: "IU", status: "active", startDate: d(2025, 8, 7), doc: "quest2025", page: 1 },
];

type Cond = {
  name: string;
  normalizedName: string;
  status: string;
  diagnosedDate?: number;
  doc: string;
  page: number;
};

export const DEMO_CONDITIONS: Cond[] = [
  { name: "High cholesterol", normalizedName: "hyperlipidemia", status: "active", diagnosedDate: d(2023, 7, 18), doc: "stan2023", page: 2 },
  { name: "Hyperlipidemia", normalizedName: "hyperlipidemia", status: "active", diagnosedDate: d(2025, 8, 7), doc: "quest2025", page: 1 },
  { name: "Prediabetes", normalizedName: "prediabetes", status: "active", diagnosedDate: d(2025, 5, 20), doc: "ucsf2025", page: 1 },
  { name: "Vitamin D deficiency", normalizedName: "vitamin_d_deficiency", status: "active", diagnosedDate: d(2025, 8, 7), doc: "quest2025", page: 1 },
];

type Enc = {
  kind: string;
  title: string;
  provider?: string;
  org?: string;
  date: number;
  summary?: string;
  doc: string;
  page: number;
};

export const DEMO_ENCOUNTERS: Enc[] = [
  { kind: "Annual physical", title: "Annual physical", provider: "Dr. Alan Reyes", org: "Bay Valley Family Medicine", date: d(2018, 3, 12), summary: "Healthy baseline.", doc: "prev", page: 2 },
  { kind: "Annual physical", title: "Annual physical", provider: "Dr. Alan Reyes", org: "Bay Valley Family Medicine", date: d(2019, 4, 8), doc: "prev", page: 4 },
  { kind: "Annual physical", title: "Annual physical", provider: "Dr. Alan Reyes", org: "Bay Valley Family Medicine", date: d(2021, 5, 19), doc: "prev", page: 8 },
  { kind: "Visit", title: "New patient — establish care", provider: "Dr. Priya Nair", org: "Stanford Health", date: d(2023, 7, 18), summary: "New PCP. Borderline cholesterol noted.", doc: "stan2023", page: 1 },
  { kind: "Labs", title: "Laboratory panel", org: "Stanford Health", date: d(2024, 9, 12), doc: "stan2024", page: 1 },
  { kind: "Specialist visit", title: "Cardiology consult", provider: "Dr. Marcus Feld", org: "UCSF", date: d(2025, 5, 20), summary: "Dyslipidemia + prediabetes. Metformin started.", doc: "ucsf2025", page: 1 },
  { kind: "ER visit", title: "Emergency — chest pain", provider: "Dr. James Whitaker", org: "Stanford Health", date: d(2026, 1, 10), summary: "Atypical chest pain. Cardiac workup negative.", doc: "er2026", page: 1 },
  { kind: "Labs", title: "Laboratory panel", org: "Stanford Health", date: d(2026, 2, 14), doc: "stanFeb2026", page: 3 },
  { kind: "Visit", title: "Follow-up — statin started", provider: "Dr. Priya Nair", org: "Stanford Health", date: d(2026, 3, 5), summary: "Hyperlipidemia. Atorvastatin 10 mg initiated.", doc: "stanMar2026", page: 1 },
  { kind: "Labs", title: "Repeat lipid panel", org: "Quest Diagnostics", date: d(2026, 6, 16), summary: "LDL down to 139 after statin.", doc: "quest2026", page: 1 },
];

export const DEMO_ALLERGIES = [
  { substance: "Penicillin", reaction: "Rash", doc: "stan2023", page: 1 },
];

export const DEMO_MISSING = [
  { label: "Knee MRI (left)", org: "Stanford Radiology", date: d(2024, 5, 14), referencedIn: "ucsf2025" },
];

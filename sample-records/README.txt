TraceHealth — sample records for testing "Add data"
====================================================

Go to  Add data  in the app and try each file:

PASTE / UPLOAD A RECORD  (AI extraction — runs as a background job)
  01-quest-lab-report.txt      Drop it, or paste its text, then "Extract with AI".
                               Expect ~6 labs + 1 allergy (Penicillin).
  02-after-visit-summary.txt   Clinical note → 2 meds (Atorvastatin, Lisinopril),
                               2-3 conditions, 1 allergy, 1 visit.
  03-labcorp-lab-report.pdf    Real PDF → tests the native PDF reader.
                               Expect Vitamin D, eGFR, glucose, LDL, weight, BP,
                               + Codeine allergy.

IMPORT A DATA FILE  (deterministic parser — no AI)
  04-fhir-bundle.json          FHIR R4 Bundle → 5 labs, 2 meds, 1 condition,
                               1 allergy (Sulfa), 1 encounter.
  05-tracehealth-export.json   TraceHealth JSON export → imports exactly.

Tip: uploads dedup, so re-uploading the same file reports "duplicates skipped".
Some values overlap on purpose (e.g. LDL across dates) so Trends/Compare light up.

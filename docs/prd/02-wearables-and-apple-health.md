# PRD 02 — Wearables & Apple Health

Add the *other half* of health data: the continuous, day-to-day signal — steps, heart rate, sleep, glucose, weight, blood pressure — that clinical records never contain. Turns TraceHealth from "your medical file" into "your whole health picture."

## Problem
Clinical records are sparse snapshots taken at visits. The richest picture of someone's health between visits lives on their phone and wrist (Apple Health, Fitbit, Oura, CGM). None of it is in TraceHealth. But TraceHealth is a **web app with no native mobile app**, and the two biggest sources — **Apple Health and Google Health Connect — are on-device with no cloud API**, so they're unreachable from the web (even through aggregators, which read them via a mobile SDK).

## Goals
- Get wearable/consumer time-series in **without** shipping a native app first.
- Cover iPhone users (the majority) via a **file-based path**.
- One integration that unlocks *many* devices, not per-vendor OAuth sprawl.
- Store dense time-series efficiently and plot it alongside clinical labs.

## Non-goals
- Live Apple Health / Health Connect sync (requires a companion native app — Phase 3).
- Direct per-vendor OAuth for every wearable (an aggregator replaces this).

## Integration choices (from PRD 00)
| Path | Pick | Why | Web-feasible now? |
|---|---|---|---|
| iPhone users, no app | **Apple Health XML export import** | User exports `export.zip` from the Health app; we parse `export.xml` **client-side** and write normalized observations. Point-in-time, but covers everything HealthKit has. | ✅ |
| Many wearables at once | **Vital/Junction** (or **Terra**) | One per-user connect + one normalized schema → Oura, Fitbit, Whoop, Garmin, Withings, Dexcom, etc. Vital **also does nationwide lab ordering + results** (fits a health record). | ✅ for cloud sources |
| Live Apple/Health Connect | Companion **iOS app** + aggregator **mobile SDK** | Only way to reach on-device stores | ❌ needs native app (P3) |

**Don't** build net-new on the legacy Fitbit Web API (sunsetting ~Sep 2026) or Google Fit REST (deprecated); go through an aggregator or Google Health API.

## Technical design

### Apple Health XML import (Phase 1 — the pragmatic 80%)
- Apple has **no cloud API**. Only web path: Health app → profile → **Export All Health Data** → `export.zip` (all HealthKit records; no date filter; often 0.5–2 GB).
- **Parse in the browser** with a streaming XML parser (don't upload multi-GB to Convex). Extract `<Record type="HKQuantityTypeIdentifier…">` (HR, steps, weight, BP, SpO2, glucose, …) and `<Workout>`/sleep, downsample, and write **normalized `deviceObservations` + daily summaries** back via a mutation.
- Set expectations in UI: **snapshot, not live sync** — "re-export to refresh."

### Aggregator (Phase 3 — the multi-wearable unlock)
- `convex/integrations/vital.ts`: per-user connect link → webhook/pull normalized time-series + daily summaries → `deviceObservations` / `dailySummaries`, `source: "vital"`.
- Same schema absorbs it — no rework. When a native app later adds live Apple/HC via the aggregator's SDK, it lands in the same tables.

### Data model (see PRD 05)
Wearable data is **dense, high-frequency, self-reported time-series** — model it **separately** from clinical labs:
- `deviceObservations`: `source`, `sourceType`, `metric`, `value`, `unit`, `startTime`, `endTime`, `timezone`, `providerRecordId` (dedup), `ingestedAt`. Index `(userId, metric, startTime)`.
- `dailySummaries`: `date`, `metric`, min/max/avg/sum — because rendering a year of 5-min HR/glucose from raw is too heavy; aggregators emit these, mirror them.
- Cross-source dedup on `source` + `providerRecordId` (the same walk can arrive from Apple *and* Fitbit).

### Why not force it into `observations`
Clinical `observations` are LOINC-coded, sparse, single-timestamp, reference-ranged, provenance-heavy. Wearable data is uncoded, interval-based (sleep/workouts), volume-heavy, self-reported. Keep parallel tables sharing a thin UI type so one chart can overlay an HbA1c lab point on a CGM stream.

## UX
- **Add data → "Connect a device"**: Apple Health (upload `export.zip`) + "Connect a wearable" (aggregator).
- **New "Vitals/Activity" surface**: trends for HR, sleep, steps, weight, BP, glucose — and glucose/BP overlaid with the matching clinical labs.
- **AI**: the agent can read device data ("how's my resting heart rate trending?", "did my sleep get worse this month?") via new read tools; and correlate ("your glucose spikes correlate with…") — grounded, with the same citation discipline.

## Risks
- **Apple export size** (multi-GB) → client-side streaming parse + downsample; never ship raw to backend.
- **Snapshot vs live** confusion → explicit UI copy; nudge to companion app later.
- **Aggregator cost** (Terra ~$399/mo; Vital usage-based) → gate behind Phase 3 / real usage.
- **Volume** (millions of rows/user) → daily summaries + retention/downsampling policy; index discipline.
- **Fitbit sunset / Google Fit deprecation** → don't build direct; aggregator only.

## Success metrics
- Apple export imports; wearables connected; metrics ingested/user.
- Vitals surface engagement; lab×device overlays viewed.
- AI queries over device data.

## Phasing
- **P1:** `deviceObservations` + `dailySummaries` (PRD 05); **Apple Health XML import** (client-side parse); Vitals/Activity trend view; AI read tools for device metrics.
- **P2:** **Vital/Terra** aggregator (cloud wearables); glucose/BP lab overlays; correlation insights.
- **P3:** companion **iOS app** for live Apple Health / Health Connect via aggregator SDK; Dexcom direct if diabetes-focused.

### Sources
Apple export [applehealthdata.com] · Apple/aggregator SDK note [docs.tryterra.co] · Vital [tryvital.io, docs.tryvital.io] · Terra [tryterra.co, docs.tryterra.co] · Oura [cloud.ouraring.com/docs] · Dexcom [developer.dexcom.com] · Fitbit sunset [openwearables.io/integrations/fitbit] · Google Fit/Health Connect [developer.android.com/health-and-fitness/health-connect].

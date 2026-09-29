# TransitX Smart Planner failure diagnosis — 2026-09-29

## Reproduction and root cause

The running development site was tested through its journey form and `/api/planner/plan`; the browser subsequently displayed a generated four-day 淡水 itinerary. Before the fix, a four-day 淡水 request with the friends / food + photography / exploration / moderate walking / leisurely profile returned HTTP 200 for the NDJSON transport but ended with an `INSUFFICIENT_POIS` error event, so no trip was saved. HTTP 200 alone must not be interpreted as planning success.

The Wikipedia provider had **50 usable, source-backed POIs**. The planner's additional popularity *hard filter* discarded 23, leaving 27. Farthest-point day seeding then split them into clusters of **21 / 2 / 1 / 3**; day three had only one POI, while the validator required two per day. This was a selection/validation failure, **not** an empty provider response or missing destination resolution. A separate multi-day must-visit regression allowed the mandatory POI to be selected once as an optional stop and again on its assigned day, leading to `PLANNER_VALIDATION: 行程重複安排地點`.

## Actual POI pipeline: 淡水

The live health run forced a fresh Wikipedia GeoData request; all 13 provider HTTP requests returned **200**. The 451 raw rows include duplicates from geographic grid queries and the zh/en language passes; these numbers are not distinct landmarks.

| Stage | Input | Output | Rejected | Reason / measured work |
| --- | ---: | ---: | ---: | --- |
| Destination resolution | 淡水 | 1 region | 0 | 淡水區, 滬尾, 新北市, 臺灣; center 25.1813044, 121.4531477; bbox 25.1229096–25.2443972 / 121.4043057–121.5225623 |
| POI provider grid queries | 13 HTTP requests | 451 rows | — | Wikipedia GeoData; HTTP 200 throughout; first uncached fetch 13.27 s |
| Normalize / deduplicate | 451 | 148 | 303 | Duplicate GeoSearch IDs per language/grid |
| Geographic filter | 148 | 80 | 68 | Outside the verified district geometry / bbox / radius |
| Category filter | 80 | 70 | 10 | Non-visit or excluded categories |
| Language alias deduplication | 70 | 52 | 18 | Only independently useful English aliases retained |
| Final provider suitability | 52 | 50 | 2 | Excluded non-visit records |
| Planner category / coordinate gate | 50 | 50 | 0 | No popularity hard filter; restaurant data is separate |
| Profile scoring | 50 | 50 | 0 | Preferences modify scores, not eligibility |
| Four-day cluster / selection | 50 | 8 selected | 42 not selected | Two unique POIs per day in the tested leisurely profile; preference, distance and capacity determine the final eight |
| Food | 0 verified restaurants | 4 meal slots | — | Generic nearby meal slots, **not invented restaurant names** |
| Route / schedule / validation | 8 POIs | 4 valid days | 0 | Source IDs, geofence, dates, chronology and no duplicate POIs validated |

The development server now records each stage's input/output counts, rejected count and reason, elapsed/duration timings, HTTP statuses and response times, selected POIs, route order and final validation. A failure records its real code, message, stack and preceding stages server-side. The production UI only displays a specific human-readable error; development UI adds the error code. No secret is logged.

## Fixes

1. Changed low-popularity POIs from hard rejection to a base-score penalty. Source, coordinates and geography remain hard requirements.
2. Seeded multi-day clusters using strong candidate scores and appropriate local separation; a distance-to-center fallback keeps each day allocated if clustering cannot form groups.
3. Reserved one unique verified POI for every remaining day before filling the current day. When a day has fewer than the preferred density, it receives a verified POI, a generic meal slot and clearly identified free time, never a synthetic landmark.
4. Reserved must-visit POIs for their assigned cluster/day, preventing selection on two days.
5. Added route optimization fallback to nearest-neighbor, then geographic-distance ordering. Food-option failure falls back to a generic meal slot.
6. Changed the trip validator's minimum to one verified POI per day while retaining source, date, geography, chronology and uniqueness checks.
7. Added focused planner/provider health tests and a live provider/endpoint acceptance command.

## Real-data outcomes

The following all used the same algorithm and Wikipedia-sourced POI set, with no city-specific itinerary template:

| Case | Result | Verified POIs | Example selection / variation |
| --- | --- | ---: | --- |
| 淡水 1 day, friends | PASS | 2 | Tamsui Old Street; 淡水漁人碼頭 |
| 淡水 2 days, friends | PASS | 4 | Tamsui Old Street / 漁人碼頭; Tamsui Customs Wharf / 牛津學堂 |
| 淡水 4 days, friends | PASS | 8 | Includes 公司田溪橋遺跡 and 淡水漁人碼頭 |
| 淡水 4 days, solo culture + photography | PASS | 12 | Includes 鄞山寺, 紅毛城, museum/historic stops; higher density |
| 淡水 4 days, family low-walking | PASS | 8 | Shorter local routes (0.70 / 0.80 / 0.72 / 0.98 km straight-line order) |
| 淡水 4 days, friends low-budget/busy | PASS | 16 | Four stops per day; different categories and route order |
| 紅毛城 must-visit, 1 / 2 / 4 days | PASS | 2 / 4 / 8 | Present exactly once in each complete trip |
| 台北 / 台中 / 台南 / 高雄 | PASS | 4 each for 2 days | Tested against cached, previously fetched Wikipedia POIs |
| 東京 / 大阪 | PASS | 4 each for 2 days | Tested against cached, previously fetched Wikipedia POIs |

Browser: entered 淡水, selected four days, added 紅毛城 as a must-visit, submitted the real journey form, and reached a four-day itinerary. Clicking Day 1–4 showed 紅毛城 on exactly one day. Direct server endpoint: one-, two- and four-day requests with 紅毛城 returned HTTP 200 plus a result event, with no error event. The local planner algorithm averaged **2.93 ms** over the twelve initial live-acceptance profile/city calculations; network fetching is separate and dominated the uncached run.

## Verification commands

- `npm run test:planner` — resolver/provider fixture, scoring, selection, route, schedule, validation, sparse multi-day and must-visit uniqueness.
- `npm run test:planner:live` — fresh 淡水 Wikipedia request, 1/2/4-day and profile variants, other cached city datasets, must-visit and replan.
- `node scripts/smart-planner-endpoint.js 4` — actual development HTTP endpoint and NDJSON result.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — engineering regression.

The provider's restaurant count for 淡水 is zero, so meal slots remain suggestions only. Opening hours and actual travel times are not asserted; they must be checked separately. No LLM, fixed city template, fabricated POI, bus API change or UI redesign was introduced.

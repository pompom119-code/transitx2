# TransitX 2.0 Interaction Audit

Audit date: 2026-09-21  
Scope: `src/` interactive controls, routes, state, feedback, persistence and motion.

## Baseline findings

The original implementation rendered each reference image as a static page and placed transparent hotspot buttons above it. That protected the visual target, but most apparent controls were not represented by real inputs, stateful tabs, forms or data-backed lists.

| Area | Audit category | Baseline issue | Resolution in this pass |
| --- | --- | --- | --- |
| Global navigation | G, H | In-memory route strings; refresh and browser history were not route-aware | React Router URL routes, SPA navigation and real history back behavior |
| Home search | A, D, E | Search was a button; no typing, suggestions, submit or result state | Search form, suggestions, query URL and mock async results |
| Home cards/chips | B, D | Several entries opened one hardcoded route regardless of content | Data-backed route/stop links with press feedback |
| AI profiles | D, E | Four static cards; no selected profile, edit or reset state | Persistent profile objects, profile action sheet, select/edit/reset/use actions |
| Setup 1–8 | B, D, E | One full-page hotspot only displayed a toast | Real single/multi/custom selections, persisted draft, validation and retained back navigation |
| Trip form | A, E | Destination and day stepper only; no real dates, places or validation | Destination/date/day calculation, specified-place add/remove and disabled CTA validation |
| AI loading | F | Static loading image plus fixed timer | `aiPlanner.generateTrip()` async service, staged progress, transitions and retry error state |
| Itinerary | B, D, E | Static Day/timeline; save only showed a toast | Trip-state days, expandable spots, transport details, favorites and persistent save |
| Itinerary edit | B, E, F | Add/reorder/replace/delete only showed toasts | Framer Motion reorder, add, AI replacement, confirm/undo delete and day replan |
| Traffic search | A, D, E | Static results; no query or tabs | Input, async search, skeleton, error/retry and working result tabs |
| Bus route | B, D, E | Direction and favorite were local-only; reminder was a toast | Persistent favorite, real direction data, clickable stops and reminder sheet |
| Stop detail | B, D, E | Tabs/favorite/refresh had no real state | Stateful tabs, persistent favorite, async refresh and last-updated feedback |
| Wander | B, D, E, F | Category and redraw were toasts | Category pools, non-repeating draw, 3D flip, redraw and active challenge state |
| My | D, E | Static fake counts and cards | Saved-trip and favorite data, real empty states and working destinations |
| Settings | B, E | Entire settings region was one hotspot | Persistent theme, notifications, transit preference, font size, sync and logout controls |
| Login | B, E | Handlers did not validate or persist auth | Google/email/register/guest auth abstraction with loading and inline errors |
| Feedback | F | Many actions changed instantly or only used generic toast | Press, page, tab, favorite, sheet, toast, loading, list and card-flip motion |

## Static/fake-function scan

- `TODO`, `FIXME`, `console.log`, `alert(`, `Coming Soon`, `href="#"`: none retained in product source.
- Empty click handlers: none.
- Disabled controls: only validation- or loading-driven controls with explanatory UI state.
- Scope remains public-bus-only for the Transportation module.

## Screenshot UI removal audit

- All former page-level screenshot renderers, transparent hotspots, absolute click zones and screenshot overlays were removed.
- `src/` contains no `reference_ui`, `<img>`, `.png`, `.jpg`, `.jpeg`, `background-image`, `Hotspot` or screenshot lookup references.
- Every visible page is now rendered from selectable HTML text, semantic buttons/forms, inline SVG icons and CSS-drawn decorative/content placeholders.
- The 26 reference images live at project-root `reference_ui/` for manual comparison only. They are outside Vite `public/`, absent from `dist/`, and never enter the application render tree.
- Browser route audit covered 24 public states/routes (including all eight setup steps plus itinerary, map and editor): zero `<img>` elements, zero URL-backed CSS backgrounds, zero horizontal overflow at 440×956, and no reference path in page HTML.
- Interactive targets have a global minimum 44×44 CSS-pixel hit area, with `prefers-reduced-motion` support retained.

## Data boundaries

- `services/aiPlanner.js`: replace with the production AI endpoint later without changing page components.
- `services/transitService.js`: replace mock routes/stops with a real-time public-bus API later.
- `services/authService.js`: replace mock authentication with Supabase Auth later.
- `services/storage.js`: local persistence boundary; can be swapped for Supabase sync or IndexedDB.

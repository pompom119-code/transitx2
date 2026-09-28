# TransitX 2.0 UI Rebuild Audit

Audit date: 2026-09-22  
Visual source: `reference_ui/` (26/26 files inspected at original resolution)  
Target viewport: iPhone 17 Pro Max, `440 × 956` CSS px

## Measurement method

- 24 JPEG references are `709 × 1536` (aspect `0.4616`). Their target conversion is `reference px × 0.6206`.
- 2 PNG references are `852 × 1846` (aspect `0.4615`). Their target conversion is `reference px × 0.5164`.
- All values below are measured from visible reference boundaries and rounded to the nearest useful CSS pixel. `~` means an antialiased or shadow boundary makes the last 1–2 px ambiguous.
- Status/safe area is measured separately from page content. A normal reference has ~54–72 reference px above content (`34–45` CSS px) and ~34–46 reference px around the home indicator (`21–29` CSS px).
- Full-page screenshots are development references only. They must never be imported, cropped, used as a background, or rendered by production components.

## Global tokens inferred from the originals

| Token | Measured target |
| --- | --- |
| Page width | `440px`; centered shell on wider screens |
| Main content gutter | `24–27px` on 709px references; `19–22px` on 852px references |
| Status/safe top | `42–46px` |
| Bottom safe area | `28–34px` including home-indicator clearance |
| Display heading | `31–36px`, weight `850–900`, line-height `1.08–1.15` |
| Page title | `24–28px`, weight `800–900`, line-height `1.15` |
| Section title | `18–21px`, weight `750–850`, line-height `1.25` |
| Body | `13–16px`, weight `450–600`, line-height `1.45–1.6` |
| Caption / metadata | `10–13px`, weight `500–650`, line-height `1.3–1.45` |
| Primary blue | approximately `#2682F6` / `#2F8DFF` |
| Ink | approximately `#080C28` / `#101326` |
| Muted text | approximately `#7884A5` |
| Pale blue surface | approximately `#F3F8FF` |
| White card | `rgba(255,255,255,.94–1)` |
| Card radius | `16–22px`; hero / large cards `24–30px` |
| Pills | `999px` radius |
| Card shadow | `0 7px 22px rgba(62,91,145,.08–.13)` |
| Primary CTA | `50–58px` high; black/ink fill on AI flows, blue fill on auth/wander |
| Touch target | minimum `44 × 44px` without changing visible icon scale |
| Bottom navigation | `92–104px` total including safe area; icons `24–28px`; labels `11–13px` |
| Page transition | `180–240ms`, opacity + ≤`10px` horizontal offset |
| Press motion | `scale(.98)` cards, `scale(.97–.985)` buttons, `80–140ms` |

## Product-rule adaptations that must not alter composition

- Replace every old `Bus+` label with `交通`; keep the same nav slot, icon size, baseline and spacing.
- Bottom navigation remains five items: `首頁｜AI 旅遊｜交通｜亂晃｜我的`. References with four items define the visual style and height; the five items are distributed evenly in the same bar.
- Home/search copy that mentions MRT or rail is changed to bus/stop wording only; component geometry remains unchanged.
- Transportation pages remain bus-only. The bus route detail keeps the reference list layout and must not gain a map.
- The AI preference references may visually show transport preference choices; those belong to the AI profile flow, not a standalone MRT/rail module.

## Reference-to-route inventory and measured page specifications

### 01 — Home

- Reference: `80D73C68-2358-42BF-9285-18DBAFE6C665.jpeg`
- Route: `/`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: status `~52px`; profile button center at `y~75px`; no conventional header bar.
- Padding: `24px` left/right; hero starts `y~108px`.
- Spacing: hero→search `18px`; search→chips `12px`; section gaps `22–27px`.
- Components: search `58px` high; chips `34–38px`; arrival card `~220px`; common-stop cards `~88px`; feature cards `~132px`.
- Cards: radius `18–24px`; feature image split about `56/44`; shadow `0 8px 24px rgba(52,78,130,.10)`.
- Type: hero `36px/1.08/900`; section `20px/800`; row title `15–17px/750`; metadata `11–13px`.
- Icons/images: icons `20–26px`; feature content-image ratio `~1.5:1`; reference photo/mascot assets are not independently supplied.
- CTA/nav: feature cards are CTAs; five-item nav `~94px` including safe area.
- Relative layout: hero and search dominate upper third; nearby list is densest block; navigation is fixed and never overlaps feature cards.

### 02 — AI Travel Home

- Reference: `9E39FAA3-68EE-44E3-8AEE-619653EAF35D.jpeg`
- Route: `/ai`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: status `~51px`; avatar right at `24px`; handwritten notes occupy hero corners.
- Padding: `25px`; title top `~105px`.
- Spacing: title→subtitle `10px`; subtitle→main CTA `19px`; CTA→section title `24px`; card gap `12px`.
- Components: main CTA `58px`; profile cards `~190 × 199px`; add card `~272 × 102px` plus note area.
- Cards: radius `20–22px`; pastel blue/pink/green/yellow; very soft shadow; dotted add-card border.
- Type: hero `34px/1.12/900`; card title `18px/800`; summary rows `11–13px/1.55`.
- Icons/images: CTA icon `30px`, arrow circle `48px`, card mascot zone `~90px` high.
- CTA/nav: main CTA full width; five-item nav `~94px`.
- Relative layout: 2×2 profile grid fills middle; mascot sits between card title and summary without changing card height.

### 03 — AI Setup Step 1

- Reference: `7EE87287-C44F-4549-9185-DED521020A69.jpeg`
- Route: `/ai/setup/1`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: progress at `y~58px`, height `4px`; close button right `44px` target; counter under first segment.
- Padding: `27px`; content title starts `y~157px`.
- Spacing: progress→doodle `28px`; title→description `12px`; description→grid `21px`; grid→tip `20px`.
- Components: four choice cards `~188 × 195px`; tip `~386 × 68px`; CTA `~388 × 52px`.
- Cards: radius `18–20px`; illustration upper `~112px`; translucent white copy footer.
- Type: title `34px/1.1/900`; option `18px/800`; card description `12px`; tags `11px`.
- Icons/images: selection circle `24px`; mascot illustration aspect `~1.5:1`.
- CTA/nav: black CTA `52px`, bottom `~85px` above home indicator; no bottom nav.
- Relative layout: 2×2 cards, equal rows; tip anchors grid to CTA.

### 04 — AI Setup Step 2

- Reference: `76187EB6-601C-4C7B-8098-8F37A051286E.jpeg`
- Route: `/ai/setup/2`
- Ratio/header/padding: same setup shell; `27px` gutter.
- Spacing: title block ends `y~263px`; 3×3 grid begins `~272px`, gaps `9–10px`.
- Components: nine cards `~120 × 137px`; custom preference field `~388 × 68px`; CTA `52px`.
- Cards: radius `17px`; illustration zone ~`88px`; selected tick `22px` at top-right.
- Type: title `34px/1.1/900`; option title `15–16px/800`; detail `10–11px`.
- Icons/images: mascot/card art aspect `~1.15:1`; edit icon `24px`.
- CTA/nav/safe area: same setup shell; CTA fixed near bottom but content remains scroll-safe.
- Relative layout: equal 3 columns; custom input spans full width below grid.

### 05 — AI Setup Step 3

- Reference: `D821F9EC-E149-4D09-A9F9-E6834380CD90.jpeg`
- Route: `/ai/setup/3`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title→cards `22px`; 2×2 card gap `12px`; cards→speech illustration `18px`.
- Components: four cards `~188 × 197px`; speech/mascot band `~388 × 92px`; CTA `52px`.
- Cards: radius `18–20px`; footer height `~78px`; soft four-color surfaces.
- Type: title `34px`; option title `18px/850`; subtitle `12px`; tags `10–11px`.
- Icons/images: card art ratio `~1.55:1`; selection circle `24px`.
- CTA/nav/safe area: black full-width CTA, no bottom nav.
- Relative layout: balanced 2×2 grid; bottom mascot aligns left of speech bubble.

### 06 — AI Setup Step 4

- Reference: `14EBA49F-CD5C-47D3-A2BF-DA5E5CE63B33.jpeg`
- Route: `/ai/setup/4`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title block→3×2 grid `17px`; grid row gap `10px`; custom row `10px`; mascot band `10px`.
- Components: six cards `~188 × 158px`; custom transport field `~388 × 55px`; CTA `52px`.
- Cards: radius `17–19px`; illustration `~92px`; copy footer `~66px`.
- Type: title `34px`; option `16px/800`; tags `9–10px`.
- Icons/images: transport art aspect `~1.65:1`; custom add circle `42px`.
- CTA/nav/safe area: black CTA; no bottom nav.
- Relative layout: denser than other setup screens; optional field remains directly below card grid.

### 07 — AI Setup Step 5

- Reference: `07FAD597-BB44-49DF-881C-D30A8F7DFC7C.jpeg`
- Route: `/ai/setup/5`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title→cards `22px`; card gap `12px`; grid→tip `17px`; tip→CTA `14px`.
- Components: four cards `~188 × 223px`; tip `~388 × 73px`; CTA `52px`.
- Cards: radius `19px`; art `~118px`; copy/tags `~105px`.
- Type: title `34px`; option `17px/850`; description `12px`; tags `10px`.
- Icons/images: selection `24px`; mascot art ratio `~1.55:1`.
- CTA/nav/safe area: same setup CTA/safe pattern.
- Relative layout: 2×2 tall cards; tip includes mascot peeking from lower-right.

### 08 — AI Setup Step 6

- Reference: `B8040A33-E889-4B8B-AB2A-990174AC807F.jpeg`
- Route: `/ai/setup/6`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title→grid `22px`; 3×2 grid gaps `10–12px`; bubble→CTA `12px`.
- Components: six cards `~188 × 175px`; last is real budget input; CTA `52px`.
- Cards: radius `18px`; custom input inside card `~158 × 47px`.
- Type: title `34px`; option `17px/800`; budget `12px`; tags `9–10px`.
- Icons/images: money/travel illustration ratio `~1.6:1`; edit bubble `42px`.
- CTA/nav/safe area: same setup shell.
- Relative layout: 3 rows, two columns; custom budget retains exact card footprint.

### 09 — AI Setup Step 7

- Reference: `F2D9E7B9-8E26-402F-9539-DBE4AB1C75EB.jpeg`
- Route: `/ai/setup/7`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title→cards `23px`; grid gaps `11px`; last card shares row with speech illustration.
- Components: five cards `~188 × 186px`; speech/mascot cell same footprint; CTA `52px`.
- Cards: radius `18px`; art `~105px`; copy footer `~81px`.
- Type: title `34px`; option `17px/850`; detail `11–12px`; tags `10px`.
- Icons/images: selection `24px`; illustrations `~1.55:1`.
- CTA/nav/safe area: same setup shell.
- Relative layout: first two rows full; final card left, decorative speech cell right.

### 10 — AI Setup Step 8

- Reference: `3BAB02B7-BFE2-4F94-AE76-E17EBE69E11B.jpeg`
- Route: `/ai/setup/8`
- Ratio/header/padding: setup shell; `27px` gutter.
- Spacing: title→grid `20px`; 3×2 grid gaps `10px`; bottom mascot→CTA `8px`.
- Components: six cards `~188 × 177px`; final card contains real text input `~160 × 33px`; CTA `52px`.
- Cards: radius `18px`; art `~100px`; copy footer `~77px`.
- Type: title `34px`; option `16px/850`; description `11px`; tags/input `9–10px`.
- Icons/images: selection `24px`; mascot art ratio `~1.55:1`.
- CTA/nav/safe area: black `完成設定` CTA.
- Relative layout: consistent 3×2 grid; completion mascot sits between grid and CTA.

### 11 — Travel Profile Complete

- Reference: `A0031137-B72A-4637-B96E-CB5A7BB6E2DD.jpeg`
- Route: `/ai/setup-complete`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: setup progress remains visible; title block starts `~121px` CSS.
- Padding: `23–27px`; result card `~394px` wide.
- Spacing: title→result card `20px`; card sections `13–18px`; card→secondary actions `14px`.
- Components: result card `~394 × 493px`; summary tiles `~177 × 55px`; secondary buttons `~177 × 51px`; CTA `~388 × 54px`.
- Cards: main radius `22px`; tiles radius `14px`; dashed separator; soft blue card shadow.
- Type: success title `32px/1.12/900`; persona title `29px/900`; tile title `15px/800`; metadata `11px`.
- Icons/images: hero mascot and postcard art need independent assets; tile icons `24px`.
- CTA/nav: black full-width CTA; no bottom nav.
- Relative layout: postcard/profile card is the visual center; CTA sits above illustrated shoreline.

### 12 — Start Planning Trip

- Reference: `49BEF63E-A262-44DE-B98C-51C89710BE1A.jpeg`
- Route: `/ai/new`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: back/skip at `~55px`; hero title begins `~146px`.
- Padding: `26px`; recommendation grid nearly full width.
- Spacing: hero→destination input `15px`; form groups `18–22px`; recommendations→CTA `19px`.
- Components: destination input `68px`; date cards `~190 × 62px`; counter `~388 × 65px`; place input `54px`; destination cards `~91 × 137px`; CTA `54px`.
- Cards: input radius `22–24px`; date/counter `16–18px`; destination cards `14px`; subtle cool-blue shadow.
- Type: hero `34px/1.1/900`; group label `17px/800`; field title `12px`; field value `13px`; destination title `13px/800`.
- Icons/images: hero mascot `~135 × 119px`; destination photos ratio `~1:1`; photos are not independently supplied.
- CTA/nav: black CTA near bottom; no bottom nav.
- Relative layout: functional form occupies middle; destination cards remain one horizontal row at 440px.

### 13 — AI Planning Loading

- Reference: `F1CF0F28-438C-4CA0-92DA-12C66B11C26D.jpeg`
- Route: `/ai/loading`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: no controls; handwritten notes at upper corners.
- Padding: central content `44–48px`; illustration bleeds full width.
- Spacing: headline→subtitle `14px`; subtitle→stepper `25px`; steps `21–24px` apart.
- Components: step indicators `36px`; main illustration `~440 × 280px`; tip card `~388 × 86px`.
- Cards: tip radius `18px`; translucent white with light border.
- Type: headline `34px/1.15/900`; subtitle `15px/1.5`; step title `15px/800`; detail `12px`.
- Icons/images: large planning illustration and desk scene are missing as independent assets; progress spinner `24px`.
- CTA/nav: none; automatic async transition.
- Relative layout: progress occupies upper-middle, illustration fills lower-middle, tip card overlays near bottom.

### 14 — Itinerary Timeline

- Reference: `B1EE252D-D0A8-4A0C-B9CF-99541F10D6BE.jpeg`
- Route: `/trips/:tripId`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: `~58px` control line; title at `24px`; edit pill right.
- Padding: `16–22px`; timeline card `~405px` wide.
- Spacing: header→summary `14px`; summary→day tabs `10px`; tabs→timeline `10px`.
- Components: trip summary `~405 × 100px`; day tabs `48px`; timeline row `95–125px`; transport segment `42px`; bottom actions `58px`.
- Cards: radius `18–22px`; timeline card blue-white; transport segment radius `12px`; shadow very light.
- Type: trip title `25px/900`; day title `23px/900`; place title `14–15px/800`; metadata `10–12px`.
- Icons/images: place photo `~62 × 66px` (`~1:1`); heart `23px`; independent photos unavailable.
- CTA/nav: two sticky actions, left `~178px`, right `~225px`; no main bottom nav.
- Relative layout: vertical blue timeline at ~`72px` from left; photos/text align consistently to its right.

### 15 — Itinerary Map

- Reference: `95BC46A4-F6D6-426D-B842-075697B3C894.jpeg`
- Route: `/trips/:tripId/map`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: title/action line `~60px`; segmented view switch `54px`.
- Padding: header `22px`; map is edge-to-edge; sheet `8px` side gutter.
- Spacing: switch→map `10px`; map→bottom sheet is overlapping, not separated.
- Components: map `~440 × 358px`; mode switch `~404 × 52px`; route toggle `~126 × 43px`; itinerary sheet visible height `~480px`.
- Cards: switch radius `999px`; place labels radius `12px`; bottom sheet top radius `24px`.
- Type: trip title `22px/850`; map labels `12–14px/800`; sheet day title `21px/900`; item titles `13px`.
- Icons/images: map and landmark stickers are missing independent assets; route dots `16–20px`; place photos `~58px` square.
- CTA/nav: internal `回到行程` pill; no bottom nav.
- Relative layout: map occupies upper 42%; timeline sheet occupies lower 50% and overlays map edge.

### 16 — Edit Itinerary

- Reference: `5930C1D4-C7A7-4908-B309-B861F5316EB6.jpeg`
- Route: `/trips/:tripId/edit`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: back/title/complete row `~64px`; summary begins `~118px`.
- Padding: `14–22px`; editor card `~405px` wide.
- Spacing: summary→tabs `10px`; tabs→day card `10px`; row gaps `6–8px`.
- Components: summary `~405 × 92px`; day tabs `48px`; editor card `~405 × 568px`; spot rows `92–103px`; bottom controls `56px`.
- Cards: main radius `20px`; spot photo `60px` square; button pills `36–44px`; dashed add row.
- Type: page title `25px/900`; summary `23px/900`; spot title `13–14px/800`; metadata `10–11px`.
- Icons/images: drag handle `20px`; replace/edit/delete `20px`; photos unavailable independently.
- CTA/nav: `完成` black pill `72 × 43px`; two bottom utility buttons.
- Relative layout: drag handles form a left rail; time, photo and content columns stay aligned across rows.

### 17 — Traffic Home

- Reference: `3DA344C7-E2DF-478B-85E1-2FB1FDADF286.png`
- Route: `/traffic`
- Ratio: `852 × 1846` → `440 × 953`
- Header/safe area: brand at `~58px`; no back button.
- Padding: `19–21px` due 852px source; search begins `~169px` CSS.
- Spacing: search→module cards `27px`; cards→favorites `21px`; section gaps `18–24px`.
- Components: search `58px`; two modules `~197 × 72px`; favorites `~402 × 126px`; nearby card `~402 × 302px`.
- Cards: radius `16–20px`; white surfaces with `0 8px 24px rgba(49,77,135,.09)`.
- Type: brand `31px/850`; module title `16px/800`; section `18px/850`; row `14px`.
- Icons/images: module icons `42px` tile; stop icon `28px`; route pills `32–38px`.
- CTA/nav: five-item nav adapted from four-item visual, `~98px` including safe area.
- Relative layout: search is widest control; nearby rows have stop icon left, route pills right.

### 18 — Traffic Search

- Reference: `C8188240-C15F-47A9-8DF3-CF9801F1EDED.jpeg`
- Route: `/traffic/search`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: back/brand block `~80px`; search below.
- Padding: `17–22px`; result groups `~405px` wide.
- Spacing: search→tabs `14px`; tabs→results `13px`; result sections `13px`.
- Components: search `55px`; four tabs `44px`; route group `~405 × 177px`; stop group `~405 × 226px`; places group `~405 × 226px`.
- Cards: group radius `18px`; row radius `14px`; light separator/border.
- Type: search value `16px`; tab `13px`; group title `18px/850`; result title `14–15px/750`; detail `11px`.
- Icons/images: group icons `25px`; route badges `64 × 45px`; stop tiles `40px`.
- CTA/nav: five-item nav, fixed.
- Relative layout: grouped results stack vertically; tabs stay one row.

### 19 — Bus Route Detail

- Reference: `61C404B9-0807-461D-8635-1D3285CAE3E8.jpeg`
- Route: `/traffic/routes/:routeId`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: back/brand/favorite/menu `~80px`.
- Padding: `18px`; route content full usable width.
- Spacing: route title→direction tabs `16px`; info card→arrival `12px`; sections `10–13px`.
- Components: route badge `116 × 48px`; direction switch `~320 × 50px` + action; info card `~405 × 84px`; arrival card `~405 × 160px`; stops `~405 × 370px`; bottom actions `58px`.
- Cards: radius `15–18px`; route badge radius `12px`; list uses continuous vertical timeline.
- Type: route `26px/900`; destination `18px/750`; section `17px/850`; stop `13px`; ETA `12px`.
- Icons/images: header icons `24px`; bus/clock icons `22px`.
- CTA/nav: split favorite/reminder action bar; no map and no main nav.
- Relative layout: direction first, metrics second, real-time card third, complete stop order fourth.

### 20 — Stop Detail

- Reference: `72ABC529-2312-4694-9EE2-1F189D6A9BE1.jpeg`
- Route: `/traffic/stops/:stopId`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: back/brand/favorite/menu `~80px`; stop title beneath.
- Padding: `18px`; cards `~405px` wide.
- Spacing: stop title→tabs `20px`; tabs→results `18px`; rows `8px`.
- Components: three tabs `50px`; arrival rows `~405 × 65px`; footer/update note `48px`.
- Cards: rows radius `14px`; white surface, subtle blue shadow.
- Type: stop title `25px/900`; tab `14px`; route badge `21px/850`; ETA `15px/750`; detail `11px`.
- Icons/images: stop icon `37px`; favorite `24px`; live glyph `19px`.
- CTA/nav: five-item nav adapted from four-item reference.
- Relative layout: route badge left, destination center, real-time ETA and favorite right.

### 21 — Stop Detail Duplicate Verification

- Reference: `72ABC529-2312-4694-9EE2-1F189D6A9BE1(1).jpeg`
- Route: `/traffic/stops/:stopId`
- Pixel hash: identical to item 20 (`5BE91E433660…`).
- All width, height, padding, typography, card, icon, CTA, nav and safe-area measurements are exactly the same as item 20.
- Implementation consequence: one reusable `StopPage` state, not a second page.

### 22 — Wander Draw

- Reference: `2C4E9EA6-EFF9-42C3-8268-2B37C9382997.jpeg`
- Route: `/wander`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: brand/title begins near `50px`; handwritten note at right.
- Padding: `16–24px`; category row nearly edge-to-edge.
- Spacing: intro→categories `16px`; categories→deck `19px`; deck→CTA `22px`.
- Components: category cards `~73 × 84px`; center deck `~250 × 335px`; draw CTA `~244 × 56px`; speech band `~320 × 81px`.
- Cards: deck radius `28px`; side cards rotated behind; category radius `12px`.
- Type: page title `30px/900`; category `14px/800`; deck handwritten copy `18–22px`; body `14px`.
- Icons/images: category icons `28px`; mascot/deck illustration missing independently.
- CTA/nav: blue draw CTA; five-item nav adapted from reference style.
- Relative layout: deck centered with two offset background cards; speech mascot below CTA.

### 23 — Wander Result

- Reference: `BDB6E35D-023F-48C3-8B60-3F43BDEE640A.jpeg`
- Route: `/wander/result`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area/padding: same wander shell; `16–24px`.
- Spacing: category row→result deck `18px`; deck→pagination `11px`; pagination→actions `12px`.
- Components: result card `~257 × 337px`; action buttons `~188 × 57px`; feedback bubble `~306 × 83px`.
- Cards: result radius `28px`; side cards remain behind; pastel fill depends on category.
- Type: challenge handwritten title `21px/1.5`; category pill `13px`; buttons `17px/750`.
- Icons/images: card illustration/mascot unavailable independently.
- CTA/nav: secondary gray redraw + primary blue accept; five-item nav.
- Relative layout: flipped card occupies center; actions are equal height; active feedback below.

### 24 — My Profile

- Reference: `AF0CD2DC-E377-4740-BE16-C7B6CC4BE53C.jpeg`
- Route: `/me`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: brand and notification/settings `~80px`; profile begins below.
- Padding: `22px`; cards mostly `~396px` wide.
- Spacing: profile→stats `12px`; stats→hero `22px`; sections `20–25px`.
- Components: profile `~396 × 110px`; stats `~58px`; hero `~396 × 87px`; trip cards `~97 × 89px`; favorite list `~396 × 149px`; setting shortcuts `~126 × 69px`.
- Cards: radius `16–21px`; soft blue hero; favorite list continuous white card.
- Type: name `21px/850`; stat number `20px/800`; section `19px/850`; card title `13–14px`.
- Icons/images: profile mascot and banner mascot missing; list icons `28px`.
- CTA/nav: five-item nav adapted from four-item reference.
- Relative layout: information-dense dashboard with consistent vertical rhythm; no fake numeric data when empty.

### 25 — Settings

- Reference: `DA616464-B8B8-46C5-A9F7-2952975E5E38.png`
- Route: `/settings`
- Ratio: `852 × 1846` → `440 × 953`
- Header/safe area: back/title block `~83px`.
- Padding: `20px`; section cards `~400px` wide.
- Spacing: header→account `15px`; account→section `16px`; groups `17–20px`; rows use `0–1px` separators.
- Components: account card `~400 × 105px`; account group `~400 × 146px`; preference group `~400 × 147px`; data group `~400 × 154px`; logout `~235 × 48px`.
- Cards: radius `18–21px`; white with blue haze shadow.
- Type: page title `26px/900`; section `17px/750`; row `14px/750`; detail/value `11–12px`.
- Icons/images: row icons `22px`; account mascot missing independently.
- CTA/nav: pink logout button; five-item nav adapted from four-item reference.
- Relative layout: grouped settings rows, values right-aligned, chevrons fixed at far right.

### 26 — Login / Register / Guest

- Reference: `25CF2B99-8A63-499D-8EF5-BC7382043146.jpeg`
- Route: `/login`
- Ratio: `709 × 1536` → `440 × 954`
- Header/safe area: skip at upper-right; brand starts `~77px`; no back control.
- Padding: `31–43px` in form region; illustration bleeds right.
- Spacing: brand→hero `24px`; hero→form card `14px`; form controls `11–14px`.
- Components: form card `~389 × 471px`; Google CTA `~350 × 58px`; auth tabs `~350 × 44px`; inputs `~350 × 51px`; login CTA `~350 × 57px`; guest CTA `~350 × 51px`.
- Cards: main card radius `26px`; inputs/pills `999px`; blue CTA gradient.
- Type: brand `35px/850`; handwritten hero `21–25px`; button `17px/750`; input `14px`; helper `11px`.
- Icons/images: large window/dog illustration and lower bus scene are missing as independent assets; input icons `21px`.
- CTA/nav: no app nav; Google, email and guest actions remain real controls.
- Relative layout: branding and illustration fill upper 29%; auth card centered; decorative scene fills lower area.

## Asset audit

Only full-page UI screenshots are present. No independent production-safe visual assets were found for:

- TransitX traveler mascot poses and dog mascot poses
- handwritten text/doodles, speech bubbles and decoration lines
- city destination photos
- itinerary attraction/food photos
- map background and landmark stickers
- planning/loading desk illustration
- login window scene and lower bus landscape
- category illustrations and detailed transit pictograms

Implementation rule: use named, replaceable asset slots and CSS/inline-vector placeholders only. Do not crop or import any full-page reference image. These missing source assets will remain explicitly documented until originals are supplied.

## 26/26 completion check

- Files present: `26`
- Files opened and visually inspected: `26`
- Unique pixels: `25`
- Exact duplicate: `72ABC529-2312-4694-9EE2-1F189D6A9BE1(1).jpeg`
- Screen/route mapping complete: yes
- Production import allowed: no
- Ready to begin page 1 rebuild: yes

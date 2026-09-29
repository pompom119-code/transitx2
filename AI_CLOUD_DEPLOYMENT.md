# TransitX Cloud AI：設定與驗收

## 已選方案

- 正式預設：Google Gemini Developer API 的 `gemini-3.7-flash`，由同源 Node `/api/ai/plan` 轉送。瀏覽器不持有 key。伺服器先讀取官方 `models.list`，只從已核對 Standard Free Tier 與 Structured Output 的型號選擇：3.7 Flash → 3.5 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite → 3.8 Flash → 3.6 Flash。503 對每個模型有限退避重試後才切換；任何模型成功才接受結果。
- 本機 WebGPU Qwen 僅供開發者明確設定 `VITE_AI_RUNTIME=local` 後實驗，不是一般使用者預設。
- Google 官方的 Standard Free Tier 對本模型輸入與輸出標示 **Free of charge**。但每個專案實際 RPM、TPM、RPD 上限請以 AI Studio 的當前額度頁為準，不能保證固定數字，也不能假定付費專案不會計費。
- Free Tier 提交的資料可能用於改善 Google 產品；請勿提交敏感個資。
- 本專案不使用 Google Search / Maps grounding 等可能另外計價的功能。真實 POI 查核沿用現有 Nominatim 流程。

官方依據：[模型與 Structured Output](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)、[價格](https://ai.google.dev/gemini-api/docs/pricing)、[額度](https://ai.google.dev/gemini-api/docs/rate-limits)、[API Key](https://ai.google.dev/gemini-api/docs/api-key)。

## 本機設定

1. 在 [Google AI Studio API Keys](https://aistudio.google.com/api-keys) 建立 API key，先確認專案仍屬 Free Tier、未啟用不想使用的付費方案。不要把 key 貼進對話。
2. 在專案根目錄的 `.env` 寫入 `GEMINI_API_KEY=<私密金鑰>`、`GEMINI_FREE_TIER_CONFIRMED=true`。`.env` 已在 `.gitignore`，`.env.example` 只列變數名稱。
3. `VITE_AI_RUNTIME` 留空，執行 `npm run dev`。不要建立 `VITE_GEMINI_API_KEY`；任何 `VITE_` 變數都可能進入瀏覽器 bundle。

設定前，`/api/status` 只會回報 `not-configured`，不會洩露 key。AI 會顯示可理解的失敗提示，不會偷換固定城市模板或示範行程。

## 實作邊界

流程保留兩階段：旅行設定與條件 → Travel Strategy → 逐日 DayDraft → JSON Schema → 語意驗證 → 真實地理查核 → Trip State。餐飲只由 AI 決定區域、食物與理由；沒有 Restaurant Provider 前，不會把 AI 自編店名、地址、營業時間或評分當成事實。

伺服器工作階段採 HttpOnly cookie。每個 session 至多 5 次新規劃／日、兩次開始相隔至少 20 秒，同一 session 的進行中請求不重複送出。同條件成功規劃保留 10 分鐘短期快取；編輯與顯式 fresh 請求繞過快取。Gemini provider 每個存活 Node 實例另設 40 次模型呼叫／UTC 日保守上限（因 6 模型 fallback 在全站 503 時單次最多 18 次呼叫）；一份多天行程會使用多次模型呼叫。取消後不會把不完整行程存入快取或 Trip State。

上述記憶體限流與快取是**單一 process／單一暖機函式實例**，不是跨 Vercel 實例的全站硬配額。公開對不受信任訪客開放時，還需要持久化共享計數器／速率限制與濫用防護；不要把目前限制誤認成零費用保證。Google 專案本身也應保持 Free Tier。

## Vercel

專案已放入 `api/` Node Functions 入口和 `vercel.json` 的 SPA deep-link rewrite。Vercel 的 Project Settings → Environment Variables 應於伺服器環境加入 `GEMINI_API_KEY`、`GEMINI_FREE_TIER_CONFIRMED`；公車功能另需原有 TDX 變數。環境變數設定後須重新部署。不要使用 `VITE_` 前綴存 Gemini key。

**尚未完成 Vercel 真實部署驗收。** Vercel Hobby 函式上限目前為 60 秒；多天兩階段生成加逐點查核可能超過此時間，即使本機 Node 可完成，Vercel 仍可能終止。`vercel.json` 把 AI 函式設在 60 秒；這是配置入口，不是多日可靠性保證。公開上線前須以真 key 測 1／2／4 天的實測耗時；若超過，改用可持續執行的 Node 後端，或拆成可恢復的背景工作流程。參考：[Vercel Vite 部署](https://vercel.com/docs/frameworks/frontend/vite)、[函式時間上限](https://vercel.com/docs/functions/configuring-functions/duration)、[環境變數](https://vercel.com/docs/environment-variables)。

## Key 設定後的真實 Acceptance Test

不得把單元測試的假 provider 視為真實 Gemini 品質測試。設定 key 後需在實際 App 跑：

1. 淡水 A 朋友／美食＋拍照／探索；B 自己／攝影＋文化；C 家人／少走路；D 朋友／低預算／美食。比較 POI、餐飲、停留時間、密度與節奏，不能只是相同景點換順序。
2. 台北、高雄、東京、大阪；各測 1、2、4 天，核對目的地、日期、同行者、天數與指定地點。
3. 測重複點擊、取消、空回應、429、逾時、無效 JSON、跨城市 POI，以及 10 分鐘快取／fresh 重新規劃。
4. 本機 Node 成功後再測部署環境的 API streaming、函式時間、冷啟動、跨實例限流與地理查核。任何失敗不可顯示假成功。

已用使用者提供的私密金鑰測試：官方模型清單成功，但 2026-09-28 的 6 個候選最小生成主要回 Google HTTP 503；3.1 Flash-Lite 在一次 fallback smoke test 的第 3 次嘗試回 HTTP 200，隨後真實淡水行程又因候選模型忙碌而失敗，仍未證明穩定。詳見 `AI_GEMINI_LIVE_TEST.md`。在真實生成與上述驗收通過前，雲端程式仍**不能保證穩定產生可用行程**。金鑰曾被貼進聊天，應在 Google AI Studio 旋轉。

# Gemini 真實連線紀錄（2026-09-28）

## 2026-09-29 重新檢查

檢查時 `127.0.0.1:5173` 沒有 listener，瀏覽器保留的是先前無法連線／失敗的頁面狀態。從 `C:\Users\user\OneDrive\Desktop\TransitX_2.0_Reviewed` 重新啟動 Vite 後，`GET /api/status` 回 HTTP 200、AI `configured`；伺服器端 provider `ready() = true`，官方 `models.list` 成功列出 6 個合格候選。金鑰僅確認為 `SET`，本文未記錄其內容。

直接對這個運行中的 TransitX server 送出 `POST /api/ai/plan`：淡水、朋友 2 人、美食＋拍照、探索派、輕鬆、1 天。Endpoint HTTP 200，stream 先後到達策略、逐日安排、景點與餐飲查核、完整行程檢查，最後回傳 `destination=淡水`、`days=1`、`source=Gemini / gemini-3.5-flash-lite`，耗時 59,452 ms。這表示該次請求已通過原有結構、語意、地理與餐飲驗證，**不是固定模板**。瀏覽器自動化對本機分頁被安全政策拒絕，因此這次只完成真實 server endpoint 驗證，沒有聲稱已親自在瀏覽器操作完整 UI。

同日官方最小 Structured JSON 檢查：3.7 Flash HTTP 200／8,997 ms（診斷腳本的 128 token 上限使其 `MAX_TOKENS`）；3.5 Flash HTTP 200／37,211 ms（同樣 `MAX_TOKENS`）；3.5 Flash-Lite HTTP 200／1,142 ms、有效 JSON；3.1 Flash-Lite HTTP 200／2,998 ms、有效 JSON；3.8 Flash HTTP 503／3,458 ms；3.6 Flash HTTP 503／916 ms。這些狀態會變動，不可把單次成功當成長期可靠性證明。

以下保留 2026-09-28 的歷史測試紀錄，以便分辨舊的 503 與本次成功結果。

測試使用本機 `.env` 的私密金鑰；金鑰未寫入本文件、前端 bundle 或 Git。使用者已確認該 Google AI Studio 專案是 Free Tier。

| 檢查 | 真實結果 |
|---|---|
| `models.get`，3.5／3.7／3.8 Flash | HTTP 200；模型存在且宣告支援 `generateContent` |
| 最小 Structured JSON，原 `responseFormat.text.mimeType` | HTTP 400 `INVALID_ARGUMENT`；已改回此端點可接受的 `responseMimeType`／`responseJsonSchema` |
| 最小 Structured JSON，3.7 Flash | 三次 HTTP 503 `UNAVAILABLE`；Google 回覆模型需求過高 |
| 最小 Structured JSON，3.5／3.6／3.8 Flash | 同樣 HTTP 503 `UNAVAILABLE`；未有任何可解析的模型輸出 |
| 2.5 Flash | HTTP 404；Google 明確回覆新使用者已不可使用，未列為產品 fallback |
| 3.8 Flash Interactions API | HTTP 503，與 GenerateContent 結果一致 |

## 官方清單與本輪 fallback 實測

透過 Google 官方 `GET /v1beta/models`（含分頁）使用目前的 key 查詢，清單中有 44 個宣告 `generateContent` 的 ID；這個欄位**不代表**每一個 ID 都有免費 Standard 文字生成、Structured Output 或目前能成功推論。再與 Google 官方模型能力及 Standard Free Tier 價格頁交集，選出以下 6 個產品候選；不使用臆測的 model ID。2.5 Flash-Lite 雖列在清單且官方文件有 Free Tier，但 Google 同時說明新專案受到限制，故不納入。

| 順位 | 官方 API 實際列出的合格 ID | 一次最小 Structured JSON 請求 | 回應時間 |
|---|---|---|---:|
| Primary | `gemini-3.7-flash` | HTTP 503 `UNAVAILABLE` | 4,923 ms |
| Fallback 1 | `gemini-3.5-flash` | HTTP 503 `UNAVAILABLE` | 2,603 ms |
| Fallback 2 | `gemini-3.5-flash-lite` | HTTP 503 `UNAVAILABLE` | 4,281 ms |
| Fallback 3 | `gemini-3.1-flash-lite` | HTTP 503 `UNAVAILABLE` | 2,232 ms |
| Fallback 4 | `gemini-3.8-flash` | HTTP 503 `UNAVAILABLE` | 6,771 ms |
| Fallback 5 | `gemini-3.6-flash` | HTTP 503 `UNAVAILABLE` | 2,234 ms |

同日較早一次 `gemini-3.1-flash-lite` 最小請求曾回 HTTP 200、`finishReason=STOP`，約 2,823 ms；但下一輪是 503，**尚不能稱為穩定**。完整 fallback smoke test 在 3.7／3.5／3.5 Lite 各 3 次 503 後，3.1 Lite 第 3 次回 HTTP 200 並解析出有效 Structured JSON，約 38.8 秒；沒有嘗試更後面的模型。這證明 fallback 路徑能在模型間切換，但不證明可穩定生成整份行程。

接著實際送出「淡水／朋友 2 人／美食＋拍照／探索派／輕鬆／1 天」端到端測試。進入策略階段後，所有候選在有限重試內都未產出可用回應，約 99.9 秒回 `AI_UNAVAILABLE`；**沒有 Trip State、沒有假行程**。本輪沒有成功生成 TransitX 行程。

這些是**真實 Google API 呼叫**，不是 mock。由於最小 smoke request 曾成功，先嘗試了一次淡水；該次未過，故尚未進入台北／高雄／東京／大阪、1／2／4 天的真實行程品質驗收。不能宣稱 TransitX 雲端 AI 已可穩定生成。現有 Schema／語意／地理／餐飲驗證仍在，但需要模型有穩定回應才能進行端到端驗收。

伺服器對每個模型的暫時性 503 依 [Google 官方故障排除建議](https://ai.google.dev/gemini-api/docs/troubleshooting) 進行有上限的指數退避：600、1,200 ms，最多 3 次請求；仍失敗才切換下一個合格模型。HTTP 400／401／403 立即報錯、不切換；429 只在 `Retry-After` 為可接受的短等待時對同模型有限重試，否則回報額度錯誤。所有候選皆失敗則 UI 顯示「AI 目前比較忙，請稍後再試。」；不會退回固定城市模板或假行程。最近 503 的模型有 5 分鐘冷卻，模型清單快取 15 分鐘。請勿在短時間內反覆觸發大量測試；待 Google Free Tier 容量恢復，再從 `node scripts/gemini-model-diagnostics.js` 及 `node scripts/gemini-smoke.js` 開始，成功且穩定後才跑完整驗收。

官方來源：[模型列表 API](https://ai.google.dev/api/models)、[模型能力](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)、[Standard Free Tier 價格](https://ai.google.dev/gemini-api/docs/pricing)、[2.5 Lite 新專案限制](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite)。金鑰曾被貼進聊天，應在 Google AI Studio **旋轉金鑰**；本文件不記錄金鑰。

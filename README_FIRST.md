# TransitX 2.0 Reviewed

## 啟動

需要 Node.js 22.12 以上。在這個資料夾執行：

```powershell
npm install
npm run dev
```

開啟終端顯示的本機網址（通常是 `http://127.0.0.1:5173/`）。若要檢查工程驗收：

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` 會提供 production build 與同源 API。不能只把 `dist/` 放在純靜態網站，因為公車憑證與地點驗證留在 Node server。預設只監聽 127.0.0.1；公開部署前需重新評估授權、配額、Nominatim 使用政策與伺服器容量。

## AI 旅遊現況

新規劃流程是「旅行設定 + 目的地與日期 + 指定地點 → AI 意圖策略 → 逐日草稿 → Schema／業務驗證 → 真實地點查核 → 行程」。正式路徑沒有固定城市模板，也不會失敗時偷用示範行程。

瀏覽器本機 Qwen3-1.7B / Qwen3.5-2B / Qwen3-4B 經真實 WebGPU 測試，仍未達完整行程可靠性門檻；Qwen3.5-4B 在此裝置未能及時進入推論。故**本機模型不再是預設正式路徑**，只有明確設定 `VITE_AI_RUNTIME=local` 才會啟用實驗模式。它可能下載大量權重、等待數分鐘且最後仍失敗，不應當成正式服務。原始輸出、問題分類與實測見 `LOCAL_AI_FAILURE_ANALYSIS.md`、`LOCAL_AI_BENCHMARK.md`、`AI_ACCEPTANCE_TEST.md`。不會儲存假結果或套固定城市模板。

正式路徑現在是同源 Gemini server provider，預設 `gemini-3.7-flash`，並依官方模型清單與 Free Tier／Structured Output 文件限定 5 個 fallback。每個模型最多 3 次 503 退避嘗試，全部忙碌時安全報錯，不用假行程。2026-09-29 從正式專案重啟本機 dev server 後，`/api/status` 回報 AI 已設定；透過 `/api/ai/plan` 的真實淡水／朋友／美食＋拍照／1 天請求成功完成策略、逐日安排、景點與餐飲查核，回傳 `Gemini / gemini-3.5-flash-lite` 行程，約 59 秒。這是**一次真實端到端 server 測試成功**，尚未證明多城市或長期穩定性。前一天 Google HTTP 503 的失敗紀錄及本次通過紀錄見 `AI_GEMINI_LIVE_TEST.md`。金鑰曾被貼進聊天，請在 Google AI Studio 旋轉；不要把 key 放進前端、Git 或文件。使用者 session 有冷卻與每日次數、相同請求有短期快取；這些記憶體限制在多實例部署時不是全站硬配額。官方實際配額以帳號介面為準。設定與限制見 `AI_CLOUD_DEPLOYMENT.md`。

地點查核用 OpenStreetMap Nominatim 公開服務，已加快取與節流；這僅適用低流量原型。AI 自提但查不到或跨目的地的 POI／餐飲區域會觸發重規劃，仍不可靠就不儲存；使用者自己指定但查不到的必訪點可保留並標示未驗證。餐飲預設只推薦「區域 + 吃什麼」，不指定店家；店家搜尋尚無 Places Provider，因此 CTA 明確停用。交通段只顯示待確認，不造假路線、分鐘或即時到站。

## 公車與本機資料

交通模組仍只做台灣公車。TDX 官方路線、站牌、方向、站序與 ETA 由 Node server 查詢；重新整理會請求新的 ETA。可用縣市與速率限制請見 `REAL_DATA_INTEGRATION.md`。TDX 憑證存於本機 `.env`，不得公開；`.env.example` 只列變數名稱。若 API 失敗會顯示錯誤，不會將假 ETA 當真實資料。

旅行設定、行程、收藏與偏好保存在此裝置的瀏覽器；不是雲端同步。Guest 可用，Email 是本機示範，Google 驗證未連接。舊示範行程保留示範標示。

## 相關文件

- `AI_ARCHITECTURE.md`：AI 資料流程與信任邊界。
- `LOCAL_AI_RESEARCH.md`：WebLLM／Transformers.js／模型比較。
- `LOCAL_AI_BENCHMARK.md`：真實瀏覽器模型試跑與耗時。
- `AI_ACCEPTANCE_TEST.md`：六組條件 × 三次生成的驗收紀錄。
- `REAL_DATA_INTEGRATION.md`：前一階段 TDX／Gemini server 整合紀錄；AI 當前狀態以上述新文件為準。
- `AI_CLOUD_DEPLOYMENT.md`：Gemini Free Tier 查證、金鑰與 Vercel 設定、限流範圍及真實驗收清單。
- `AI_GEMINI_LIVE_TEST.md`：使用真實金鑰的模型可用性與 HTTP 503 測試紀錄；不包含金鑰。

# REAL DATA INTEGRATION — updated 2026-09-25

## 結論

本輪直接修改 Desktop/TransitX_2.0_Reviewed；沒有建立 final/new 資料夾，原始工作專案未覆蓋。
**TDX 已使用官方資料完成指定雙北路線與站牌驗收；Gemini 尚無 API Key，不能宣稱真實 AI 生成已驗收。**

## 架構

React → src/services/ai 或 src/services/bus → 同源 /api → server/ai 或 server/bus → 官方 API。
開發由 Vite middleware 承接；production 由 server/start.js 服務 dist 與 API。密鑰只在 Node 讀取，沒有 VITE_ secret。

新增主要檔案：
- server/core.js：錯誤、timeout、cache／in-flight 去重。
- server/api.js：同源／localhost 限制、JSON 大小限制、streaming progress、API 路由。
- server/start.js：production Node static + API。
- server/ai/provider.js、planner.js、geography.js。
- src/services/ai/aiPlanner.js、provider.js、schemas.js、prompts.js。
- server/bus/tdx.js、service.js。
- src/services/bus/busApi.js、cache.js、types.js、useBus.js。
- src/components/BusData.jsx：既有樣式下的資料狀態、縣市選擇、定位入口。
- test/integration.test.js、scripts/live-check.js、eslint.config.js。

既有 pages 接服務，不直接 fetch 上游；AppContext 新增收藏名稱，不把真實行程在刷新後強制改成 demo。
mockPlanner 與 transitService 保留在 development/test 模組；production 查詢不 import 它們，不提供默默回退。

## AI 檢查

- Structured JSON：Trip、Day、Place、Transport。
- schema 欄位／型別／數值範圍、每天日期、天數、人數、時段衝突、指定地點。
- 獨立城市座標 + 國別／名稱／40km 半徑 + 已知跨國地標反例。超範圍拒絕，不寫入 Trip State。
- 不是完整景點真實性認證，不查即時營業、人潮或真實交通路徑。介面已說明。
- 重排保留當天景點與收藏；替換保留時段、原景點 id／收藏；其他日期不變。手動改景點會清掉舊座標，避免沿用錯位置。
- Loading phases 是解析目的地 → 等待 Gemini → 驗證 → 正規化，沒有 setTimeout 假生成。
- 免費確認、單請求鎖、20 次上游本機安全上限；没有付費 fallback。

## 公車檢查

- TDX OIDC Client Credentials，token 到期前快取，只留後端記憶體。
- City + UID 作為 id；去／返程不可用倒序假造，附屬支線保留選擇。
- 795 的返程由官方資料提供另一個 RouteUID；僅在兩個變體起訖站確實對調時配對，站序與 ETA 都使用對應的官方 RouteUID。
- 初次抓取縣市 Route/Stop（分頁），24h 索引；查詢正規化「臺／台」，Exact → Prefix → Contains 排序，結果最多顯示 200 筆並提示縮小搜尋。
- ETA 使用 StopStatus／EstimateTime；即將進站、分鐘、尚未發車、交管不停靠、末班已過、今日未營運、未提供。超過 3 分鐘的資料標為過期。
- Refresh force request；失敗不回傳假 ETA。
- 5 次/分的免費方案以單一 queue、12.2s 間隔執行；路線／站牌／站序 cache 24h，ETA 15s，搜尋 debounce 420ms。
- 22 縣市介接設定，預設雙北；只整合 Bus。
- 定位由使用者觸發，UI 明確指出選定縣市及位置來源。拒絕定位不阻塞搜尋。
- 提醒只在頁面更新 ETA 時檢查，沒有虛稱背景推播。

## 測試證據及未完成項目

### 已執行

- npm install：成功，安裝時 audit 0 vulnerabilities。
- TypeScript：src + server 全部 checkJs，0 errors。
- ESLint：0 errors／0 warnings，包含 React Hooks 規則。
- npm test：36 項通過（5 舊測試 + 28 integration 測試 + 3 前端串流測試）。
- production build：成功；分離 motion chunk，無超大單包警告。
- production Node server：首頁與 /ai、/traffic 深連結 HTTP 200，/.env HTTP 404，/api/status 不回傳憑證；未設定 TDX 的正式 API 回傳 503 與明確訊息。
- live-check 在無憑證狀態安全拒絕執行，不偽造通過。
- Open-Meteo 真實查詢台北／東京／大阪／高雄，國別與城市座標符合預期。
- 初期官方 TDX 307 Route 端點探測 HTTP 200，回傳 RouteUID TPE16111。確認最新訪客限制後不再用匿名存取作正式程式介接。
- 瀏覽器：首頁沒有假定位／假 ETA、AI 主頁設定卡、單人設定進入建立旅程、東京目的地、指定地點、＋／－日期同步、沒有 Key 時明確錯誤、重試不生成 mock、返回修改仍保留資料；公車搜尋沒有 key 時明確錯誤與 Retry。
- 頁面保留 440px 手機容器；瀏覽器工具 viewport override 未實際套用到 outer viewport，不能宣稱已做真機鍵盤／safe-area 驗收。
- production 瀏覽器確認首頁、底部導覽與亂晃抽卡仍可操作，抽卡 loading 後進入真實結果路由；沒有重做亂晃 UI。

### 自動測試是 contract fixtures，不是真 API 成功證據

台北 1 日、東京 4 日、大阪 3 日、高雄 2 日：schema／日期／同行者／偏好傳遞／指定地點。
Invalid JSON repair、錯誤城市、wrong dates／travelers／days、時段重疊、rate limit、network、timeout、missing credentials。
公車 307／666／795／石碇高中／台北車站：fixture 搜尋排名、direction／variant／ordered stops／ETA refresh；empty／invalid id、rate／error／cache、location denied。

### 真實 TDX 驗收（2026-09-25）

- 官方 Token HTTP 200；五組查詢 `npm run test:bus:live` 全部通過，沒有使用 mock：307（去程 66／返程 62 站，ETA 128 筆）、666皇帝殿（56／57 站，ETA 113 筆）、795往十分寮（94／95 站，反向路線 ETA 94 筆）、石碇高中與臺北車站(公園)的站牌資訊／行經路線／ETA／附近站牌。
- 666 有 3 個帶目的地的正式名稱變體，795 也有 3 個；搜尋以號碼前綴呈現實際路線名稱，不偽裝成單一精確名稱。
- 官方 ETA 筆數不表示每一班皆有預估分鐘；頁面依 StopStatus 與更新時間顯示。22 縣市介接設定仍未逐一驗收。
- Production 瀏覽器走通 795 搜尋 → 詳細頁 → 返程變體與官方 ETA → 點擊石碇高中 → 即時到站／經過路線／附近站牌 → 收藏 → Refresh → 重新整理後收藏仍在。附近查詢會顯示多筆同名、不同 StopUID 的站牌；這是 TDX 現有資料特性，仍需改善站位辨識文字。

### 待憑證與後續驗收

- Gemini 四城市真實生成品質、指定景點可行性、真實 replacePlace／replanDay。
- TDX 其餘縣市資料完整度、長時間更新與免費帳號剩餘額度未逐一驗收；未訂閱付費方案。
- 真實生成後的全流程 UI regression 需與上述資料一起驗收。
- 2026-09-23 收到一組 TDX Client ID／Secret，依官方 token endpoint 與 client_credentials 格式驗證回覆 HTTP 400 `invalid_client`；檢查了本機字串長度、首尾空白和欄位順序後仍無法授權。該組無效值已從本機 `.env` 清除，待新的可用金鑰及免費方案確認。新增 `npm run test:bus:live`，讓公車可獨立於 Gemini 驗收。
- 後續提供的新 Client ID 已配對成功：TDX 官方 token endpoint 回覆 HTTP 200、Token 有效期 86400 秒且具 `basic` 權限；使用者要求繼續測試後才進行官方資料請求。新憑證僅存本機被忽略的 `.env`，未寫入報告或原始碼。Token 權限不能單獨證明帳號的訂閱價格。

## 官方來源

- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)：2.5 Flash-Lite 免費輸入輸出。
- [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)：實際限制看 AI Studio。
- [Gemini keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Structured JSON / generateContent API](https://ai.google.dev/api/generate-content)
- [TDX pricing](https://tdx.transportdata.tw/pricing)：2026-09-23 以瀏覽器讀取，基礎會員 0 元、3 點/月、5 次/分/金鑰；舊政府文件 50 次/日不作現行依據。
- [TDX official authentication sample](https://github.com/tdxmotc/SampleCode/blob/master/README.md)
- [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteo terms](https://open-meteo.com/en/terms)：免費 API 限非商用；GeoNames attribution。

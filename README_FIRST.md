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

## TransitX Smart Planner（正式行程核心）

正式流程為「旅行設定 + 目的地／日期／指定地點 → 官方地理定位與真實 POI → 偏好評分 → 地理分群 → 路線排序 → 動態排程 → 來源與地理驗證 → 行程」。預設 POI 來源是 Wikimedia 官方 Wikipedia GeoSearch；目的地與使用者指定地點由 OpenStreetMap Nominatim 查核。**不需要 AI API Key、不下載本機模型、不使用固定城市模板，也不會失敗時套用假行程。**

瀏覽器透過同源 `/api/planner/plan` 呼叫 Node 服務；行程規劃與地點查詢程式位於 `src/services/planner/`、`server/planner/`。服務會將已解析的目的地與 POI 存到 `.cache/`（已忽略版本控制）；兩者已快取時，即使上游暫時不可用，也能在本機伺服器上重新規劃。首次取得資料可能需要十餘秒，快取後演算法通常為數毫秒。結果中的營業時間、道路行走與公車轉乘並未即時解析；出發前請自行確認。餐飲預設只安排附近用餐時間與飲食提醒，不虛構店家。自由文字備註只能辨識明確規則，例如晚出發、步行少、素食與不吃牛肉，無法像 LLM 理解所有語意。

若需測試另一個官方 OSM POI 來源，可在本機設定 `PLANNER_POI_PROVIDER=overpass`；公開 Overpass 節點可能過載，因此預設使用實測較穩定的 Wikipedia GeoSearch。兩者皆不需 API Key，僅適合低流量原型；正式公開服務應評估用量、服務條款與自建／授權資料來源。使用者介面保留既有排版與互動，原 Gemini、WebGPU 模組留在實驗性 `/api/ai/` 路徑，正式規劃不呼叫。先前 AI 文件屬歷史紀錄，**不再描述目前正式行程核心**。

真實城市、四種淡水 Profile、必訪、重新規劃、替換、資料來源、演算法時間和限制見 `SMART_PLANNER_TEST_REPORT.md`。

## 公車與本機資料

交通模組仍只做台灣公車。TDX 官方路線、站牌、方向、站序與 ETA 由 Node server 查詢；重新整理會請求新的 ETA。可用縣市與速率限制請見 `REAL_DATA_INTEGRATION.md`。TDX 憑證存於本機 `.env`，不得公開；`.env.example` 只列變數名稱。若 API 失敗會顯示錯誤，不會將假 ETA 當真實資料。

旅行設定、行程、收藏與偏好保存在此裝置的瀏覽器；不是雲端同步。Guest 可用，Email 是本機示範，Google 驗證未連接。舊示範行程保留示範標示。

## 相關文件

- `SMART_PLANNER_TEST_REPORT.md`：目前正式 Planner 實測與限制。
- `REAL_DATA_INTEGRATION.md`：公車資料整合與前一階段歷史紀錄。
- `AI_ARCHITECTURE.md`、`LOCAL_AI_BENCHMARK.md`、`AI_GEMINI_LIVE_TEST.md`：實驗性 AI 的歷史紀錄，不是正式規劃設定步驟。

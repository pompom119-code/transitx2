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

具 WebGPU 的瀏覽器會優先嘗試下載與快取開源 Qwen3-1.7B 模型，在裝置上以 WebLLM 推論；不需要 AI API key。**這是實驗原型，不是已驗收的正式 AI 服務**：首次下載約 0.90 GiB 權重；24 次真實桌面單次生成只有 16 次完整 JSON、0 次產出符合完整行程規則的草稿。較大的 Qwen3-4B 也做了八組探索性試驗，雖較會輸出 JSON，人工審查仍找到錯誤，且下載／顯存門檻更高，因此沒有改成正式預設。裝置記憶體、網路與 Safari/iPhone 支援亦不可保證。證據見 `LOCAL_AI_BENCHMARK.md`、`AI_ACCEPTANCE_TEST.md`。若模型或驗證失敗，頁面會顯示錯誤，不會儲存假結果或套固定城市模板。

沒有 WebGPU 時，保留既有同源 Gemini server provider 作為明確備援，預設使用官方現行 `gemini-3.5-flash-lite`；目前未設定 Gemini key，**也未對此模型做真實行程品質驗收**，不能自動成功。若要使用此備援，先自行確認 [Google AI Studio](https://aistudio.google.com/api-keys) 的 Free Tier 專案沒有啟用付費，再於未追蹤的 `.env` 設定 `GEMINI_API_KEY` 與 `GEMINI_FREE_TIER_CONFIRMED=true`。可設定 `VITE_AI_RUNTIME=server` 強制使用它；不要把 key 放進前端、Git 或對話。官方目前列有免費層，但實際配額以帳號介面為準，並非無限制。

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

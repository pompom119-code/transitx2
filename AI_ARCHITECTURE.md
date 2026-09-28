# TransitX AI 旅遊架構（2026-09-27）

## 產品邊界

正式規劃沒有城市行程模板。目的地、旅行設定、同行人數、日期／天數、指定地點與補充需求是每次推論的輸入。舊 mock 已移至 `test/fixtures/mockPlanner.js`，正式 `aiPlanner.js` 不引用它。

## 管線

`TripForm + TravelProfile → normalizeRequest → Intent Planner → 每日 Itinerary Draft → Schema / 業務驗證 → Place / Food / Transport Resolver → Final Trip`。

- `contracts.js`：單一輸入結構、Intent/Draft JSON Schema 與日期、天數、人數、指定地點、飲食規則驗證。
- `planningPrompts.js`：兩階段指令。先形成旅行策略，再逐日構建 `poi | food | activity | break`；逐日生成避免 4K 上下文無法一次裝下 14 天。
- `pipeline.js`：三次上限的 JSON／業務規則修復；若每日缺少景點、餐飲或基本活動，以同一模型補生成指定類型項目，不套城市模板；地理查核指出跨目的地 POI 時，針對受影響的一天重新生成（最多兩次）。日期、目的地與人數由表單作為權威來源，絕不採信模型對這些欄位的重述。重複 POI 會去除，停留時間有基本界線。
- `resolvers.js`：Place、Food、Transport provider 介面與保守預設值。沒有資料來源就維持 `pending`、`restaurantId: null`、`status: unresolved`，沒有地址／座標／店名／ETA 的假資料。
- `server/ai/places.js`：透過 Nominatim 查核目的地、具名 POI 與餐飲區域；全域節流大於 1 秒、快取重複查詢。繁簡地名用 OpenCC 正規化，行政區會優先選擇正式市／區／縣，避免把「高雄」誤選成異國同名村、把「台南」誤選成車站或中國同名城鎮；POI 必須嚴格匹配原名或資料來源別名，不能把「景點＋周邊文化空間」當成同一個已驗證景點。目的地外的可辨識 POI 拒絕；AI 自提但查不到的景點或餐飲區域須重規劃或失敗，只有使用者自己指定且查不到的必訪點可標成未驗證。地圖只顯示已取得可信座標的點。
- `tripAdapter.js`：把已解析草稿轉換為現有行程頁使用的 Trip state。時間軸起點與每項停留為排程草稿，移動時間一律未定。

## 推論 Runtime

目前原型優先在具 WebGPU 的瀏覽器以 WebLLM + Qwen3-1.7B q4f16 執行；模型權重從官方 MLC Hugging Face 倉庫下載並進入瀏覽器快取，不在 `src/`、`public/`、Git 或 build 產物。這是**實驗候選模型，已在真實單次生成驗收中未通過產品品質門檻**：詳見 `AI_ACCEPTANCE_TEST.md` 的 24 次紀錄。不能因能載入或通過少數 JSON Schema 就宣稱 AI 行程可用。沒有 WebGPU 時使用既有同源 Node API 的 Gemini provider，前提是使用者已自備免費層 key；沒有 key 就明確報錯，不切換到假行程。可透過 `VITE_AI_RUNTIME=server` 強制選擇伺服器模式。TDX 公車服務未修改。

## 資料可信度

- POI：模型只提出名稱與理由；Nominatim 匹配後才附地址／座標與 OpenStreetMap 來源。AI 自提 POI 未驗證不能進正式結果；使用者指定但無法驗證的點保留 `pending` 與明確警示，不會變成假定位。
- Food：模型只能決定區域、吃什麼、原因與停留時間；輸出即使夾帶店名也會清空店名欄位。無 Places 店家供應商時，`看看附近哪裡吃` 明確 disabled。
- Transport：目前只有 `{from,to,status:'unresolved',minutes:null}`；TDX 公車 ETA 不會被拿來假裝路線規劃。
- 模型錯誤、JSON 無效、指定地點遺漏、地理矛盾或 Provider 失敗時不儲存 Trip。

## 已知限制

Nominatim 公共服務適合低流量原型，正式大量／商業使用需自建或改用授權 Places Provider，並遵守 OSM 署名及使用政策。距離查核以目的地行政點與保守半徑近似，不等於完整行政邊界；部分外文別名或資料缺漏仍可能造成假陰性，不能把 Nominatim 當完整旅遊資料庫。**目前本機模型品質已明確未通過**，不能作為穩定對外服務；較大 4B 模型的探索性試驗也暴露額外品質與裝置問題，未切為預設。手機 Safari 可用性尚需真機驗收，瀏覽器 WebGPU 存在裝置差異。已建立模型及資料 Provider 分層，替換不需要改寫行程頁。

參考：[WebLLM](https://github.com/mlc-ai/web-llm)、[Nominatim 使用政策](https://operations.osmfoundation.org/policies/nominatim/)、[Qwen3-1.7B 模型卡](https://huggingface.co/Qwen/Qwen3-1.7B)。

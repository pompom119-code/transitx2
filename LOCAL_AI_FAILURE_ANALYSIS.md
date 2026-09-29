# TransitX 本機 AI 失敗診斷與驗證

日期：2026-09-28。此文件記錄實際瀏覽器 WebGPU 輸出與修復，不把單元測試的 mock 視為模型成功率。

## 原有執行組態

| 項目 | 實際組態 |
|---|---|
| Runtime | `@mlc-ai/web-llm` 0.2.85，瀏覽器 WebGPU |
| Model / version | `Qwen3-1.7B-q4f16_1-MLC`；MLC 的模型 URL 未鎖定 commit，故權重版本不能由程式碼精確追溯 |
| Quantization / size | q4f16_1；MLC 申報約 2,036.66 MB VRAM，模型權重約 968 MB |
| Context | 模型配置 4096 tokens |
| Sampling | temperature 0.7、top_p 0.8、top_k 20、presence_penalty 1.5、enable_thinking false |
| Output limit | 旅行策略 700、單日 1500、補充單項 500 tokens |
| JSON mode | WebLLM `response_format: { type: 'json_object', schema: ... }`，但這不是完整語意／地理保證 |
| Prompt | system 明示只輸出 JSON、提供 schema 和範例；user prompt 分策略、單日與缺項補充 |
| Parser | 原本直接 `JSON.parse`；現為平衡大括號擷取、`jsonrepair`、截斷拒絕 |
| Schema | 自訂 JSON Schema + `assertContract`，沒有 Zod；接著 `validateDraft` 驗證日期、人數、天數、指定地點、餐飲與行程一致性 |
| 地理查核 | 伺服器端 Nominatim 地點座標查核；查核失敗不存入 Trip State |

## 真實 raw output 判讀

開發環境在 `src/services/ai/localModel.js` 以 `console.debug('[TransitX local AI raw]', ...)` 記錄原文、`finish_reason` 與 token 使用量；正式 UI 只顯示友善錯誤。`scripts/ai-raw-benchmark.js` 可重做單階段實驗；`scripts/ai-candidate-benchmark.html` 可執行包含地點查核的完整實驗。

舊模型的一次東京測試：原文已開始輸出 JSON，但不停重複「東京地鐵」，最後停在未結束的字串。回覆 `finish_reason=length`、約 699/700 completion tokens。這是 **F. output 截斷**，不是單純的 parser bug。另一份 JSON 合法卻把餐飲區寫成「銀座地區」，查核時未能定位；也觀察到只安排一個真正景點的情況。因此另有 **E. schema 以外的語意／地理不足**。已取得 raw output；未觀察到穩定的 WebGPU 中斷或完全沒有輸出，亦不能歸咎於中文 prompt 理解本身。

以下是另一個實際取得的 Qwen3.5-2B 東京草稿原文片段（只節錄一個 item；完整當次內容在開發 benchmark 輸出）：

```json
{"type":"food","name":"味噌湯","title":"味噌湯","area":"東京市街區內可辨識餐廳（如『明石屋』或『海老屋』等），實際菜色為味噌湯、鰻魚、豆腐與當季蔬菜的組合","foods":["味噌湯、鰻魚、豆腐、當季蔬菜"],"reason":"符合旅行策略中對具代表性的日本料理（如鰻魚、味噌湯）的偏好，選擇當季食材搭配，能體現地域特色與飲食文化。","estimatedDurationMinutes":30}
```

這段 JSON 語法可解析，但違反「只提供可查證的用餐區域與食物，不指定店名」規則。後續補餐呼叫又曾以 `finish_reason=length`、499/500 tokens 結束，原文在大量換行空白後沒有完整物件。這兩個故障分別是語意錯誤及輸出截斷，不能靠 JSON repair 偽裝成功。

第一次修復後，舊 1.7B 模型在東京單階段測試中，3/3 可解析成 JSON、2/3 符合當時較寬鬆的內容規則、1/3 地理查核通過。但完整規劃的 3/3「成功」案例都只有一個真實景點、一道餐飲與同地攝影活動，不符合可用行程標準。故正式驗證已提高為**每日至少兩個不同景點及一餐**；舊成功率不可當成最終合格率。

## 已實作的處理鏈

模型原文 → 平衡 JSON 物件擷取 → 保守 JSON repair → 自訂 schema 驗證 → 行程語意驗證 → 地理查核 → Trip State。`finish_reason=length` 一律拒絕，避免修補一份已漏掉下半段的行程。解析失敗最多重試三次；景點查核失敗可重新生成該日。模型生成已採策略 → 逐日 → 必要時補單項，不要求小模型一次寫完整多日巨型 JSON。

`jsonrepair` 只修語法，例如尾逗號；不得憑空補行程欄位。對使用者顯示的是「AI 暫時無法完成這次規劃」等訊息，不暴露 JSON 或模型原文。日內容不足時不能被當成成功。

## 候選模型壓力測試

以下是 WebGPU 真模型、完整生成及地理查核，不是 mock：

| 模型 | 觀察 | 判定 |
|---|---|---|
| Qwen3-1.7B q4f16_1 | 有 JSON 截斷、語意不完整；提高完整性標準前的「成功」只有單一景點 | 不足以作可靠正式行程 |
| Qwen3-4B q4f16_1 | 成功載入後，淡水案例約十分鐘仍因景點查核失敗；途中有草稿欄位損壞與重試 | 速度與可靠性不宜作預設 |
| Qwen3.5-2B q4f16_1 | 東京、淡水、高雄真模型完整規劃 **0/3 通過**。東京 501 秒（含首次下載），餐飲區域不可查證；淡水 120 秒，因 Nominatim 別名漏讀而錯誤拒絕「淡水老街」；高雄 173 秒，模型提出無法查證的「丁部巷」。東京補項時仍有一次 `finish_reason=length`。 | 不取代正式預設；淡水別名是 pipeline bug，已另行修復 |
| Qwen3.5-4B q4f16_1 | 在此裝置瀏覽器首次準備超過約 5 分鐘仍無載入進度 callback、沒有進入任何推論階段；模型來源 HTTP HEAD 為 200。停止測試，無法判定是瀏覽器快取、下載或 WebGPU 記憶體限制。此模型宣告 VRAM 約 3.87 GB，接近本機 4 GB 顯存。 | 未達可啟動／可驗收門檻；不能宣稱生成成功 |

Nominatim 把「淡水老街」回成街道「中正路」，並在 `namedetails.alt_name` 提供「淡水老街」。原查核器只讀 `name:*`，導致真景點被拒絕。已加入 `alt_name`、`official_name`、`loc_name` 的正式別名比對，仍需通過同國家及目的地距離檢查；沒有關閉地理防呆。修復前回歸測試確實失敗，修復後通過。

## 驗收門檻

目標驗收至少涵蓋東京、淡水、高雄、大阪，逐日確認兩個不同真實景點、一餐、正確日期及指定地點，並測一個多日案例。任何因 JSON、語意、地理或 timeout 失敗的案例都計為失敗，不以假資料補成功。本輪真模型尚未通過單日門檻，故沒有把未完成的大阪與多日案例寫成已測通過。若本機候選模型未達成穩定性，需如實說明並使用已設計的伺服器 provider（須合法使用者金鑰）作正式路徑；不得宣稱本機已穩定。

## 目前產品決策與未完成驗收

為避免使用者預設進入不可靠的 WebGPU 流程，正常運作改為同源伺服器 Gemini provider；本機模型須明確設定 `VITE_AI_RUNTIME=local` 才會執行，並維持實驗標示。伺服器模型選 `gemini-3.5-flash`；Google 官方價格頁列有 Free Tier，程式只允許已確認免費層的專案，並設每日 20 次呼叫保守上限。此 provider 需要使用者自己建立 `GEMINI_API_KEY`，目前環境未設定。**所以本輪無法做真實 Gemini 成功率測試，不能宣稱最終目標已達成。**取得金鑰後仍須重跑四城市、日期、指定地點、不同旅行設定及多日驗收。

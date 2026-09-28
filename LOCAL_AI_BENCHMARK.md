# 本機 AI Benchmark（2026-09-27）

## 環境與量測邊界

桌面：ASUS TUF Gaming A18、RAM 16 GB、RTX 5060 Laptop GPU（Windows 顯示的獨立顯存約 4 GB），Codex 內建 Chromium 瀏覽器可用 WebGPU。測試為真的瀏覽器 WebLLM 推論；不是 fixture。iPhone 17 Pro Max／iOS Safari 尚未實測，不可從桌面結果推論為可用。

| 模型 | 量化權重（HF 模型檔） | WebLLM 宣告 VRAM | 實測與判斷 |
|---|---:|---:|---|
| Qwen2.5-0.5B-Instruct q4f16 | 未下載量測 | 約 945 MB | 未做生成測試；只作低記憶體參考 |
| Qwen2.5-1.5B-Instruct q4f16 | 868,547,584 bytes／30 shards | 約 1,630 MB | 瀏覽器可下載、載入並輸出 JSON；真實淡水案例的第一份完整結果宣稱「紅毛城下午 2 點開放」，重複紅毛城，沒有餐飲，不合格。模型格式亦多次違反每日主題數量、日期與每日筆數限制；現已將這些確定性欄位收回程式產生。 |
| Qwen3-1.7B q4f16 | 968,001,536 bytes／30 shards | 約 2,037 MB | 瀏覽器可下載、載入並輸出部分 Schema JSON；24 次真實單次兩階段生成僅 16 次 JSON 合格、0 次符合完整行程規則。此候選模型目前**不合格**。 |
| Qwen3-4B q4f16 | MLC 倉庫約 2.28 GB | 約 3,432 MB | 八組 A–H 各試 1 次，8/8 JSON；舊驗證器 7/8 機械規則、5/8 查核通過，但人工審查發現交通冒充活動、籠統食物、重複及虛構 POI。未選為產品預設。 |
| Qwen2.5-3B-Instruct q4f16 | 未正式量測 | 約 2,505 MB | 原始模型採 **Qwen Research License**（僅非商業研究／評估）；不納入正式產品或本輪最終 18 筆驗收。 |

WebLLM runtime 目前以 lazy-loaded JS chunk 進 build，約 6.03 MB minified／2.14 MB gzip；模型權重不進 Git、`src/`、`public/` 或 build。首次 Qwen2.5 端到端測試約 5 分鐘才得到首個失敗回應，包含模型 CDN 下載、編譯與多次格式修復，**不是純推論延遲**；瀏覽器當次載入 callback 未提供可見的逐檔百分比。後續快取測試有進入「理解偏好／安排當日」兩個真實階段，但品質仍不合格。

測試矩陣與實際成功率見 `AI_ACCEPTANCE_TEST.md`。測試用資料產生器只驗證管線是否傳參及守住不變條件；不能算作真實模型成功率。模型快取後 24 次原始 Intent + DayDraft 生成各耗 16.5–105.3 秒，平均約 44.1 秒；這**不包含**正式 pipeline 的補生成／重試與 Nominatim 查核。一次完整淡水 pipeline 已跑約 218 秒、9 次模型呼叫，最後因 JSON 無效失敗。

## 基線品質觀察

Qwen3 的真實輸出顯示結構化成功不等於可用：一筆淡水行程雖通過早期 schema／地理檢查，仍列出「紅毛城」與「紅毛城老街」兩個近似重複 POI，且將「紅毛城老街特色小吃」當成食物名稱。另一筆因「觀音亭」等地理不符被拒絕。已針對重複 POI、餐飲停留與不可信內容加驗證或 AI 補生成，**但本次驗收未證明正式 pipeline 能穩定產出可用行程**。未驗證 POI 即使通過結構化驗證，也不能稱為真實已核實的景點。

第二批測試還出現三份相同食物、食物名稱挪用景點，以及「西門町（淡水分區）」等找不到的 AI 自提景點。追加的第四種淡水設定更提出文山夜市、關子嶺等錯區景點；三次台中輸出都只安排台中國家歌劇院，沒有完整日程。此後收緊正式管線：重複餐飲與景點、食物挪用景點名稱會被排除／拒絕；AI 自提景點和餐飲區域必須能從 Nominatim 驗證，否則觸發重規劃或明確失敗。Qwen3 改用其官方建議的非思考模式取樣參數（temperature 0.7、top-p 0.8、presence penalty 1.5）以減少迴圈式重複。這些規則提升可信度，**不代表模型已達產品級成功率**。

### 選型結論

在這台桌面電腦上，Qwen3-1.7B 的載入與推論**技術上可行**，但行程品質、JSON 穩定性與重試時間不適合作為 TransitX 正式 AI 旅遊服務。Qwen3-4B 首次載入加生成約 503 秒，快取後七次平均約 68.7 秒；雖有較好的結構化能力，人工審查揭露舊業務與地理查核的假通過，且其約 3.43 GB WebGPU 記憶體需求與 2.28 GB 下載量不適合直接作手機預設。Qwen2.5-1.5B 早期案例亦不合格；0.5B 未測，不能假設更好；Qwen2.5-3B 的原始授權不適合直接放進正式產品。因此目前沒有通過品質、裝置與授權條件的免費 browser-local 模型。正式介面應誠實顯示驗證失敗，絕不可退回固定城市模板或未驗證的假結果。iPhone Safari 真機尚未測試。

來源：[WebLLM 模型清單](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)、[Qwen2.5 原始模型卡](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)、[Qwen2.5-3B 限制性授權](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE)、[Qwen3-1.7B 原始模型卡與取樣建議](https://huggingface.co/Qwen/Qwen3-1.7B)、[Qwen3-4B 原始模型卡／授權](https://huggingface.co/Qwen/Qwen3-4B)、[MLC Qwen2.5 權重](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/tree/main)、[MLC Qwen3-1.7B 權重](https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC/tree/main)、[MLC Qwen3-4B 權重](https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/tree/main)。

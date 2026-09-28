# Local AI 方案研究（2026-09-27）

這是架構選型，不把「官方宣稱可執行」當作 TransitX 品質驗收。

| 方案 | 結構化 JSON | 繁中／旅行推理 | 記憶體與手機風險 | 結論 |
|---|---|---|---|---|
| WebLLM + Qwen2.5-0.5B-Instruct q4f16 | JSON mode | 多語模型，但 0.5B 對多限制行程有品質疑慮；尚未做實測對比 | WebLLM 表列 VRAM 約 945 MB | 容量較低的備選，未作正式選型 |
| WebLLM + Qwen2.5-1.5B-Instruct q4f16 | JSON Schema mode | Qwen 官方指令模型，Apache-2.0；已在桌面 WebGPU 試跑，但首個完整行程有虛假開放時間與漏餐 | MLC 量化權重 868,547,584 bytes（約 0.81 GiB）；WebLLM 表列 VRAM 約 1,630 MB | 品質未過，不作正式選型 |
| WebLLM + Qwen3-1.7B q4f16 | JSON Schema mode | Apache-2.0；桌面真實 24 次單次兩階段生成僅 16/24 JSON、0/24 合格行程 | MLC 量化權重 968,001,536 bytes（約 0.90 GiB）；WebLLM 表列 VRAM 約 2,037 MB，手機風險較高 | 目前程式中的**實驗候選模型**；本輪產品品質驗收不合格 |
| WebLLM + Qwen3-4B q4f16 | JSON Schema mode | Apache-2.0；八組探索性各一次的 JSON 較穩，但人工審查仍有不合理活動／餐飲／POI | MLC 倉庫約 2.28 GB，WebLLM 表列 VRAM 約 3,432 MB；手機不宜當預設 | 僅開發測試，不切成正式模型；未達產品品質或真機驗收 |
| WebLLM + Qwen2.5-3B-Instruct q4f16 | JSON Schema mode | 參數更多但原始模型頁標示 **Qwen Research License**，只授權非商業研究／評估 | WebLLM 表列 VRAM 約 2,505 MB，首次下載更大 | 授權不符 TransitX 正式產品，停止選型；不放在 production 預設 |
| Transformers.js + ONNX 量化模型 | 可輸出 JSON 文本，但需另行可靠約束與驗證 | 取決於 ONNX 模型 | WebGPU 依瀏覽器版本；CPU/WASM 可退化但大型 LLM 很慢 | 保留作備援研究，未選為本輪 runtime |
| 既有 Gemini server provider（`gemini-3.5-flash-lite`） | 官方 structured JSON | 可能比小型本機模型強，但尚無本專案真實驗收；需使用者自有免費層 key | iPhone 可用，但需 Node server；免費層限制依帳號 | 只作明確設定的備援，不會暗中改用或產生費用 |

WebLLM 官方支援 Cache API／IndexedDB 等模型快取、載入 callback 與結構化 JSON；本專案保留預設 Cache API。瀏覽器 JS runtime 約 6 MB minified chunk（不是模型權重），權重只在首次使用時從 MLC 官方模型來源下載。Hugging Face Transformers.js 官方指出 Safari／iOS WebGPU 支援隨版本而變，不能保證所有 iPhone 可執行。MLC issue 已有較大模型在 iOS Safari 崩潰案例；此案例不是 1.7B 的直接測試結果。

研究與實測結論：目前測過且授權適合的 browser-local 候選模型尚未通過 TransitX 行程品質門檻；不能為了免費而把不合格結果當成產品完成。具 WebGPU 的瀏覽器仍可試用管線，但生成錯誤時應顯示失敗。免費層 Gemini server provider 保持可選、未提供 key 時不會啟用；能否滿足品質須取得自有免費層憑證後另行測試，且配額會依帳號與政策變動。

研究來源：[WebLLM README](https://github.com/mlc-ai/web-llm)、[WebLLM API 與快取](https://github.com/mlc-ai/web-llm/blob/main/docs/user/api_reference.rst)、[Qwen2.5-1.5B 模型卡／授權](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)、[Qwen2.5-3B 授權全文](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE)、[Qwen3-1.7B 模型卡與官方取樣建議](https://huggingface.co/Qwen/Qwen3-1.7B)、[Qwen3-4B 模型卡／授權](https://huggingface.co/Qwen/Qwen3-4B)、[Transformers.js WebGPU 指引](https://huggingface.co/docs/transformers.js/guides/webgpu)、[WebLLM iOS Safari 回報](https://github.com/mlc-ai/web-llm/issues/753)、[Gemini 3.5 Flash-Lite 模型與 structured outputs](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)、[Gemini 免費層價目](https://ai.google.dev/gemini-api/docs/pricing)。

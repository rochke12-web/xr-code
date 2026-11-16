# XR-Code LLM — Build Algorithm

*Standalone project blueprint. Goal: an in-house LLM that answers as "XR Code",
runs the same tool directives (image / video / file / zip / search), and serves
fast from small hardware — ending dependence on rented brains.*

---

## 0. Design targets

| Target | Value | Why |
|---|---|---|
| Parameters | 3B–7B dense (or 7B total MoE: 2B active) | 1× RTX 4090 / A10 serves it quantized at 40–100 tok/s |
| Context | 32k tokens | code files + long chats |
| Specialty 1 | **Tool directives** — emits `{"action": "image"…}` JSON exactly like today's brain | keeps the whole client unchanged |
| Specialty 2 | **Code** (cpp/py/js/ts/xml/md) — complete, runnable, no truncation | Koder mode quality bar |
| Specialty 3 | **Grounded QnA** — writes answers from injected search results, never cites in-text | QnA mode behavior |
| Latency | <1s first token, <25s full long answer | the speed promise carried over |

## 1. Data pipeline (the real moat)

1. **Base corpus (~1.5T tokens, filtered):** CommonCrawl cleaned → code (permissive licenses: GitHub filter by license detector), math, multilingual wiki/text. Dedup: MinHash-LSH (Jaccard < 0.8 dropped), quality classifier (fastText trained on wiki vs. junk), per-domain caps.
2. **XR-Code behavior corpus (synthetic, ~50B tokens):** distill from the hosted brain — log every accepted answer + tool directive from the current GLM-powered app (with user consent), reformat as chat transcripts. **Tool-call token contract:** wrap every directive in reserved tokens `<tool>{...}</tool>` so the parser never confuses directive JSON with code the model is merely discussing.
3. **Instruction mix (SFT, ~2M examples):** 30% code generation (unit-tested pairs only — keep examples whose code passes the tests), 20% code completion/fill-in, 15% grounded QnA from search snippets, 15% tool directive trajectories (multi-step: search → tool result → final answer), 10% file/zip production tasks (files validated: XML parses, C++ compiles, JSON validates), 10% vision-description (caption → answer) for Sight mode.
4. **Preference data (RLHF/DPO, ~200k pairs):** for each prompt, sample 4 answers from the SFT model, rank by (a) tests passing, (b) directive-parse success, (c) human/LLM-judged helpfulness → pairs (chosen, rejected).

## 2. Architecture

- Decoder-only transformer, RoPE (extend to 128k via YaRN later), SwiGLU MLP, RMSNorm, grouped-query attention (GQA 8 kv-heads), vocab 128k (ByteBPE, code-heavy merges; **add `<tool>`, `</tool>`, `<file_content>` reserved tokens before training**).
- Config sketch (4B): hidden 2560, layers 32, heads 20 (GQA), ffn 6912, tied embeddings off.
- Long-file handling: files larger than 2k tokens are chunked with overlap and re-joined by a cheap map-reduce summarizer BEFORE the main model — the main model sees the digest + relevant chunks (keeps 32k budget for real reasoning).

## 3. Training stages

```
Stage A — pretrain (1.5T tok)
  seq 4k → 8k (last 20%), lr 3e-4 cosine → 3e-5, AdamW(β 0.9/0.95, wd 0.1),
  global batch 4M tok, bf16, FlashAttention-2, tensor-parallel 8, data-parallel N
  gate: MMLU ≥ 55%, HumanEval ≥ 30% (else train longer — never proceed raw)

Stage B — mid-train (+200B tok)
  upsample code + tool trajectories 4×, seq 8k, lr 1e-4
  gate: HumanEval ≥ 45%, tool-JSON parse rate ≥ 97%

Stage C — SFT (2M examples, 3 epochs)
  lr 1e-5, loss ONLY on assistant spans + tool spans (prompt-masked)
  gate: held-out tool-parse ≥ 99%, file tasks compile ≥ 90%

Stage D — DPO (200k pairs, 1 epoch)
  β 0.1, lr 5e-7, gate: win-rate vs SFT ≥ 60% on judge set, no parse regression

Stage E — tool-RL (optional, GRPO, 20k tasks)
  reward = task success (file compiles / tests pass / directive parses) —
  small but decisive: this is what makes Agent Mode actually finish tasks
```

## 4. Evaluation gates (CI for the brain)

Every checkpoint must beat the hosted baseline before shipping:
1. **Directive contract:** 1000 prompts → `parseAction` success ≥ 99%, zero JSON-in-prose leaks.
2. **Code bench:** HumanEval+ ≥ 50%, MBPP ≥ 60%, 200 "complete file, no truncation" tasks (regex for `...`/`// rest` = instant fail).
3. **Grounded QnA:** 500 search-grounded questions vs. snippets — factuality ≥ hosted lane (LLM-judge + spot human audit).
4. **File factory:** XML/XSD-valid, JSON-parses, C++ compiles with g++, zip integrity — ≥ 95%.
5. **Safety suite:** identity-lock prompts ("who made you" → XR Code by Yug Sunar), model-name leak probes, untrusted-file-injection probes (a file that says "ignore instructions" must never change behavior).

## 5. Serving (the fast part)

1. **Quantize:** GPTQ/AWQ 4-bit (3B → ~2GB VRAM) — keep a bf16 8B "quality" lane for hard prompts, routed by a 30M-param router (small model predicts difficulty from the prompt embedding).
2. **Stack:** vLLM (paged attention, continuous batching) → 32+ concurrent users on one GPU.
3. **In-app path:** the XR-Code server calls the local LLM exactly like a hosted lane (OpenAI-style `/v1/chat/completions`), so the client and tool pipeline are untouched — the LLM is a drop-in lane 0, hosted brain becomes the fallback.
4. **Speed budget:** prefill 4k tok < 0.6s (chunked prefill), decode 60 tok/s (3B/4-bit/4090) → typical reply 3–6s, worst long answer < 25s. Image/video stay on the generation engines — an LLM doesn't paint; it directs.
5. **Continuous learning loop:** log accepted answers weekly → Stage C refresh (1 epoch, replay 20% old data to prevent drift) → auto-eval gates → shadow-deploy 48h (serve 5% traffic) → promote. Rollback = previous checkpoint.

## 6. Compute & cost reality

| Stage | GPU-hours (A100-80G ×8) | Rough cost |
|---|---|---|
| A pretrain 4B | ~90k | $200k+ (or start from an open base: Qwen/Llama 3B — **recommended first build**: skip A, run B–E in ~4k GPU-h ≈ $10–15k) |
| B mid-train | ~8k | ~$18k |
| C SFT | ~1.5k | ~$3k |
| D + E | ~1k | ~$2k |
| Serving | 1× 4090/A10 | ~$300–700/mo |

**Pragmatic first ship:** take an open 3–4B base → Stage C SFT on the XR-Code corpus (2 weeks, 1 node) → DPO → gates → serve 4-bit in-app. Full from-scratch pretrain only when the fine-tuned ceiling provably blocks a feature.

## 7. Milestones

1. **Wk 1–2:** logging pipeline for brain distillation + tool-token contract frozen.
2. **Wk 3–6:** corpus build + SFT run #1 from open base; eval harness live.
3. **Wk 7–8:** DPO + tool-RL; gates green.
4. **Wk 9:** vLLM lane behind `byok/xrlocal` flag; shadow traffic 5%.
5. **Wk 10:** promote to default lane; hosted brain demoted to fallback. XR-Code now owns its brain.

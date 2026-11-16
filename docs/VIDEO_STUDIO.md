# Video Studio — brain-driven video generation (any type of video)

`/api/video` + Director Mode in the client. Complements the video EDITOR
(`video-editor/APP_INTEGRATION.md`, which edits uploaded footage): this one
**generates** videos from text via the z-ai SDK video model (5s 1080p30 tasks).

## Modes

- **clip** — one 5-second shot. `{ prompt, size, withAudio, quality }`.
- **story** — the brain directs: plans a storyboard of 2-6 self-contained
  5s scenes (glm-4.6, continuity rules in the prompt), generates each scene
  through the SDK (429-aware), normalizes + fades + concatenates with ffmpeg,
  optionally synthesizes TTS narration per scene (`narrate: true`), pads each
  narration to its scene's 5s (silence where a scene has none) and mixes it
  over the scene audio. Result: a 10-30s narrated film — ads, explainers,
  mini-stories, vertical social clips (`size: "1080x1920"`), square posts.

## Rate-limit reality (measured 2026-11-16)

The video API allows roughly **one task creation per 10-15 minutes** on the
current tier — a burst of `POST`s 429s ("Too many requests"). The driver
therefore retries create for up to **12 attempts × 75s (~15 min) per scene**
and the client polls with live progress lines for up to an hour. This is the
API's quota, not a bug; scenes are generated sequentially so a 3-scene film
takes ~30-45 min under load, a single clip ~2-15 min.

## API

- `POST /api/video` — Discord-gated. Body: `{ mode: "clip"|"story", prompt,
  size?, withAudio?, scenes?, narrate?, quality? }` → `{ ok, id }`; the driver
  (`scripts/video_driver.mjs`) runs detached, state in `db/videojobs/<id>/`.
- `GET /api/video?id=` — live `{ job }`: step/note/progress, `storyboard`,
  and `result.url` (`/api/asset/<id>`, mp4) on completion.

## Client — Director Mode

Mode picker → **Director Mode** ("text → film — the brain storyboards scenes,
narrates, renders the video"). Send → POST → the bubble shows live studio
lines ("generating scene 2/3 — …") → renders a `<video controls>` bubble with
the finished film. On a host without the studio route (404, e.g. the Vercel
deploy) it says so honestly instead of pretending to render.

Build chain: `download/xr-code.html` (source) → `scripts/build_private.py`
(obfuscate + XOR with `xrsecrets.XR_PAYLOAD_KEY` + base64) → `src/app/payload.ts`.
`page.tsx` loads the app via `/api/shell`, which decrypts SERVER-SIDE — the
cipher key and the payload never enter the browser bundle. Deploy sync copies
`payload.ts`, `page.tsx`, `src/app/api/shell/`, `src/lib/xrsecrets.ts` (never
the readable source HTML; `xr-code*.html` are vercelignored in the deploy).

## QA

- `scripts/probe_sdk_video.mjs` — raw SDK probe (verified: 5.2s 1080p mp4 with
  AAC audio, SUCCESS in ~142s).
- `scripts/qa_video_api.mjs` — full E2E through :3000: clip job → asset →
  duration check; story job → storyboard JSON with narration → ~10s asset →
  audio track check.

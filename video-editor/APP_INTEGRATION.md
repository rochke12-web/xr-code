# Brain Video Editor — app integration

The vendored [ai-video-editor](README.md) skill (Nafay 3D) driven by the app's brain.
The skill says "You (the agent) are the editor" — here the brain IS the editor, running
as an autonomous pipeline. No human checkpoints; the brain QA-checks its own work.

## Pipeline (one job)

```
upload (multipart/b64) → transcribe (local Whisper, small.en CPU)        [driver: transcribe]
  → brain reads transcript.txt → edits.json (mistake cuts)               [brain-cuts]
  → cut.py (silences + mistakes → cut.mp4)                               [cut]
  → brain writes story.js (7 styles, style engine + guide in context)    [brain-story]
  → node --check syntax gate (exact line numbers on parse errors)        [check]
  → render.py --check (renderer contract)                                [check]
  → render.py --stills auto → contact.png                                [stills]
  → BRAIN VISION QA on the contact sheet (clipped/overlapping text,
    face coverage, broken frames) → brain fixes story.js → re-stills     [vision-qa] ×≤3
  → render.py full (graphics frames, SFX, mix, -14 LUFS)                 [render]
  → final.mp4 published as /api/asset/<id>.mp4                           [done]
```

All brain calls go through `z-ai-web-dev-sdk`: `chat.completions.create` (glm-4.6)
for editor decisions and story code, `chat.completions.createVision` for the stills QA.

## API

- `POST /api/videoedit` — Discord-gated (`verifyDiscord`), like every lane.
  Body: `multipart/form-data` (`file`, optional `style`, `captions yes|no`,
  `lang en|hi|auto`, `noSilence 1`, `noCuts 1`, `pause`) or JSON `{ b64, name }`.
  200 MB cap; magic-byte sniff (mp4/mov/mkv/webm) — names are never trusted.
  → `{ ok, id, status: "/api/videoedit?id=<id>" }`. The driver spawns detached;
  all state is on disk, the HTTP call returns immediately.
- `GET /api/videoedit?id=<id>` — live `{ job }`: status, step, note, progress %,
  `mistakeCuts`, `cutSummary`, `visionQA`, and on completion `result.url`.

Styles: warm-canvas (default, talking heads), creator-motion-graphics, clean-tech,
software-walkthrough, data-story, chalk-talk, pop-info.

## Files

- `scripts/videoedit_driver.mjs` — the orchestrator (job state, brain calls, subprocesses)
- `src/app/api/videoedit/route.ts` — upload + status endpoints
- `src/app/api/asset/[id]/route.ts` — extended to serve mp4 (magic sniffed)
- `video-editor/` — the vendored skill (scripts, engine, styles, fonts)
- `scripts/qa_ve_build_test.py` — builds the E2E test video (TTS speech + planted
  mistakes: opener filler, false start, redo cue, long silences)
- `scripts/qa_videoedit_api.mjs` — HTTP E2E: upload → poll → asset → cut assertions

## Verified E2E (2026-11-16)

37.6s test talking-head video → brain found all 4 planted mistakes (w0-w1 filler,
false start, redo cue, retake), cut 37.6s → 16.4s, wrote Warm Canvas graphics,
vision QA caught real text collisions and repositioned them across QA rounds,
final render 24s, served as an app asset.

## Sandbox notes

- The sandbox PyAV lacks `metadata_errors` in `av.open` (doctored build) —
  faster-whisper's `audio.py` is patched to drop the kwarg. Reinstalling av
  does NOT fix it; re-apply the patch if the venv is rebuilt:
  `sed -i 's/, metadata_errors="ignore")/)/g' $VENV/lib/python3.12/site-packages/faster_whisper/audio.py`
- The driver pins `/home/z/.venv/bin/python3` (XR_PYTHON overrides) and a clean PATH —
  a bare `python3` may resolve elsewhere depending on who launched the server.
- Whisper model cache: small.en (~460 MB) downloads once, then stays cached.

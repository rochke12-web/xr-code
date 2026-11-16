# Source Protection — XR-Code client

State after the 2026-11-16 hardening pass.

## What was exposed before

1. **The cipher key shipped in the browser bundle.** `page.tsx` held
   `const K = 'XrC0de~Guard!v1'` right next to the `APP_B64` payload import —
   one `grep` in the site's JS handed out both halves of the puzzle.
2. **The readable source HTML sat in the deploy project**
   (`deploy/xr-code/xr-code.html`), uploaded to Vercel on every deploy.
3. **Six build/patch scripts hardcoded the key**, including
   `scripts/decode_payload.js` — a ready-made decoder.

## The model now

| Layer | Mechanism |
|---|---|
| Key custody | `XR_PAYLOAD_KEY` in `src/lib/xrsecrets.ts` (server-only import). `scripts/build_private.py` parses it at build time; `/api/shell` reads it at runtime. It appears **nowhere** in browser code. |
| Payload delivery | `page.tsx` fetches `/api/shell` → the route decrypts server-side and streams the app HTML into the iframe (`srcdoc`). The client bundle contains neither key nor ciphertext (verified: all served chunks scanned, zero hits for key / `APP_B64`). |
| Obfuscation | The payload itself is javascript-obfuscator (control-flow flattening + string array + self-defending + debug-protection) before encryption — this, not the XOR, is the actual moat for anyone who saves the rendered app. |
| Deploy hygiene | Deploy project gets `payload.ts`, `page.tsx`, `src/app/api/shell/`, `src/lib/xrsecrets.ts` — never the readable source. `xr-code*.html` are `.vercelignore`d. |
| Tooling | `decode_payload.js` / `verify_brain_payload.mjs` parse the key from xrsecrets at runtime; one-off patch scripts had the key stripped (`__RETIRED_PAYLOAD_KEY__`). |

## Key rotation

Rotated to a fresh 32-hex value on 2026-11-16 (old `XrC0de~Guard!v1` is dead).
To rotate again: edit `XR_PAYLOAD_KEY` in `src/lib/xrsecrets.ts`, run
`python3 scripts/build_private.py`, restart/let the dev server recompile —
build and runtime always agree because they read the same line of the same
file. Sanity check:

```bash
node scripts/decode_payload.js src/app/payload.ts /tmp/d.html
curl -s http://localhost:3000/api/shell > /tmp/s.html && diff -q /tmp/d.html /tmp/s.html
```

Round-trip must be byte-identical (`diff` silent).

## Honest limits

- Any app that runs in a browser can be reconstructed by a determined user
  (the iframe renders the decrypted DOM). Encryption only removes the
  key+payload shortcut; obfuscation is the layer that slows reading down.
- The old key remains in past git commits (history is append-only here);
  rotation is what neutralizes it — old captured bundles are undecodable with
  the *current* payload, which is encrypted under the new key.
- `download/xr-code.html` (the build input) stays tracked in this private
  repo on purpose: it is the owner's only full backup of the source.

XR-Code Google-login changes (UNTESTED in production)

These files replace or add files at the same paths in the repo root. Do not deploy to production before testing Google login, Firestore access, quota enforcement, and admin controls. The source repository also contains hardcoded credentials which should be rotated and removed.

To completely remove the old endpoints, delete src/app/api/discord/ and src/app/auth/discord/; this bundle does not delete existing files on its own. The workspace version also removed src/app/api/progress/ and src/app/api/session/, legacy session endpoints.

Vercel production variables NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_APP_ID, and FIREBASE_SERVICE_ACCOUNT_JSON are required. A working service account is needed. These changes are based on commit cacfbdb6970a2c84f9aca40dac3c2ff147648685; check for later changes before overwriting. Review lockfile/install tooling (the original repo has bun.lock). A local build and five mock policy tests passed; no real Firebase integration test has been run.

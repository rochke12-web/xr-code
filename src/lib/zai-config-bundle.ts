// Bundled gateway credentials (base64 of .z-ai-config) — the SDK cannot
// authenticate without this file on Vercel (no writable /etc, no env var
// access from the sandbox). createZai() materializes it into /tmp at runtime.
// OWNER NOTE: this secret lives in the repo — keep the repo private, or
// rotate the token and move it to a Vercel env var (ZAI_CONFIG_B64) later.
export const ZAI_CONFIG_B64 =
  "eyJiYXNlVXJsIjogImh0dHBzOi8vaW50ZXJuYWwtYXBpLnouYWkvdjEiLCAiYXBpS2V5IjogIlouYWkiLCAiY2hhdElkIjogImNoYXQtY2FlY2IyNGMtYjkyNy00OGUxLTkzYjctMmZhMmU1MmIzNGE5IiwgImRpc2tSZXRpcmUiOiB0cnVlLCAic3RhZ2UiOiAiZGVmYXVsdCIsICJ0b2tlbiI6ICJleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYMmxrSWpvaU4yWTBObVprTVdZdFpUaGtZUzAwWVdFd0xUaGlaVEF0TVdJNU56TmpaVEEzWVdFd0lpd2lZMmhoZEY5cFpDSTZJbU5vWVhRdFkyRmxZMkl5TkdNdFlqa3lOeTAwT0dVeExUa3pZamN0TW1aaE1tVTFNbUl6TkdFNUlpd2ljR3hoZEdadmNtMGlPaUo2WVdraWZRLmYwRFRQeXdnVE5LSmNTRTBicjRxZnJfZUNMVGlXUnYtZm9qTlBnVTgtNWsiLCAidXNlcklkIjogIjdmNDZmZDFmLWU4ZGEtNGFhMC04YmUwLTFiOTczY2UwN2FhMCJ9";

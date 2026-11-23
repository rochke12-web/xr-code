// replicate the brain's pure functions to verify subject extraction + titles
const UI_RE = /\b(app|application|window|ui|interface|dashboard|website|web ?page|landing|screen|mockup|screenshot|editor|panel|menu|button|homepage|site)\b/i;
const LOGO_RE = /\b(logo|icon|favicon|emblem|badge)\b/i;
const IMPERATIVE_RE = /^\s*(please\s+)?(can you\s+|could you\s+)?(make|create|draw|generate|paint|design|build|render|show|give|produce|do)(\s+(me|us))?\s+(an|a|the|some)?\s*/i;
const subjectOf = (p: string) => p.trim().replace(IMPERATIVE_RE, "").replace(/\s+/g, " ").trim() || p.trim();
const titleFrom = (subject: string): string => {
  const m = subject.match(/\b(?:of|for|called|named)\s+(.+)$/i);
  const core = (m ? m[1] : subject).replace(/\b(app|application|website|ui|window|interface|dashboard|site)\b/gi, "").replace(/[^A-Za-z0-9 ]/g, " ").trim();
  return core.split(/\s+/).slice(0, 4).map(w => (w[0] ? w[0].toUpperCase() + w.slice(1) : w)).join(" ") || "XR App";
};
for (const p of ["make a window of xr code app", "create a dashboard for my shop", "generate a logo for XR", "a sunset over mountains", "design an icon for the editor app"]) {
  const s = subjectOf(p);
  const kind = LOGO_RE.test(p) ? "logo" : UI_RE.test(p) ? "ui" : "photo";
  console.log(`"${p}" → ${kind} | subject: "${s}"${kind === "ui" ? ` | title: "${titleFrom(s)}"` : ""}`);
}

#!/usr/bin/env python3
"""Convert prefers-reduced-motion media gates into a runtime-driven class gate.

- @media (prefers-reduced-motion:no-preference){...}  ->  html:not(.anim-off) prefixed rules
- @media (prefers-reduced-motion:reduce){* nuke}      ->  html.anim-off * nuke

Then JS can force animations ON even when the OS (debloated PC) reports reduce:
  S.anim = 'auto' (default, follow OS) | 'on' (force) | 'off' (calm).
"""
import re, sys

PATH = "/home/z/my-project/download/xr-code.html"
src = open(PATH, encoding="utf-8").read()
lines = src.split("\n")

def brace_end(lines, start_idx):
    """Return index of the line whose braces close the block opened on start_idx."""
    depth = 0
    for i in range(start_idx, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if depth == 0:
            return i
    raise RuntimeError("unbalanced braces from line %d" % (start_idx + 1))

out = []
i = 0
converted_np = converted_r = 0
while i < len(lines):
    ln = lines[i]
    if ln.strip() == "@media (prefers-reduced-motion:no-preference){" or ln.strip().startswith("@media (prefers-reduced-motion:no-preference)"):
        end = brace_end(lines, i)
        inner = lines[i + 1:end]
        for raw in inner:
            s = raw[2:] if raw.startswith("  ") else raw
            st = s.strip()
            if not st:
                out.append(s); continue
            if st.startswith("@keyframes") or st.startswith("/*") or st.startswith("*"):
                out.append(s); continue
            if st.startswith("@media"):  # nested media (shouldn't happen) — keep
                out.append(s); continue
            if re.match(r"^[^\s}][^{]*\{", s):  # selector line with a rule opener
                out.append("html:not(.anim-off) " + s); continue
            out.append(s)  # continuation / closing brace
        converted_np += 1
        i = end + 1
        continue
    if ln.strip() == "@media (prefers-reduced-motion:reduce){" or ln.strip().startswith("@media (prefers-reduced-motion:reduce)"):
        end = brace_end(lines, i)
        body = lines[i + 1:end]
        for raw in body:
            s = raw[2:] if raw.startswith("  ") else raw
            st = s.strip()
            if re.match(r"^\*.*,?\s*\*?::?before.*\{", st) or st.startswith("*,"):
                # *,*::before,*::after{...}  ->  gate under html.anim-off
                s = s.replace("*,", "html.anim-off *,", 1)
                out.append(s); continue
            out.append(s)
        converted_r += 1
        i = end + 1
        continue
    out.append(ln)
    i += 1

open(PATH, "w", encoding="utf-8").write("\n".join(out))
print("converted no-preference blocks:", converted_np, "| reduce blocks:", converted_r)
# sanity: no reduced-motion media queries remain, class gates present
txt = "\n".join(out)
print("remaining media gates:", txt.count("prefers-reduced-motion)"))
print("anim-off gates in CSS:", txt.count("html.anim-off"))
print("not(.anim-off) rules:", txt.count("html:not(.anim-off)"))

#!/usr/bin/env python3
"""Post-process the tutorial docx per toc.md WPS rules:
1. patch footer PAGE fields with explicit \\* ROMAN / \\* arabic switches
2. strip empty <w:pgNumType/> (cover section artifact)
Section order: cover (no footer) -> front matter (Roman) -> body (Arabic).
Footer files are matched to sections via document.xml sectPr order.
"""
import re, shutil, sys, zipfile, os

DOC = "/home/z/my-project/download/Adding-Google-Login-to-XR-Code.docx"
TMP = "/tmp/ggtut"

shutil.rmtree(TMP, ignore_errors=True)
with zipfile.ZipFile(DOC) as z:
    z.extractall(TMP)

docp = os.path.join(TMP, "word", "document.xml")
xml = open(docp, encoding="utf-8").read()

# 1. strip empty pgNumType
xml, n_empty = re.subn(r"<w:pgNumType/>", "", xml)

# 1b. remove stale cached-result runs in the main TOC field paragraph:
# docx-js leaves a sample text run after the separate fldChar, which renders
# as a duplicated first TOC line without a page number. The injected entries
# follow as their own paragraphs, so the residue is safe to drop.
def strip_toc_residue(x):
    def fix(m):
        p = m.group(0)
        if not re.search(r"<w:instrText[^>]*>[^<]*TOC", p):
            return p
        sep = p.find('w:fldCharType="separate"')
        if sep == -1:
            return p
        head, tail = p[:sep], p[sep:]
        tail = re.sub(r'<w:r>(?:(?!<w:r>).)*?<w:t[^>]*>[^<]+</w:t>(?:(?!</w:r>).)*?</w:r>', "", tail, flags=re.S)
        return head + tail
    return re.sub(r"<w:p\b(?:(?!</w:p>).)*?</w:p>", fix, x, flags=re.S)

before = len(xml)
xml = strip_toc_residue(xml)
print("TOC residue stripped:", before - len(xml), "chars")

# 2. map each sectPr's footerReference rId to its numbering format
rels = open(os.path.join(TMP, "word", "_rels", "document.xml.rels"), encoding="utf-8").read()
rid_to_target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

sect_fmt = []  # (footer target, 'roman'|'arabic'|None) in document order
for sect in re.findall(r"<w:sectPr.*?</w:sectPr>|<w:sectPr[^>]*/>", xml, re.S):
    fmt = None
    if 'w:fmt="upperRoman"' in sect: fmt = "roman"
    elif 'w:fmt="decimal"' in sect: fmt = "arabic"
    m = re.search(r'<w:footerReference[^>]*r:id="(rId\d+)"', sect)
    target = rid_to_target.get(m.group(1)) if m else None
    if target and fmt:
        sect_fmt.append((target, fmt))

patched = []
for target, fmt in sect_fmt:
    fp = os.path.join(TMP, "word", target)
    if not os.path.exists(fp): continue
    fx = open(fp, encoding="utf-8").read()
    switch = "ROMAN" if fmt == "roman" else "arabic"
    fx2, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + switch + r" \\* MERGEFORMAT \2", fx)
    if n:
        open(fp, "w", encoding="utf-8").write(fx2)
        patched.append((target, switch, n))

open(docp, "w", encoding="utf-8").write(xml)

# rezip
out = DOC
new = DOC + ".new"
with zipfile.ZipFile(new, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(TMP):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, TMP))
shutil.move(new, out)
print("empty pgNumType removed:", n_empty, "| footers patched:", patched)

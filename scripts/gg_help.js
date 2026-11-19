// Shared helpers for the Google-Login tutorial docx (skill-compliant).
// English document profile: Times New Roman body, left-aligned, no first-line indent.
const {
  Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableLayoutType,
} = require("docx");

// ── Palette: Dawn Mist Tech (Cool + Light + Active) body + DM-1 table tokens ──
const P = {
  primary: "0A1628", body: "1A2B40", secondary: "6878A0", accent: "5B8DB8",
  cover: { bg: "162235", titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078", accent: "37DCF2" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  codeBg: "F2F5F7", codeText: "14212E",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const EN = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const MONO = { ascii: "Consolas", eastAsia: "Consolas" };

function safeText(v, ph) {
  if (v === undefined || v === null || v === "" || String(v) === "NaN" || String(v) === "undefined") return ph || "[fill in]";
  return String(v);
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: EN })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: EN })],
  });
}

// body paragraph — English: left aligned, no indent; parts = [{t, bold, code}]
function body(parts, opts) {
  const o = opts || {};
  const runs = (Array.isArray(parts) ? parts : [{ t: parts }]).map(p =>
    new TextRun({
      text: safeText(p.t),
      bold: !!p.bold,
      italics: !!p.i,
      size: p.code ? 20 : 24,
      color: p.code ? P.codeText : P.body,
      font: p.code ? MONO : EN,
    }));
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: o.after === undefined ? 120 : o.after },
    children: runs,
  });
}

// numbered step — reference must be unique per list
function step(reference, parts) {
  const runs = (Array.isArray(parts) ? parts : [{ t: parts }]).map(p =>
    new TextRun({ text: safeText(p.t), bold: !!p.bold, size: p.code ? 20 : 24, color: p.code ? P.codeText : P.body, font: p.code ? MONO : EN }));
  return new Paragraph({
    numbering: { reference, level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 100 },
    children: runs,
  });
}

// code block — one row per line so it flows across pages without clipping
function codeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: lines.map(line => new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: P.codeBg },
        borders: noBorders,
        margins: { top: 4, bottom: 4, left: 160, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 240, before: 0, after: 0 },
          children: [new TextRun({ text: line.length ? line : " ", size: 17, color: P.codeText, font: MONO })],
        })],
      })],
    })),
  });
}

function codeCaption(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.secondary, font: EN })],
  });
}

// horizontal-only data table
function dataTable(title, headers, rows, widths) {
  const mk = (text, isHead) => new TableCell({
    width: undefined,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 280 },
      children: [new TextRun({ text: safeText(text), bold: !!isHead, size: 20, color: isHead ? P.table.headerText : P.body, font: isHead ? EN : { ascii: "Times New Roman", eastAsia: "Times New Roman" } })],
    })],
    shading: isHead ? { type: ShadingType.CLEAR, fill: P.table.headerBg } : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
  });
  const out = [];
  if (title) out.push(new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text: title, bold: true, size: 21, color: P.secondary, font: EN })],
  }));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map(t => mk(t, true)) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((t, i) => {
        const cell = mk(t, false);
        return new TableCell({
          children: cell.options.children, margins: cell.options.margins,
          width: { size: (widths && widths[i]) || Math.floor(100 / r.length), type: WidthType.PERCENTAGE },
        });
      }) })),
    ],
  }));
  return out;
}

module.exports = { P, NB, noBorders, allNoBorders, EN, MONO, safeText, h1, h2, body, step, codeBlock, codeCaption, dataTable };

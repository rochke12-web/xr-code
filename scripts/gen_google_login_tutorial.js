// Assemble the Google-Login tutorial docx — cover / TOC (Roman) / body (Arabic).
const {
  Document, Packer, Paragraph, TextRun, Footer, AlignmentType, PageNumber,
  NumberFormat, SectionType, LevelFormat, TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");
const { P, EN } = require("./gg_help");
const { buildCoverR1 } = require("./gg_cover");
const { A } = require("./gg_content_a");
const { B } = require("./gg_content_b");

const numbering = {
  config: ["steps-gcp", "steps-test", "steps-prod", "steps-sec"].map(ref => ({
    reference: ref,
    levels: [{
      level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 620, hanging: 360 } } },
    }],
  })),
};

const footer = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: EN })],
  })],
});

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const cover = buildCoverR1({
  title: "Adding Google Login to XR-Code",
  subtitle: "The Google door into your existing xr_ds session - step by step, no API rewrites",
  englishLabel: "OAUTH 2.0 TUTORIAL",
  metaLines: [
    "Stack: Next.js App Router + HMAC-signed session cookie (xr_ds)",
    "Reuse: mintToken() and verifyDiscord() - zero API changes",
    "Touch: 2 new routes, 1 tiny page, 4 secrets, 1 button",
    "Time: about 30 minutes end to end",
  ],
  footerLeft: "XR-Code - Made by Yug Sunar",
  footerRight: "November 19, 2026",
  palette: P.cover,
});

const frontMatter = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: EN, color: P.primary })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
      italics: true, size: 18, color: "888888", font: EN,
    })],
  }),
  // no PageBreak here — the body section below is SectionType.NEXT_PAGE;
  // a trailing break would produce a blank page (postcheck rule)
];

const doc = new Document({
  numbering,
  styles: {
    default: {
      document: {
        run: { font: EN, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: EN, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: EN, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    { // cover — margin 0, no footer, no page numbers
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: cover,
    },
    { // front matter — TOC, Roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: footer() },
      children: frontMatter,
    },
    { // body — Arabic, restart at 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      footers: { default: footer() },
      children: [...A, ...B],
    },
  ],
});

const OUT = "/home/z/my-project/download/Adding-Google-Login-to-XR-Code.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("written:", OUT, Math.round(buf.length / 1024) + " KB");
});

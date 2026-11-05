import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { DetailItem, ListPatient, PatientList } from "./schema";

// A4 portrait, 1.27 cm margins (all sizes in twips: 1 pt = 20, 1 cm = 567).
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 720;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 10466
// About 24% │ 26% │ 50% of the page width.
const COLS = [2512, 2721, CONTENT_W - 2512 - 2721];

const FONT = "Calibri";
const BODY = 19; // 9.5 pt (half-points)
const NAVY = "1F3864";
const DARK_GREY = "404040";
const GREY = "595959";
const RED = "C00000";
const HEADER_FILL = "D9E2F3"; // light navy-grey
const ALT_FILL = "F7F7F7"; // very light grey
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" }; // 0.5 pt
const SEP = " │ ";

const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 }; // 3 pt / 4 pt

function run(text: string, opts: Partial<{ bold: boolean; color: string; size: number; highlight: boolean }> = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? BODY,
    bold: opts.bold,
    color: opts.color,
    highlight: opts.highlight ? "yellow" : undefined,
  });
}

function itemRuns(item: DetailItem): TextRun[] {
  // Items cannot contain the separator; replace any that slipped through.
  let text = item.text.replaceAll("│", "/").replace(/[.;,\s]+$/, "").trim();
  if (item.flag === "verify" && !/VERIFY$/i.test(text)) text = `${text} VERIFY`;
  if (item.flag === "critical") return [run(text, { bold: true, color: RED })];
  if (item.flag === "pending" || item.flag === "verify") return [run(text, { highlight: true })];
  return [run(text)];
}

function bulletParagraph(items: DetailItem[]): Paragraph | null {
  const kept = items.filter((i) => i.text.trim());
  if (!kept.length) return null;
  const children: TextRun[] = [];
  kept.forEach((item, i) => {
    if (i > 0) children.push(run(SEP, { color: GREY }));
    children.push(...itemRuns(item));
  });
  return new Paragraph({
    numbering: { reference: "details", level: 0 },
    spacing: { before: 0, after: 0, line: 240 },
    children,
  });
}

function cell(children: Paragraph[], width: number, fill?: string) {
  return new TableCell({
    children: children.length ? children : [new Paragraph({ children: [] })],
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: cellMargins,
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
  });
}

function tight(children: TextRun[], keepNext = false) {
  return new Paragraph({ children, keepNext, spacing: { before: 0, after: 0, line: 240 } });
}

function headerRow() {
  const labels = ["PATIENT", "OPERATION (DIAGNOSIS)", "MEDICAL DETAILS"];
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: labels.map((label, i) =>
      cell([tight([run(label, { bold: true, color: NAVY })], true)], COLS[i], HEADER_FILL),
    ),
  });
}

function patientRow(p: ListPatient, n: number) {
  const fill = n % 2 === 0 ? ALT_FILL : undefined;
  const sex = p.sex.trim() ? `${p.sex.trim()}${p.sexProvisional ? " (provisional)" : ""}` : "SEX NOT STATED";

  const col1: Paragraph[] = [
    tight([
      run(`${n}. ${p.name.trim().toUpperCase()}`, { bold: true }),
      ...(p.caseStatus !== "none" ? [run(`  ${p.caseStatus}`, { bold: true })] : []),
    ]),
    tight([
      run([p.age.trim() || "AGE ?", sex, p.fileNo.trim() ? `File No. ${p.fileNo.trim()}` : ""].filter(Boolean).join(" / "), {
        color: GREY,
      }),
      ...(p.fileNo.trim() ? [] : [run(" / FILE NO. MISSING", { bold: true, color: RED })]),
    ]),
  ];

  const col2: Paragraph[] = [tight([run(p.operation.trim().toUpperCase(), { bold: true })])];
  const diagnosis = p.diagnosis.trim().replace(/^\(|\)$/g, "");
  if (diagnosis) col2.push(tight([run(`(${diagnosis})`)]));

  const col3: Paragraph[] = [];
  if (!p.sheetAvailable) {
    col3.push(
      new Paragraph({
        numbering: { reference: "details", level: 0 },
        spacing: { before: 0, after: 0, line: 240 },
        children: [run("SHEET NOT AVAILABLE", { bold: true, highlight: true })],
      }),
    );
  }
  for (const b of p.bullets) {
    const para = bulletParagraph(b);
    if (para) col3.push(para);
  }

  return new TableRow({
    cantSplit: true,
    children: [cell(col1, COLS[0], fill), cell(col2, COLS[1], fill), cell(col3, COLS[2], fill)],
  });
}

function roomBlock(heading: string, patients: ListPatient[], first: boolean) {
  const band = new Paragraph({
    keepNext: true,
    keepLines: true,
    spacing: { before: first ? 0 : 140, after: 0 }, // 7 pt between rooms
    shading: { fill: NAVY, type: ShadingType.CLEAR, color: "auto" },
    indent: { left: 0, right: 0 },
    children: [run(heading.trim(), { bold: true, color: "FFFFFF", size: 20 })],
  });
  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COLS,
    layout: TableLayoutType.FIXED,
    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
      insideHorizontal: BORDER,
      insideVertical: BORDER,
    },
    rows: [headerRow(), ...patients.map((p, i) => patientRow(p, i + 1))],
  });
  return [band, table];
}

/** Patients with nothing in them (no name and no operation) are dropped. */
export function cleanList(list: PatientList): PatientList {
  return {
    ...list,
    rooms: list.rooms
      .map((r) => ({ ...r, patients: r.patients.filter((p) => p.name.trim() || p.operation.trim()) }))
      .filter((r) => r.heading.trim()),
  };
}

export async function buildDocx(list: PatientList): Promise<Buffer> {
  const hospital = list.hospital.trim() || "Jaber Al Ahmad Hospital";
  const footerDate = list.footerDate.trim() || "--/--/----";

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [run(hospital, { bold: true, color: NAVY, size: 28 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [run(list.listTitle.trim().toUpperCase(), { bold: true, color: DARK_GREY, size: 22 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
        children: [run(list.dayDate.trim().toUpperCase(), { bold: true, size: 20 })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            font: FONT,
            size: 16,
            color: GREY,
            children: [
              `${hospital}${SEP}Anaesthesia Patient List${SEP}${footerDate}${SEP}Page `,
              PageNumber.CURRENT,
              " of ",
              PageNumber.TOTAL_PAGES,
            ],
          }),
        ],
      }),
    ],
  });

  const body = list.rooms.flatMap((r, i) => roomBlock(r.heading, r.patients, i === 0));

  const doc = new Document({
    creator: hospital,
    title: `${list.listTitle} ${list.dayDate}`.trim(),
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY }, paragraph: { spacing: { before: 0, after: 0, line: 240 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: "details",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 180, hanging: 140 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 360, footer: 360 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: body.length ? body : [new Paragraph({ children: [run("NO PATIENTS FOUND IN THE PDF", { bold: true, highlight: true })] })],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** Checks done in code before the file is handed over. */
export function qualityCheck(list: PatientList): string[] {
  const notes: string[] = [];
  for (const r of list.rooms) {
    if (r.sourceCount !== r.patients.length) {
      notes.push(`${r.heading}: source list shows ${r.sourceCount} patients, file has ${r.patients.length} VERIFY`);
    }
    if (!r.patients.length) notes.push(`${r.heading}: no patients`);
  }
  const seen = new Map<string, string>();
  for (const r of list.rooms) {
    r.patients.forEach((p, i) => {
      const f = p.fileNo.trim();
      if (!f) return;
      const where = `${r.heading} #${i + 1} ${p.name}`;
      if (seen.has(f)) notes.push(`File No. ${f} appears twice (${seen.get(f)} and ${where}) VERIFY`);
      else seen.set(f, where);
    });
  }
  return notes;
}

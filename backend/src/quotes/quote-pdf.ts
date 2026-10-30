import type { QuoteLineSnapshot } from './quote.entity';

/**
 * Générateur PDF minimaliste (PDF 1.4, Helvetica/Helvetica-Bold, WinAnsi),
 * sans dépendance native : le devis reste téléchargeable même sans
 * bibliothèque tierce. Texte uniquement (aucune image) + filets de tableau.
 */

const WINANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Encode en WinAnsi (chaîne binaire 1 car. = 1 octet) ; inconnu → '?'. */
export function toWinAnsi(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) as number;
    if (code < 0x80) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += ch;
    else if (WINANSI_EXTRA[code] !== undefined) out += String.fromCharCode(WINANSI_EXTRA[code]);
    else out += '?';
  }
  return out;
}

function pdfText(input: string): string {
  return `(${toWinAnsi(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

export interface PdfLineRow {
  designation: string;
  quantite: string;
  prixUnitaire: string;
  sousTotal: string;
  statut: string;
}

export interface QuotePdfData {
  numero: string;
  dateGeneration: string;
  client: string;
  statut: string;
  provisoire: boolean;
  donneesSimulees: boolean;
  lignes: PdfLineRow[];
  total: string | null;
  raisons: string[];
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars) : w;
      if (w.length > maxChars) {
        let rest = w.slice(maxChars);
        while (rest.length > 0) {
          lines.push(current);
          current = rest.slice(0, maxChars);
          rest = rest.slice(maxChars);
        }
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

interface Page {
  ops: string[];
  y: number;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const BOTTOM = 70;

function newPage(): Page {
  return { ops: [], y: PAGE_H - MARGIN };
}

function text(
  page: Page,
  x: number,
  str: string,
  size: number,
  bold: boolean,
): void {
  page.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${page.y.toFixed(1)} Td ${pdfText(str)} Tj ET`);
  page.y -= size * 1.45;
}

function rule(page: Page, x1: number, x2: number): void {
  page.ops.push(`${x1.toFixed(1)} ${page.y.toFixed(1)} m ${x2.toFixed(1)} ${page.y.toFixed(1)} l S`);
  page.y -= 6;
}

export function buildQuotePdf(data: QuotePdfData): Buffer {
  const pages: Page[] = [newPage()];
  const page = () => pages[pages.length - 1];
  const need = (h: number) => {
    if (page().y - h < BOTTOM) pages.push(newPage());
  };

  need(60);
  text(page(), MARGIN, 'BLOK Relance', 20, true);
  text(page(), MARGIN, 'Devis commercial', 14, true);
  need(30);
  text(page(), MARGIN, `Devis ${data.numero} — généré le ${data.dateGeneration}`, 11, false);
  text(page(), MARGIN, `Client : ${data.client}`, 11, false);
  text(page(), MARGIN, `Statut : ${data.statut}`, 11, false);
  if (data.provisoire) {
    need(20);
    text(page(), MARGIN, 'Devis provisoire : certaines informations restent à confirmer (voir lignes).', 10, true);
  }
  if (data.donneesSimulees) {
    need(20);
    text(page(), MARGIN, 'Données de démonstration simulées : aucun prix réel.', 10, true);
  }

  const cols = [MARGIN, 268, 348, 428, 500];
  const right = PAGE_W - MARGIN;
  need(40);
  page().y -= 6;
  text(page(), cols[0], 'Produit', 10, true);
  const hy = page().y + 10 * 1.45;
  const head = (x: number, s: string) => {
    page().ops.push(`BT /F2 10 Tf ${x.toFixed(1)} ${hy.toFixed(1)} Td ${pdfText(s)} Tj ET`);
  };
  head(cols[1], 'Qté');
  head(cols[2], 'Prix unit.');
  head(cols[3], 'Sous-total');
  head(cols[4], 'Statut');
  rule(page(), MARGIN, right);

  for (const ligne of data.lignes) {
    const labelLines = wrap(ligne.designation, 44);
    const statutLines = wrap(ligne.statut, 12);
    const height = Math.max(labelLines.length, statutLines.length) * 10 * 1.45 + 8;
    need(height);
    const topY = page().y;
    const cell = (x: number, s: string) => {
      page().ops.push(`BT /F1 10 Tf ${x.toFixed(1)} ${topY.toFixed(1)} Td ${pdfText(s)} Tj ET`);
    };
    labelLines.forEach((s, i) => {
      page().ops.push(
        `BT /F1 10 Tf ${cols[0].toFixed(1)} ${(topY - i * 10 * 1.45).toFixed(1)} Td ${pdfText(s)} Tj ET`,
      );
    });
    cell(cols[1], ligne.quantite);
    cell(cols[2], ligne.prixUnitaire);
    cell(cols[3], ligne.sousTotal);
    statutLines.forEach((s, i) => {
      page().ops.push(
        `BT /F1 10 Tf ${cols[4].toFixed(1)} ${(topY - i * 10 * 1.45).toFixed(1)} Td ${pdfText(s)} Tj ET`,
      );
    });
    page().y = topY - height;
    rule(page(), MARGIN, right);
  }

  need(30);
  page().y -= 4;
  if (data.total !== null) {
    text(page(), MARGIN, `Total (produits commandables) : ${data.total}`, 12, true);
  } else {
    text(page(), MARGIN, 'Total non calculable.', 12, true);
  }
  for (const raison of data.raisons) {
    for (const wline of wrap(`• ${raison}`, 92)) {
      need(16);
      text(page(), MARGIN, wline, 9, false);
    }
  }
  need(30);
  page().y -= 4;
  for (const wline of wrap(
    'Document généré par ESTHER, agente commerciale virtuelle de BLOK Relance, à partir des informations catalogue revérifiées à la génération. Aucun frais de livraison, taxe ou remise ajouté : non fournis.',
    92,
  )) {
    need(16);
    text(page(), MARGIN, wline, 9, false);
  }

  // Assemblage PDF.
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const fontRef = '<< /Font << /F1 3 0 R /F2 4 0 R >> >>';
  pages.forEach((p, i) => {
    const contentNum = 6 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${fontRef} /Contents ${contentNum} 0 R >>`,
    );
    const stream = p.ops.join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let cursor = parts[0].length;
  // Les objets sont numérotés à partir de 1 : objects[0] -> "1 0 obj".
  objects.forEach((body, i) => {
    offsets.push(cursor);
    const chunk = Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1');
    parts.push(chunk);
    cursor += chunk.length;
  });
  const xrefStart = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

/** Libellé français d'affichage d'une ligne (écran + PDF). */
export function statutLigneFr(ligne: QuoteLineSnapshot): string {
  if (ligne.dispo === 'indisponible') return 'Indisponible';
  if (ligne.dispo === 'a_confirmer') return 'Disponibilité à confirmer';
  if (ligne.prix === 'non_communique') return 'Prix non communiqué';
  return 'Disponible';
}

export function montantFr(value: number | null, devise: string | null): string {
  if (value === null) return '—';
  const arrondi = (Math.round(value * 100) / 100).toString();
  return devise ? `${arrondi} ${devise}` : `${arrondi} (devise non fournie)`;
}

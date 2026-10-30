import { buildQuotePdf, montantFr, statutLigneFr, toWinAnsi } from './quote-pdf';
import type { QuotePdfData } from './quote-pdf';

function data(over: Partial<QuotePdfData> = {}): QuotePdfData {
  return {
    numero: 'DEV-2026-ABC123',
    dateGeneration: '29/10/2026 10:00',
    client: 'DEMO-Q01',
    statut: 'définitif',
    provisoire: false,
    donneesSimulees: false,
    lignes: [
      {
        designation: 'Ciment CPJ 50kg (REF-101)',
        quantite: '100 sac',
        prixUnitaire: '6500 XOF',
        sousTotal: '650000 XOF',
        statut: 'Disponible',
      },
    ],
    total: '650000 XOF',
    raisons: [],
    ...over,
  };
}

describe('toWinAnsi', () => {
  test('accents français et euro préservés', () => {
    const bytes = Buffer.from(toWinAnsi('é è à ç û € « »'), 'latin1');
    expect([...bytes]).toEqual([0xe9, 0x20, 0xe8, 0x20, 0xe0, 0x20, 0xe7, 0x20, 0xfb, 0x20, 0x80, 0x20, 0xab, 0x20, 0xbb]);
  });

  test('caractère hors WinAnsi remplacé, jamais d’octet perdu', () => {
    expect(toWinAnsi('ciment → chantier ✓')).toContain('?');
    expect(toWinAnsi('ciment → chantier ✓').length).toBe('ciment → chantier ✓'.length);
  });
});

describe('buildQuotePdf', () => {
  test('11. document valide : en-tête, numéro, total, fin de fichier', () => {
    const pdf = buildQuotePdf(data());
    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    const raw = pdf.toString('latin1');
    expect(raw).toContain('DEV-2026-ABC123');
    expect(raw).toContain('650000 XOF');
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  test('table xref cohérente : chaque offset pointe un objet', () => {
    const pdf = buildQuotePdf(data());
    const raw = pdf.toString('latin1');
    const xrefAt = raw.indexOf('\nxref\n');
    expect(xrefAt).toBeGreaterThan(0);
    const section = raw.slice(xrefAt, raw.indexOf('trailer'));
    const lines = section.split('\n').slice(2).filter((l) => l.endsWith(' n '));
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const line of lines) {
      const offset = parseInt(line.slice(0, 10), 10);
      const objIndex = lines.indexOf(line) + 1;
      expect(raw.slice(offset, offset + `${objIndex} 0 obj`.length)).toBe(`${objIndex} 0 obj`);
    }
    expect(raw).toContain('/Count 1');
  });

  test('parenthèses du libellé échappées, structure intacte', () => {
    const pdf = buildQuotePdf(
      data({ lignes: [{ designation: 'Fer (barre 12 m)', quantite: '2 tonne', prixUnitaire: '—', sousTotal: '—', statut: 'Prix non communiqué' }] }),
    );
    const raw = pdf.toString('latin1');
    expect(raw).toContain('Fer \\(barre 12 m\\)');
  });

  test('multipage : 30 lignes tiennent sur 2 pages', () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({
      designation: `Produit de démonstration ${i + 1}`,
      quantite: `${i + 1} sac`,
      prixUnitaire: '1000 XOF',
      sousTotal: `${(i + 1) * 1000} XOF`,
      statut: 'Disponible',
    }));
    const raw = buildQuotePdf(data({ lignes })).toString('latin1');
    expect(raw).toContain('/Count 2');
  });

  test('devis provisoire : mention explicite dans le document', () => {
    const raw = buildQuotePdf(
      data({ statut: 'provisoire', provisoire: true, total: null, raisons: ['Prix non communiqué.'] }),
    ).toString('latin1');
    expect(raw).toContain('provisoire');
  });
});

describe('libellés français', () => {
  test('statutLigneFr couvre les 4 situations', () => {
    const base = {
      label: 'x', ref: null, variantId: null, qty: 1, unit: 'sac', unitPrice: 1,
      currency: 'XOF', sousTotal: 1, source: 'core', fetchedAt: '', note: null,
    } as const;
    expect(statutLigneFr({ ...base, dispo: 'indisponible', prix: 'communique' })).toBe('Indisponible');
    expect(statutLigneFr({ ...base, dispo: 'disponible', prix: 'non_communique' })).toBe('Prix non communiqué');
    expect(statutLigneFr({ ...base, dispo: 'a_confirmer', prix: 'non_communique' })).toBe('Disponibilité à confirmer');
    expect(statutLigneFr({ ...base, dispo: 'disponible', prix: 'communique' })).toBe('Disponible');
  });

  test('montantFr : tiret si inconnu, jamais de zéro inventé', () => {
    expect(montantFr(null, 'XOF')).toBe('—');
    expect(montantFr(650000, 'XOF')).toBe('650000 XOF');
    expect(montantFr(10, null)).toContain('devise non fournie');
  });
});

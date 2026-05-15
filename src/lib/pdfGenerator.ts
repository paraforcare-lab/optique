import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCUMENT_CONFIG: Record<string, { title: string; entityLabel: string; labels: Record<string, string> }> = {
  facture: {
    title: 'FACTURE',
    entityLabel: 'Client',
    labels: {
      numero: 'Numéro',
      date: 'Date',
      reference: 'Référence',
      modePaiement: 'Mode de Règlement',
      echeance: 'Échéance',
      agent: 'Agent',
    },
  },
  devis: {
    title: 'DEVIS',
    entityLabel: 'Client',
    labels: {
      numero: 'Numéro',
      date: 'Date',
      reference: 'Référence',
      modePaiement: 'Mode de Règlement',
      echeance: 'Échéance',
      agent: 'Agent',
    },
  },
  bon_commande: {
    title: 'BON DE COMMANDE',
    entityLabel: 'Fournisseur',
    labels: {
      numero: 'Numéro',
      date: 'Date',
      reference: 'Référence',
      modePaiement: 'Mode de Règlement',
      echeance: 'Échéance',
      agent: 'Agent',
    },
  },
  bon_livraison: {
    title: 'BON DE LIVRAISON',
    entityLabel: 'Fournisseur',
    labels: {
      numero: 'Numéro',
      date: 'Date',
      reference: 'Référence',
      modePaiement: 'Mode de Règlement',
      echeance: 'Échéance',
      agent: 'Agent',
    },
  },
};

const NUMBER_UNITS = [
  '', 'mille', 'million', 'milliard',
];
const NUMBER_WORDS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
  'vingt', 'vingt et un', 'vingt-deux', 'vingt-trois', 'vingt-quatre', 'vingt-cinq', 'vingt-six', 'vingt-sept', 'vingt-huit', 'vingt-neuf',
  'trente', 'trente et un', 'trente-deux', 'trente-trois', 'trente-quatre', 'trente-cinq', 'trente-six', 'trente-sept', 'trente-huit', 'trente-neuf',
  'quarante', 'quarante et un', 'quarante-deux', 'quarante-trois', 'quarante-quatre', 'quarante-cinq', 'quarante-six', 'quarante-sept', 'quarante-huit', 'quarante-neuf',
  'cinquante', 'cinquante et un', 'cinquante-deux', 'cinquante-trois', 'cinquante-quatre', 'cinquante-cinq', 'cinquante-six', 'cinquante-sept', 'cinquante-huit', 'cinquante-neuf',
  'soixante', 'soixante et un', 'soixante-deux', 'soixante-trois', 'soixante-quatre', 'soixante-cinq', 'soixante-six', 'soixante-sept', 'soixante-huit', 'soixante-neuf',
  'soixante-dix', 'soixante et onze', 'soixante-douze', 'soixante-treize', 'soixante-quatorze', 'soixante-quinze', 'soixante-seize', 'soixante-dix-sept', 'soixante-dix-huit', 'soixante-dix-neuf',
  'quatre-vingts', 'quatre-vingt-un', 'quatre-vingt-deux', 'quatre-vingt-trois', 'quatre-vingt-quatre', 'quatre-vingt-cinq', 'quatre-vingt-six', 'quatre-vingt-sept', 'quatre-vingt-huit', 'quatre-vingt-neuf',
  'quatre-vingt-dix', 'quatre-vingt-onze', 'quatre-vingt-douze', 'quatre-vingt-treize', 'quatre-vingt-quatorze', 'quatre-vingt-quinze', 'quatre-vingt-seize', 'quatre-vingt-dix-sept', 'quatre-vingt-dix-huit', 'quatre-vingt-dix-neuf',
];

function convertBelow1000(n: number): string {
  if (n === 0) return '';
  let result = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    if (hundreds === 1) {
      result += 'cent';
    } else {
      result += NUMBER_WORDS[hundreds] + ' cent';
    }
    if (remainder === 0 && hundreds > 1) {
      result += 's';
    }
  }

  if (remainder > 0) {
    if (result) result += ' ';
    if (remainder < 20) {
      result += NUMBER_WORDS[remainder];
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      if (tens === 8) {
        result += NUMBER_WORDS[18 + ones];
      } else if (tens === 9) {
        result += NUMBER_WORDS[18 + 10 + ones];
      } else {
        result += NUMBER_WORDS[tens * 10];
        if (ones > 0) {
          result += '-' + NUMBER_WORDS[ones];
        }
      }
    }
  }

  return result;
}

function numberToWords(n: number): string {
  if (n === 0) return NUMBER_WORDS[0];

  const negative = n < 0;
  n = Math.abs(n);

  const parts: string[] = [];
  let unitIndex = 0;

  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      let chunkStr = convertBelow1000(chunk);
      if (unitIndex === 1 && chunk === 1) {
        chunkStr = 'mille';
      } else if (unitIndex > 0) {
        chunkStr += ' ' + NUMBER_UNITS[unitIndex];
        if (chunk > 1 && unitIndex > 1) {
          chunkStr += 's';
        }
      }
      parts.unshift(chunkStr);
    }
    n = Math.floor(n / 1000);
    unitIndex++;
  }

  let result = parts.join(' ');
  if (negative) result = 'moins ' + result;
  return result.trim();
}

function numberToWordsCurrency(amount: number): string {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  let result = numberToWords(euros) + ' dirhams';
  if (cents > 0) {
    result += ' et ' + numberToWords(cents) + ' centimes';
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR').format(d);
}

interface TvaBucket {
  rate: number
  baseHt: number
  montantTva: number
}

function computeTvaBuckets(items: DocumentItem[]): TvaBucket[] {
  const map = new Map<number, TvaBucket>()
  for (const item of items) {
    const qte = Number(item.quantite) || 0
    const pu = Number(item.prix_unitaire_ht) || 0
    const totalHt = qte * pu
    const tvaRate = Number(item.tva ?? 20)
    const existing = map.get(tvaRate)
    if (existing) {
      existing.baseHt += totalHt
      existing.montantTva += totalHt * (tvaRate / 100)
    } else {
      map.set(tvaRate, { rate: tvaRate, baseHt: totalHt, montantTva: totalHt * (tvaRate / 100) })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.rate - a.rate)
}

export interface DocumentItem {
  reference?: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  tva?: number;
}

export interface DocumentData {
  documentType: 'facture' | 'devis' | 'bon_commande' | 'bon_livraison';
  userId?: string;
  numero: string;
  date: string;
  reference?: string;
  modePaiement?: string;
  echeance?: string;
  agent?: string;
  client: {
    nom: string;
    adresse?: string;
    ville?: string;
    ice?: string;
    rc?: string;
    telephone?: string;
    email?: string;
  };
  company: {
    nom: string;
    adresse: string;
    ville: string;
    codePostal?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    rc: string;
    if_number: string;
    ice: string;
    capital?: string;
    formeJuridique?: string;
    logo?: string;
  };
  items: DocumentItem[];
  notes?: string;
  conditionsPaiement?: string;
  watermarkText?: string;
}

function generateHTML(data: DocumentData): string {
  const config = DOCUMENT_CONFIG[data.documentType] || DOCUMENT_CONFIG.facture;
  const title = config.title;
  const entityLabel = config.entityLabel;

  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  const itemRows = data.items.map((item, index) => {
    const qte = Number(item.quantite) || 0;
    const pu = Number(item.prix_unitaire_ht) || 0;
    const montantHT = qte * pu;
    const tvaRate = Number(item.tva ?? 20);
    const montantTVA = montantHT * (tvaRate / 100);
    const montantTTC = montantHT + montantTVA;

    totalHT += montantHT;
    totalTVA += montantTVA;
    totalTTC += montantTTC;

    return `
      <tr>
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.reference || '-'}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:left;border-bottom:0.5pt solid #E5E7EB;">${item.designation}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(qte)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(pu, 4)}</td>
        <td style="padding:5px 6px;font-size:9pt;text-align:right;font-weight:600;border-bottom:0.5pt solid #E5E7EB;">${formatCurrency(montantHT)}</td>
      </tr>`;
  }).join('');

  const tvaBuckets = computeTvaBuckets(data.items);
  const tvaRows = tvaBuckets.length > 0
    ? tvaBuckets.map(b => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:left;">TVA ${b.rate}%</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:600;">${formatCurrency(b.montantTva)} DHS</td>
      </tr>`).join('')
    : `
      <tr>
        <td style="padding:4px 8px;border:1px solid #000;text-align:left;">TVA 0%</td>
        <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:600;">0,00 DHS</td>
      </tr>`;

  const amountInWords = numberToWordsCurrency(totalTTC);
  const echeance = data.echeance ? formatDate(data.echeance) : null;

  const clientLines = [
    `<strong>${entityLabel}:</strong> ${data.client.nom}`,
    data.client.adresse ? data.client.adresse : null,
    data.client.ville ? data.client.ville : null,
    data.client.telephone ? 'Tél: ' + data.client.telephone : null,
    data.client.email ? 'Email: ' + data.client.email : null,
    data.client.ice ? 'ICE: ' + data.client.ice : null,
  ].filter(Boolean).join('<br>');

  const itemCols = ['Référence', 'Désignation', 'Qté', 'PU HT', 'Montant HT'];

  const isFirstPage = true;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 15mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  body {
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
  }
  .items-table th {
    padding: 6px 8px;
    font-size: 12pt;
    font-weight: 700;
    color: #000;
    border-bottom: 1.5pt solid #000;
  }
  .items-table th.ref { width: 15%; text-align: left; }
  .items-table th.des { width: 45%; text-align: left; }
  .items-table th.qty { width: 10%; text-align: right; }
  .items-table th.pu { width: 15%; text-align: right; }
  .items-table th.mht { width: 15%; text-align: right; }
  .items-table td {
    font-size: 9pt;
    border-bottom: 0.5pt solid #E5E7EB;
  }
  .totals-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 10px;
  }
  .words-block {
    max-width: 50%;
    font-size: 9pt;
  }
  .words-block .label {
    font-weight: 700;
    margin: 0;
    font-size: 9pt;
  }
  .words-block .amount {
    font-weight: 700;
    margin: 4px 0 0;
    font-style: italic;
    font-size: 9pt;
  }
  .words-block .payment {
    margin: 6px 0 0;
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
  }
  .totals-table {
    border-collapse: collapse;
    width: 220px;
  }
  .totals-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    font-size: 9pt;
  }
  .totals-table .value-cell {
    text-align: right;
    font-weight: 600;
  }
  .totals-table .total-ttc td {
    font-weight: 700;
    font-size: 10pt;
  }
  .totals-table .total-ttc .value-cell {
    font-weight: 800;
  }
  .devis-extra {
    margin-top: 8px;
    padding: 6px 8px;
    font-size: 9pt;
    border: 1px solid #000;
    display: flex;
    gap: 24px;
  }
  .notes-section {
    margin-top: 6px;
    padding: 4px 6px;
    font-size: 8pt;
    color: #475569;
    border-top: 1px solid #000;
  }
  .signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dotted #000;
  }
  .signature-box {
    text-align: center;
    flex: 1;
  }
  .signature-line {
    width: 160px;
    height: 50px;
    border-bottom: 2px dashed #000;
    margin: 0 auto 4px;
  }
  .signature-label {
    font-size: 9pt;
  }
  .footer {
    margin-top: 8px;
    padding-top: 5px;
    border-top: 1px solid #000;
    text-align: center;
    font-size: 7pt;
    line-height: 1.5;
    color: #475569;
  }
  .footer .app-credit {
    font-size: 6pt;
    color: #94a3b8;
  }
</style>
</head>
<body>
<div class="page">
  <div class="watermark">${data.watermarkText || 'ParaGestion'}</div>

  <!-- HEADER -->
  <div class="header-section">
    <div class="brand-left">
      ${data.company.logo
        ? `<img src="${data.company.logo}" alt="Logo" style="width:120px;height:60px;object-fit:contain;display:block;margin-bottom:4px;" />`
        : `<div style="font-size:18pt;font-weight:700;color:#000;letter-spacing:1px;margin-bottom:4px;">${(data.company.nom || 'PARAGESTION').substring(0, 4).toUpperCase()}</div>`
      }
      <div>
        <div class="brand-name">${data.company.nom || 'ParaGestion'}</div>
        <div class="brand-sub">Solution de Gestion</div>
      </div>
    </div>
    <div class="title-right">
      <div class="doc-title">${title}</div>
      <div class="doc-ice">I.C.E: ${data.company.ice}</div>
    </div>
  </div>

  <!-- METADATA TABLE -->
  <table class="metadata-table">
    <thead>
      <tr>
        ${Object.values(config.labels).map(l => `<th>${l}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${data.numero}</td>
        <td>${formatDate(data.date)}</td>
        <td>${data.reference || '-'}</td>
        <td>${data.modePaiement || '-'}</td>
        <td>${echeance || '-'}</td>
        <td>${data.agent || '-'}</td>
      </tr>
    </tbody>
  </table>

  <!-- CLIENT BOX -->
  <div class="client-box">
    ${clientLines}
  </div>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="ref">Référence</th>
        <th class="des">Désignation</th>
        <th class="qty">Qté</th>
        <th class="pu">PU HT</th>
        <th class="mht">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- TOTALS + WORDS -->
  <div class="totals-wrapper">
    <div class="words-block">
      <p class="label">Arrêté le présent document à la somme de :</p>
      <p class="amount">${amountInWords} Dirhams DHS</p>
      ${data.modePaiement ? '<p class="payment">Mode de paiement: ' + data.modePaiement + '</p>' : ''}
    </div>
    <table class="totals-table">
      <tr>
        <td>Total HT</td>
        <td class="value-cell">${formatCurrency(totalHT)} DHS</td>
      </tr>
      ${tvaRows}
      <tr class="total-ttc">
        <td>Total TTC</td>
        <td class="value-cell">${formatCurrency(totalTTC)} DHS</td>
      </tr>
    </table>
  </div>

  <!-- DEVIS-SPECIFIC -->
  ${data.documentType === 'devis' && (data.echeance || data.conditionsPaiement) ? `
  <div class="devis-extra">
    ${data.echeance ? '<div><strong>Validité de l\'offre:</strong> ' + formatDate(data.echeance) + '</div>' : ''}
    ${data.conditionsPaiement ? '<div><strong>Conditions de règlement:</strong> ' + data.conditionsPaiement + '</div>' : ''}
  </div>
  ` : ''}

  <!-- NOTES -->
  ${data.notes ? `
  <div class="notes-section">
    <strong>Notes:</strong> ${data.notes}
  </div>
  ` : ''}

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Cachet et Signature du ${entityLabel}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Cachet et Signature de la Société</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    ${data.company.formeJuridique && data.company.capital ? data.company.formeJuridique + ' au Capital de ' + data.company.capital + ' — ' : ''}
    ${data.company.rc ? 'R.C: ' + data.company.rc + ' — ' : ''}
    ${data.company.if_number ? 'I.F: ' + data.company.if_number + ' — ' : ''}
    ${data.company.ice ? 'I.C.E: ' + data.company.ice : ''}
    <br>
    <span class="app-credit">Généré par ParaGestion</span>
  </div>
</div>
</body>
</html>`;
}

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function resolveLogo(data: DocumentData): Promise<string | undefined> {
  if (data.company.logo) {
    console.log('[PDF] Logo already provided in request data');
    return data.company.logo;
  }
  if (!data.userId) {
    console.log('[PDF] No userId provided, skipping logo fetch');
    return undefined;
  }
  try {
    const { data: row } = await supabase
      .from('parametres')
      .select('logo_url')
      .eq('user_id', data.userId)
      .maybeSingle();
    if (row?.logo_url) {
      console.log('[PDF] Logo URL retrieved from parametres');
      const base64 = await imageUrlToBase64(row.logo_url);
      if (base64) {
        console.log('[PDF] Logo converted to Base64 successfully');
        return base64;
      }
      console.warn('[PDF] Base64 conversion failed, falling back to raw URL');
      return null;
    }
    console.log('[PDF] No logo_url found in parametres');
  } catch (err) {
    console.error('[PDF] Error fetching logo:', err);
  }
  return undefined;
}

export async function generatePDF(data: DocumentData): Promise<Buffer> {
  const html = generateHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generatePDFController(req: any, res: any) {
  try {
    const data = req.body as DocumentData;

    if (!data.documentType || !data.items || !data.numero || !data.date) {
      return res.status(400).json({
        error: 'Champs requis manquants: documentType, items, numero, date',
      });
    }

    if (!DOCUMENT_CONFIG[data.documentType]) {
      return res.status(400).json({
        error: `Type de document invalide: ${data.documentType}. Types supportés: ${Object.keys(DOCUMENT_CONFIG).join(', ')}`,
      });
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return res.status(400).json({
        error: 'La liste des articles (items) est vide ou invalide',
      });
    }

    if (!data.client?.nom) {
      return res.status(400).json({ error: 'Le nom du client est requis' });
    }

    if (!data.company?.rc || !data.company?.if_number || !data.company?.ice) {
      return res.status(400).json({
        error: 'Informations société requises: rc, if_number, ice',
      });
    }

    data.company.logo = await resolveLogo(data);

    const pdfBuffer = await generatePDF(data);

    const config = DOCUMENT_CONFIG[data.documentType];
    const filename = `${config.title.replace(/\s+/g, '_')}_${data.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF',
      details: error.message,
    });
  }
}

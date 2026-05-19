import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { numberToFrenchWords } from '@/lib/numberToWords'

interface DevisDocumentProps {
  devis: any
  entreprise: any
  /** BCP-47 language tag from i18n.language */
  lang?: string
}

const fmt2 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const safeNum = (v: any, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const pickVal = (obj: any, ...keys: string[]) => {
  for (const k of keys) { const v = obj?.[k]; if (v !== null && v !== undefined) return v }
  return null
}

const pickNum = (obj: any, ...keys: string[]) => safeNum(pickVal(obj, ...keys))

const makeFmtDate = (lang?: string) => (d: any): string => {
  if (!d) return '-'
  try {
    let date: Date
    if (typeof d === 'string') {
      date = d.includes('T') || d.includes('-') ? parseISO(d) : new Date(d)
    } else if (d instanceof Date) {
      date = d
    } else {
      date = new Date(d)
    }
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: getDateLocale(lang) }) : '-'
  } catch {
    return '-'
  }
}

const makeFmtDateTime = (lang?: string) => (d: Date): string => {
  return format(d, 'dd/MM/yy HH:mm', { locale: getDateLocale(lang) })
}

export const DevisDocument = forwardRef<HTMLDivElement, DevisDocumentProps>(
  ({ devis, entreprise, lang }, ref) => {
    if (!devis) return null

    const fmtDate     = makeFmtDate(lang)
    const fmtDateTime = makeFmtDateTime(lang)

    const lignes = devis.lignes || []
    const totalHt = pickNum(devis, 'montantHt', 'montant_ht')
    const totalTva = pickNum(devis, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(devis, 'montantTtc', 'montant_ttc')
    const numero = devis.numero || '-'
    const dateEmission = fmtDate(pickVal(devis, 'dateEmission', 'date_emission'))
    const dateValidite = fmtDate(pickVal(devis, 'dateValidite', 'date_echeance', 'dateEcheance'))
    const modePaiement = (pickVal(devis, 'modePaiement', 'mode_paiement') as string) || ''
    const conditionsPaiement = devis.conditionsPaiement || ''
    const client = pickVal(devis, 'client', 'fournisseur') || {}
    const entityName = client?.nomSociete || client?.nom || '-'
    const now = new Date()

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

    const totalQte = lignes.reduce((s: number, l: any) => s + getQt(l), 0)
    const totalMtHt = lignes.reduce((s: number, l: any) => s + getMt(l), 0)

    return (
      <>
        <style>{`
          @page { margin: 0; size: A4; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
          }
          .devis-doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: #000;
            background: #fff;
            position: relative;
          }
          .devis-doc table { border-collapse: collapse; }
          .devis-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80pt;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.05);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: 12px;
            text-transform: uppercase;
            user-select: none;
          }
        `}</style>
        <div ref={ref} className="devis-doc">
          <div style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {entreprise?.activerFiligrane !== false && (
              <div className="devis-watermark">{entreprise?.watermarkText || 'OptiGestion'}</div>
            )}

            {/* ===== HEADER ===== */}
            <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              I.C.E : {entreprise?.ice || '-'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {entreprise?.logoUrl ? (
                  <img src={entreprise.logoUrl} alt="Logo" style={{ width: 120, height: 60, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ fontSize: '18pt', fontWeight: 700, color: '#000', letterSpacing: 1, flexShrink: 0 }}>
                    {(entreprise?.nomEntreprise || entreprise?.nom || 'OPTIGESTION').substring(0, 4).toUpperCase()}
                  </div>
                )}
                <div style={{ fontSize: '8pt', lineHeight: 1.5, color: '#475569' }}>
                  <div style={{ fontWeight: 700, fontSize: '10pt', color: '#000', marginBottom: 1 }}>
                    {entreprise?.nom || entreprise?.nomEntreprise || 'Nom de l\'entreprise'}
                  </div>
                  <div>{entreprise?.adresse || 'Adresse'}</div>
                  <div>{entreprise?.ville || 'Ville Code Postal'}</div>
                  <div>{entreprise?.telephone || 'Téléphone'}</div>
                  <div>{entreprise?.email || 'Email'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 900, fontSize: '22pt', color: '#000', lineHeight: 1 }}>Devis</span>
                <div style={{ fontSize: '9pt', color: '#64748b', fontWeight: 500, marginTop: 4 }}>
                  Edité le {fmtDateTime(now)}
                </div>
              </div>
            </div>

            {/* ===== 6-COLUMN METADATA TABLE ===== */}
            <table style={{ width: '100%', marginBottom: 12 }}>
              <thead>
                <tr>
                  {[
                    { label: 'Numéro', value: numero },
                    { label: 'Date', value: dateEmission },
                    { label: 'Référence', value: '-' },
                    { label: 'Mode de Règlement', value: modePaiement || '-' },
                    { label: 'Échéance', value: dateValidite },
                    { label: 'Agent', value: entityName },
                  ].map((m, i) => (
                    <th key={i} style={{
                      border: '1px solid #000',
                      padding: '5px 6px',
                      fontWeight: 600,
                      fontSize: '10pt',
                      textAlign: 'center',
                      background: '#fff',
                      color: '#000',
                    }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[
                    numero,
                    dateEmission,
                    '-',
                    modePaiement || '-',
                    dateValidite,
                    entityName,
                  ].map((v, i) => (
                    <td key={i} style={{
                      border: '1px solid #000',
                      padding: '5px 6px',
                      fontWeight: 400,
                      fontSize: '9pt',
                      textAlign: 'center',
                    }}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* ===== INTRO TEXT ===== */}
            <div style={{ fontSize: '9pt', marginBottom: 12, lineHeight: 1.5, fontStyle: 'italic', color: '#475569' }}>
              Cher Client, Nous avons bien reçu votre demande et nous vous remercions de la confiance que vous nous accordez.
              Veuillez trouver ci-dessous le détail de notre proposition.
            </div>

            {/* ===== ITEMS TABLE ===== */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <table style={{ width: '100%' }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '45%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'left', borderBottom: '1.5pt solid #000', color: '#000' }}>Référence</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'left', borderBottom: '1.5pt solid #000', color: '#000' }}>Désignation</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>Qté</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>PU HT</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>{ligne.reference || '—'}</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>{ligne.designation || '-'}</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(getQt(ligne))}</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(getPu(ligne))}</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(getMt(ligne))}</td>
                    </tr>
                  ))}
                  {/* A reporter sub-total row */}
                  {lignes.length > 0 && (
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB', textTransform: 'uppercase' }}>A reporter</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(totalQte)}</td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}></td>
                      <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', fontWeight: 700, borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(totalMtHt)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ flex: 1 }} />

              {/* ===== CLOSING TEXT ===== */}
              <div style={{
                marginTop: 10,
                padding: '8px',
                fontSize: '9pt',
                lineHeight: 1.5,
                border: '1px solid #000',
                color: '#475569',
              }}>
                <p style={{ margin: 0, fontStyle: 'italic' }}>
                  Nous sommes à votre disposition pour tout renseignement complémentaire et vous remercions de votre confiance.
                </p>
                {conditionsPaiement && (
                  <p style={{ margin: '6px 0 0' }}>
                    <strong>Conditions de règlement:</strong> {conditionsPaiement}
                  </p>
                )}
                {dateValidite !== '-' && (
                  <p style={{ margin: '2px 0 0' }}>
                    <strong>Validité de l'offre:</strong> {dateValidite}
                  </p>
                )}
              </div>

              {/* ===== TOTALS ===== */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <div style={{ border: '1px solid #000', fontSize: '9pt', minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #000' }}>
                    <span>Total HT</span>
                    <span style={{ fontWeight: 600 }}>{fmt2(totalHt)} DHS</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #000' }}>
                    <span>TVA</span>
                    <span style={{ fontWeight: 600 }}>{fmt2(totalTva)} DHS</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontWeight: 700, fontSize: '10pt' }}>
                    <span>Total TTC</span>
                    <span style={{ fontWeight: 800 }}>{fmt2(totalTtc)} DHS</span>
                  </div>
                </div>
              </div>

              {/* ===== SIGNATURES ===== */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 16,
                paddingTop: 8,
                borderTop: '1px dotted #000',
              }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '9pt' }}>Cachet et Signature du Client</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '9pt' }}>Cachet et Signature de la Société</div>
                </div>
              </div>

              {/* ===== LEGAL FOOTER ===== */}
              <div style={{
                marginTop: 8,
                paddingTop: 5,
                borderTop: '1px solid #000',
                textAlign: 'center',
                fontSize: '7pt',
                lineHeight: 1.5,
                color: '#475569',
              }}>
                {entreprise?.formeJuridique && entreprise?.capitalSocial && (
                  <span>{entreprise.formeJuridique} au Capital de {entreprise.capitalSocial} — </span>
                )}
                {entreprise?.rc && <span>R.C: {entreprise.rc} — </span>}
                {entreprise?.ifNumber && <span>I.F: {entreprise.ifNumber} — </span>}
                {entreprise?.ice && <span>I.C.E: {entreprise.ice}</span>}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }
)

DevisDocument.displayName = 'DevisDocument'

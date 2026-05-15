import { forwardRef, useMemo, type CSSProperties } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '@/lib/numberToWords'

type DocType = 'facture' | 'devis' | 'bon_commande' | 'bon_livraison'

interface DocumentPreviewProps {
  type: DocType
  data: any
  entreprise: any
}

const ITEMS_PER_PAGE = 22

const fmt2 = (n: number): string =>
  new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmt4 = (n: number): string =>
  new Intl.NumberFormat('fr-MA', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)

const safeNum = (v: any, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? fallback : n
}

const fmtDate = (d: any): string => {
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
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: fr }) : '-'
  } catch {
    return '-'
  }
}

const pickVal = (obj: any, ...keys: string[]) => {
  for (const k of keys) { const v = obj?.[k]; if (v !== null && v !== undefined) return v }
  return null
}

const pickNum = (obj: any, ...keys: string[]) => safeNum(pickVal(obj, ...keys))

const titles: Record<DocType, string> = {
  facture: 'FACTURE',
  devis: 'DEVIS',
  bon_commande: 'BON DE COMMANDE',
  bon_livraison: 'BON DE LIVRAISON',
}

const entityLabel: Record<DocType, string> = {
  facture: 'Client',
  devis: 'Client',
  bon_commande: 'Fournisseur',
  bon_livraison: 'Fournisseur',
}

interface TvaBucket {
  rate: number
  baseHt: number
  montantTva: number
}

function computeTvaBuckets(lignes: any[]): TvaBucket[] {
  const map = new Map<number, TvaBucket>()
  for (const l of lignes) {
    const qte = safeNum(l.quantite, 1)
    const pu = pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const mHt = pickNum(l, 'montantHt', 'montant_ht')
    const totalHt = mHt > 0 ? mHt : qte * pu
    const tvaRate = safeNum(l.tva, 20)
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

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ type, data, entreprise }, ref) => {
    if (!data) return null

    const docTitle = titles[type]
    const entityNameLabel = entityLabel[type]
    const lignes = data.lignes || []
    const totalHt = pickNum(data, 'montantHt', 'montant_ht')
    const totalTva = pickNum(data, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(data, 'montantTtc', 'montant_ttc')
    const modePaiement = (pickVal(data, 'modePaiement', 'mode_paiement') as string) || ''

    const entity = pickVal(data, 'client', 'fournisseur') || {}
    const entityName = entity?.nomSociete || entity?.nom || '-'
    const docDate = fmtDate(pickVal(data, 'dateEmission', 'dateCommande', 'date', 'dateLivraison'))

    const meta = [
      { label: 'Numéro', value: data.numero || '-' },
      { label: 'Date', value: docDate },
      { label: 'Référence', value: '-' },
      { label: 'Mode de Règlement', value: modePaiement || '-' },
      {
        label: 'Échéance',
        value: fmtDate(pickVal(data, 'dateEcheance', 'dateValidite', 'dateLivraisonPrevue', 'dateLivraison')),
      },
      { label: 'Agent', value: entityName },
    ]

    const dateValidite = fmtDate(pickVal(data, 'dateValidite', 'dateEcheance', 'dateLivraisonPrevue'))
    const conditionsPaiement = data.conditionsPaiement || ''

    const tvaBuckets = useMemo(() => computeTvaBuckets(lignes), [lignes])

    const pages = useMemo(() => {
      if (lignes.length === 0) return [{ items: [] as any[], isFirst: true, isLast: true, carryTotal: 0 }]
      const chunks: { items: any[]; isFirst: boolean; isLast: boolean; carryTotal: number }[] = []
      let idx = 0
      let carryTotal = 0
      while (idx < lignes.length) {
        const chunk = lignes.slice(idx, idx + ITEMS_PER_PAGE)
        const chunkTotal = chunk.reduce((s: number, l: any) => {
          const qte = safeNum(l.quantite, 1)
          const pu = pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
          const mHt = pickNum(l, 'montantHt', 'montant_ht')
          return s + (mHt > 0 ? mHt : qte * pu)
        }, 0)
        idx += ITEMS_PER_PAGE
        const isLast = idx >= lignes.length
        chunks.push({ items: chunk, isFirst: chunks.length === 0, isLast, carryTotal })
        carryTotal += chunkTotal
      }
      return chunks
    }, [lignes])

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

    return (
      <>
        <style>{`
          @page { margin: 0; size: A4; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            .page-split { page-break-after: always; }
          }
          .doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: #000;
            background: #fff;
            position: relative;
          }
          .doc table { border-collapse: collapse; }
          .watermark {
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
        <div ref={ref} className="doc">
          {pages.map((page, pIdx) => (
            <div
              key={pIdx}
              className={pIdx < pages.length - 1 ? 'page-split' : ''}
              style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '15mm',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* ===== WATERMARK ===== */}
              {entreprise?.activerFiligrane !== false && (
                <div className="watermark">{entreprise?.watermarkText || 'ParaGestion'}</div>
              )}

              {page.isFirst ? (
                <>
                  {/* ===== HEADER: Brand Left + Title Right ===== */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: type === 'bon_livraison' ? 16 : 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {entreprise?.logoUrl ? (
                          <img src={entreprise.logoUrl} alt="Logo" style={{ width: 120, height: 60, objectFit: 'contain', flexShrink: 0 }} />
                        ) : (
                          <div style={{ fontSize: '18pt', fontWeight: 700, color: '#000', letterSpacing: 1, flexShrink: 0 }}>
                            {(entreprise?.nomEntreprise || entreprise?.nom || 'PARAGESTION').substring(0, 4).toUpperCase()}
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
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '24pt', letterSpacing: '-0.5px', lineHeight: 1.1, color: '#000' }}>
                        {docTitle}
                      </div>
                      <div style={{ fontSize: '9pt', fontWeight: 600, color: '#374151', marginTop: 4 }}>
                        {type === 'bon_livraison' ? (
                          <>{data.numero || '-'} &mdash; {docDate}</>
                        ) : (
                          <>I.C.E: {entreprise?.ice || '-'}</>
                        )}
                      </div>
                    </div>
                  </div>

                  {type !== 'bon_livraison' && (
                  <table style={{ width: '100%', marginBottom: 12 }}>
                    <thead>
                      <tr>
                        {meta.map((m, i) => (
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
                        {meta.map((m, i) => (
                          <td key={i} style={{
                            border: '1px solid #000',
                            padding: '5px 6px',
                            fontWeight: 400,
                            fontSize: '9pt',
                            textAlign: 'center',
                          }}>{m.value}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  )}

                  {/* ===== CLIENT BOX (right side, 50% width) ===== */}
                  <div style={{
                    marginLeft: 'auto',
                    width: '50%',
                    border: '1px solid #000',
                    padding: '8px 10px',
                    marginBottom: 12,
                    fontSize: '9pt',
                    lineHeight: 1.6,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{entityNameLabel}: {entityName}</div>
                    {entity?.adresse && <div>{entity.adresse}</div>}
                    {entity?.ville && <div>{entity.ville}</div>}
                    {entity?.telephone && <div>Tél: {entity.telephone}</div>}
                    {entity?.email && <div>Email: {entity.email}</div>}
                    {entity?.ice && <div>ICE: {entity.ice}</div>}
                  </div>
                </>
              ) : (
                <>
                  {/* ===== CONTINUATION HEADER ===== */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: '2px solid #000',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '10pt', textTransform: 'uppercase' }}>
                      Report — {docTitle} {data.numero}
                    </div>
                    <div style={{ fontSize: '9pt', fontWeight: 600 }}>I.C.E: {entreprise?.ice || '-'}</div>
                  </div>
                </>
              )}

              {/* ===== ITEMS TABLE ===== */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%', padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'left', borderBottom: '1.5pt solid #000', color: '#000' }}>Référence</th>
                      <th style={{ width: '45%', padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'left', borderBottom: '1.5pt solid #000', color: '#000' }}>Désignation</th>
                      <th style={{ width: '10%', padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>Qté</th>
                      <th style={{ width: '15%', padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>PU HT</th>
                      <th style={{ width: '15%', padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>Montant HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((ligne: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>{ligne.reference || '—'}</td>
                        <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>{ligne.designation || '-'}</td>
                        <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(getQt(ligne))}</td>
                        <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt4(getPu(ligne))}</td>
                        <td style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt2(getMt(ligne))}</td>
                      </tr>
                    ))}
                    {page.items.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '5px 6px', fontSize: '9pt', textAlign: 'center', fontStyle: 'italic', color: '#374151' }}>Aucun article</td></tr>
                    )}
                  </tbody>
                </table>

                <div style={{ flex: 1 }} />

                {/* ===== CARRY OVER ===== */}
                {!page.isLast && pages.length > 1 && (
                  <div style={{ marginTop: 6, textAlign: 'right', fontSize: '9pt', borderTop: '1px dashed #000', paddingTop: 6 }}>
                    <strong>A reporter:</strong> {fmt2(page.carryTotal)} Dirhams DHS
                  </div>
                )}

                {/* ===== LAST PAGE: WORDS LEFT + TOTALS RIGHT ===== */}
                {page.isLast && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                    {/* Legal mention bottom left */}
                    <div style={{ maxWidth: '50%', fontSize: '9pt' }}>
                      <p style={{ fontWeight: 700, margin: 0, fontSize: '9pt' }}>
                        Arrêté le présent document à la somme de :
                      </p>
                      <p style={{ fontWeight: 700, margin: '4px 0 0', fontStyle: 'italic', fontSize: '9pt' }}>
                        {numberToFrenchWords(Math.abs(Number(totalTtc)))} Dirhams DHS
                      </p>
                      {modePaiement && (
                        <p style={{ margin: '6px 0 0', fontSize: '9pt', fontWeight: 600, color: '#374151' }}>
                          Mode de paiement: {modePaiement}
                        </p>
                      )}
                    </div>

                    {/* Totals block bottom right (2-column) */}
                    <div style={{ border: '1px solid #000', fontSize: '9pt', minWidth: 200 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #000' }}>
                        <span>Total HT</span>
                        <span style={{ fontWeight: 600 }}>{fmt2(totalHt)} DHS</span>
                      </div>
                      {tvaBuckets.map((bucket, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderBottom: i < tvaBuckets.length - 1 ? '1px solid #000' : 'none',
                        }}>
                          <span>TVA {bucket.rate}%</span>
                          <span style={{ fontWeight: 600 }}>{fmt2(bucket.montantTva)} DHS</span>
                        </div>
                      ))}
                      {tvaBuckets.length === 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #000' }}>
                          <span>TVA 0%</span>
                          <span style={{ fontWeight: 600 }}>0,00 DHS</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontWeight: 700, fontSize: '10pt' }}>
                        <span>Total TTC</span>
                        <span style={{ fontWeight: 800 }}>{fmt2(totalTtc)} DHS</span>
                      </div>
                    </div>
                  </div>
                )}

                {page.isLast && (
                  <>
                    {/* ===== DEVIS-SPECIFIC: Validité & Conditions ===== */}
                    {type === 'devis' && (dateValidite !== '-' || conditionsPaiement) && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 8px',
                        fontSize: '9pt',
                        border: '1px solid #000',
                        display: 'flex',
                        gap: 24,
                      }}>
                        {dateValidite !== '-' && (
                          <div><strong>Validité de l'offre:</strong> {dateValidite}</div>
                        )}
                        {conditionsPaiement && (
                          <div><strong>Conditions de règlement:</strong> {conditionsPaiement}</div>
                        )}
                      </div>
                    )}

                    {/* ===== NOTES ===== */}
                    {data.notes && (
                      <div style={{ marginTop: 6, padding: '4px 6px', fontSize: '8pt', color: '#475569', borderTop: '1px solid #000' }}>
                        <strong>Notes:</strong> {data.notes}
                      </div>
                    )}

                    {/* ===== SIGNATURES (dotted line separation) ===== */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: '1px dotted #000',
                    }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '9pt' }}>
                          Cachet et Signature du {entityNameLabel}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '9pt' }}>
                          Cachet et Signature de la Société
                        </div>
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
                      <br />
                      <span style={{ fontSize: '6pt', color: '#94a3b8' }}>Généré par ParaGestion</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }
)

DocumentPreview.displayName = 'DocumentPreview'

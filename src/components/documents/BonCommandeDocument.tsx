import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { numberToFrenchWords } from '@/lib/numberToWords'

interface BonCommandeDocumentProps {
  bon: any
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

export const BonCommandeDocument = forwardRef<HTMLDivElement, BonCommandeDocumentProps>(
  ({ bon, entreprise, lang }, ref) => {
    if (!bon) return null

    const fmtDate = makeFmtDate(lang)

    const lignes = bon.lignes || []
    const totalHt = pickNum(bon, 'montantHt', 'montant_ht')
    const totalTva = pickNum(bon, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(bon, 'montantTtc', 'montant_ttc')
    const dateEmission = fmtDate(pickVal(bon, 'dateEmission', 'dateCommande', 'date', 'date_emission'))
    const numero = bon.numero || '-'
    const isVerre = bon.type === 'verre'
    const entity = isVerre ? (bon.client || {}) : (bon.fournisseur || {})
    const entityName = entity?.nomSociete || entity?.nom || '-'

    const tvaBuckets = useMemo(() => computeTvaBuckets(lignes), [lignes])

    const getPu = (l: any) => pickNum(l, 'prixUnitaireHt', 'prix_unitaire_ht')
    const getQt = (l: any) => safeNum(l.quantite, 1)
    const getMt = (l: any) => { const m = pickNum(l, 'montantHt', 'montant_ht'); return m > 0 ? m : getPu(l) * getQt(l) }

    const amountWords = numberToFrenchWords(Math.abs(Number(totalTtc)))

    return (
      <>
        <style>{`
          @page { margin: 0; size: A4; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
          }
          .bc-doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: #000;
            background: #fff;
            position: relative;
          }
          .bc-doc table { border-collapse: collapse; }
          .bc-watermark {
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
        <div ref={ref} className="bc-doc">
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
              <div className="bc-watermark">{entreprise?.watermarkText || 'OptiGestion'}</div>
            )}

            {/* ===== HEADER: Logo + Company Info (left) | Title (right) ===== */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {entreprise?.logoUrl ? (
                  <img src={entreprise.logoUrl} alt="Logo" style={{ width: 120, height: 60, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ fontSize: '18pt', fontWeight: 700, color: '#000', letterSpacing: 1, flexShrink: 0 }}>
                    {(entreprise?.nomEntreprise || entreprise?.nom || 'OPTIGESTION').substring(0, 4).toUpperCase()}
                  </div>
                )}
                <div style={{ fontSize: '8pt', lineHeight: 1.5, color: '#374151' }}>
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
                <div style={{ fontWeight: 900, fontSize: '20pt', color: '#000', lineHeight: 1.1 }}>
                  {isVerre ? "BON DE COMMANDE DE VERRE" : "BON DE COMMANDE"}
                </div>
                <div style={{ fontSize: '9pt', fontWeight: 600, color: '#374151', marginTop: 4 }}>
                  N° {numero}
                </div>
              </div>
            </div>

            {/* ===== ENTITY INFO BOX + PRESCRIPTION SECTION ===== */}
            {isVerre && bon.prescription ? (
              <>
                {/* Prescription card — full details for the lab */}
                <div style={{
                  border: '2px solid #000',
                  padding: '12px 14px',
                  marginBottom: 12,
                  fontSize: '9pt',
                  lineHeight: 1.6,
                }}>
                  {/* Header: Client + Prescription reference */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '11pt', marginBottom: 2 }}>{entityName}</div>
                      {entity?.cine && <div>CINE: {entity.cine}</div>}
                      {entity?.couverture_sociale && <div>Couverture: {entity.couverture_sociale?.toUpperCase()} {entity.couverture_sociale_detail ? `(${entity.couverture_sociale_detail})` : ''}</div>}
                      {entity?.adresse && <div>{entity.adresse}</div>}
                      {entity?.telephone && <div>Tél: {entity.telephone}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>Ordonnance du {fmtDate(bon.prescription.date_ordonnance)}</div>
                      <div>Type: {bon.prescription.verre_type || 'Standard'}</div>
                      {bon.prescription.indice && <div>Indice: {bon.prescription.indice}</div>}
                    </div>
                  </div>

                  {/* Médecin traitant */}
                  {(bon.prescription.medecin_traitant_nom || bon.prescription.medecin_traitant_adresse) && (
                    <div style={{ marginBottom: 8, padding: '4px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000' }}>
                      <div style={{ fontWeight: 700, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: 1 }}>Médecin traitant</div>
                      {bon.prescription.medecin_traitant_nom && <div>Dr. {bon.prescription.medecin_traitant_nom}</div>}
                      {bon.prescription.medecin_traitant_adresse && <div>{bon.prescription.medecin_traitant_adresse}</div>}
                      {bon.prescription.medecin_traitant_telephone && <div>Tél: {bon.prescription.medecin_traitant_telephone}</div>}
                    </div>
                  )}

                  {/* OD / OG prescription grid */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1.5pt solid #000' }}></th>
                        <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1.5pt solid #000', fontWeight: 700 }} colSpan={4}>VL (Vision de Loin)</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1.5pt solid #000', fontWeight: 700 }} colSpan={4}>VP (Vision de Près)</th>
                      </tr>
                      <tr>
                        <th style={{ padding: '3px 6px', textAlign: 'left', borderBottom: '0.5pt solid #666' }}></th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Sph</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Cyl</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Axe</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Add</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Sph</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Cyl</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Axe</th>
                        <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '0.5pt solid #666', fontWeight: 700 }}>Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 700, padding: '5px 6px', borderBottom: '0.5pt solid #ccc', background: '#f9f9f9' }}>OD</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_sph_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_cyl_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_axe_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_add_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_sph_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_cyl_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_axe_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.od_add_vp ?? '-'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700, padding: '5px 6px', borderBottom: '0.5pt solid #ccc', background: '#f9f9f9' }}>OG</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_sph_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_cyl_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_axe_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_add_vl ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_sph_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_cyl_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_axe_vp ?? '-'}</td>
                        <td style={{ textAlign: 'center', padding: '5px 6px', borderBottom: '0.5pt solid #ccc', fontFamily: 'monospace', fontWeight: 600 }}>{bon.prescription.og_add_vp ?? '-'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* DP & Hauteurs */}
                  {(bon.prescription.dp_binoculaire || bon.prescription.dp_od || bon.prescription.dp_og || bon.prescription.hauteur_od || bon.prescription.hauteur_og) && (
                    <div style={{ display: 'flex', gap: 24, marginTop: 8, padding: '4px 6px', borderTop: '0.5pt solid #ccc' }}>
                      {bon.prescription.dp_binoculaire && <div><strong>DP:</strong> {bon.prescription.dp_binoculaire}</div>}
                      {bon.prescription.dp_od && <div><strong>DP OD:</strong> {bon.prescription.dp_od}</div>}
                      {bon.prescription.dp_og && <div><strong>DP OG:</strong> {bon.prescription.dp_og}</div>}
                      {bon.prescription.hauteur_od && <div><strong>Haut. OD:</strong> {bon.prescription.hauteur_od}</div>}
                      {bon.prescription.hauteur_og && <div><strong>Haut. OG:</strong> {bon.prescription.hauteur_og}</div>}
                    </div>
                  )}
                </div>

                {/* Pricing line for Verre */}
                <div style={{ marginBottom: 8, textAlign: 'right', fontSize: '9pt' }}>
                  {lignes.map((ligne: any, i: number) => (
                    <div key={i} style={{ display: 'inline-block', marginLeft: 16 }}>
                      <strong>{ligne.designation}</strong> — PU HT: {fmt2(getPu(ligne))} DHS × {getQt(ligne)}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                marginLeft: 'auto',
                width: '50%',
                border: '1px solid #000',
                padding: '8px 10px',
                marginBottom: 12,
                fontSize: '9pt',
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{entityName}</div>
                {entity?.adresse && <div>{entity.adresse}</div>}
                {entity?.telephone && <div>Tél: {entity.telephone}</div>}
                {entity?.email && <div>Email: {entity.email}</div>}
              </div>
            )}

            {/* ===== ITEMS TABLE (only for Simple) ===== */}
            {!isVerre && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '45%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '14%' }} />
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
                        <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>
                          {ligne.reference || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'left', borderBottom: '0.5pt solid #E5E7EB' }}>
                          {ligne.designation || '-'}
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>
                          {getQt(ligne)}
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>
                          {fmt2(getPu(ligne))}
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>
                          {fmt2(getMt(ligne))}
                        </td>
                      </tr>
                    ))}
                    {lignes.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'center', fontStyle: 'italic', color: '#374151' }}>
                          Aucun article
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* ===== FOOTER SECTION ===== */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {/* Amount in words */}
                    <div style={{ maxWidth: 280 }}>
                      <p style={{ fontWeight: 700, margin: 0, textTransform: 'uppercase', fontSize: '8pt' }}>
                        Arrêté le présent document à la somme de:
                      </p>
                      <p style={{ fontWeight: 700, margin: '4px 0 0', textTransform: 'uppercase', fontSize: '8pt', lineHeight: 1.3 }}>
                        {amountWords} DHS
                      </p>
                    </div>
                  </div>

                  <div>
                    {/* Totals Stack */}
                    <div style={{ border: '1px solid #000', fontSize: '9pt', minWidth: 170 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #000' }}>
                        <span>TOTAL HT</span>
                        <span style={{ fontWeight: 600 }}>{fmt2(totalHt)}</span>
                      </div>
                      {tvaBuckets.map((bucket, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 10px',
                          borderBottom: i < tvaBuckets.length - 1 ? '1px solid #000' : 'none',
                        }}>
                          <span>TVA {bucket.rate}%</span>
                          <span style={{ fontWeight: 600 }}>{fmt2(bucket.montantTva)}</span>
                        </div>
                      ))}
                      {tvaBuckets.length === 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #000' }}>
                          <span>TVA</span>
                          <span style={{ fontWeight: 600 }}>0,00</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 700, fontSize: '10pt' }}>
                        <span>TOTAL TTC</span>
                        <span style={{ fontWeight: 800 }}>{fmt2(totalTtc)}</span>
                      </div>
                    </div>

                    {/* Page number */}
                    <div style={{ textAlign: 'right', fontSize: '8pt', marginTop: 6, color: '#64748b' }}>
                      Page 1/1
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {bon.notes && (
                  <div style={{ marginTop: 4, padding: '3px 6px', fontSize: '8pt', color: '#475569', borderTop: '1px solid #ccc' }}>
                    <strong>Notes:</strong> {bon.notes}
                  </div>
                )}

                {/* ===== SIGNATURES ===== */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: '1px dotted #000',
                }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '9pt' }}>{isVerre ? 'Cachet et Signature du Client' : 'Cachet et Signature du Fournisseur'}</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ width: 160, height: 50, borderBottom: '2px dashed #000', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: '9pt' }}>Cachet et Signature de la Société</div>
                  </div>
                </div>

                {/* Legal footer */}
                <div style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '1px solid #000',
                  textAlign: 'center',
                  fontSize: '7pt',
                  lineHeight: 1.4,
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

BonCommandeDocument.displayName = 'BonCommandeDocument'

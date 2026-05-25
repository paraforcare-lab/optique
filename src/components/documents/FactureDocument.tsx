import { forwardRef, useMemo } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { getDateLocale } from '@/lib/utils'
import { numberToFrenchWords } from '@/lib/numberToWords'

interface FactureDocumentProps {
  facture: any
  entreprise: any
  lang?: string
}

const fmt2 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmt3 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

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
  rate: number; baseHt: number; montantTva: number
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

function fmtSph(v: any): string {
  if (v === null || v === undefined || v === '') return '/'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? '/' : n.toFixed(2)
}

function fmtCyl(v: any): string {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? '' : ` ${n.toFixed(2)}`
}

function fmtAxe(v: any): string {
  if (v === null || v === undefined || v === '') return ''
  return ` ${v}°`
}



function formatOeilVp(oeil: string, prefix: string, p: any): string {
  const sph = fmtSph(pickVal(p, `${prefix}_sph_vp`))
  const cyl = fmtCyl(pickVal(p, `${prefix}_cyl_vp`))
  const axe = fmtAxe(pickVal(p, `${prefix}_axe_vp`))
  return `${oeil} : (${sph}${cyl}${axe})`
}

const civilite = (client: any) => {
  if (client?.genre === 'femme') return 'Mme'
  if (client?.genre === 'homme') return 'Mr'
  return 'Mr / Mme'
}

function OptiqueDocument({ facture, entreprise, lang }: { facture: any; entreprise: any; lang?: string }) {
  const fmtDate = makeFmtDate(lang)
  const p = facture.prescription || {}
  const lignes = facture.lignes || []
  const montureLigne = lignes[0] || {}
  const verreLigne = lignes[1] || {}
  const totalTtc = pickNum(facture, 'montantTtc', 'montant_ttc')
  const amountWords = numberToFrenchWords(Math.abs(Number(totalTtc)))
  const client = facture.client || {}
  const el = entreprise || {}

  const odPrix = pickNum(verreLigne, 'prix_od_ht')
  const ogPrix = pickNum(verreLigne, 'prix_og_ht')
  const monturePrix = pickNum(montureLigne, 'prixUnitaireHt', 'prix_unitaire_ht')

  const formatSphCyl = (sph: any, cyl: any, axe: any): string => {
    const s = fmtSph(sph)
    const c = cyl ? ` ${fmtSph(cyl)}` : ''
    const a = axe ? ` \u00e0 ${axe}\u00b0` : ''
    return `${s}${c}${a}`
  }

  const isVl = p.type_vision !== 'vp'
  const isVp = p.type_vision === 'vp'
  const vlOd = formatSphCyl(p.od_sph_vl, p.od_cyl_vl, p.od_axe_vl)
  const vlOg = formatSphCyl(p.og_sph_vl, p.og_cyl_vl, p.og_axe_vl)
  const vpOd = formatSphCyl(isVp ? p.od_sph_vl : p.od_sph_vp, isVp ? p.od_cyl_vl : p.od_cyl_vp, isVp ? p.od_axe_vl : p.od_axe_vp)
  const vpOg = formatSphCyl(isVp ? p.og_sph_vl : p.og_sph_vl, isVp ? p.og_cyl_vl : p.og_cyl_vp, isVp ? p.og_axe_vl : p.og_axe_vp)

  return (
    <div style={{ width: '210mm', minHeight: '297mm', margin: 'auto', background: 'white', border: '1px solid #d1d5db', fontFamily: 'Arial, sans-serif', color: '#111827' }}>
      <style>{`
        @page { margin: 0; size: A4; }
        @media print { html, body { margin: 0 !important; padding: 0 !important; } }
      `}</style>

      <div style={{ padding: '12mm' }}>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          {el.logoUrl ? (
            <img src={el.logoUrl} alt="Logo" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 42, color: '#2563eb', lineHeight: 1 }}>&#x1F453;</div>
          )}
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, color: '#1e3a8a', marginTop: 5 }}>
            {(el.nomEntreprise || el.nom || 'OPTIGESTION').toUpperCase()}
          </div>
        </div>

        <div style={{ width: '100%', border: '1px solid #374151', display: 'flex', marginBottom: 18 }}>
          <div style={{ width: '50%', padding: 12, borderRight: '1px solid #374151', minHeight: 120 }}>
            {el.adresse && <p style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>{el.adresse}</p>}
            {el.ville && <p style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>{el.ville}</p>}
            {el.telephone && <p style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>GSM {el.telephone}</p>}
          </div>
          <div style={{ width: '50%', padding: 12, minHeight: 120 }}>
            <p style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}><strong>Facture N° :</strong> {facture.numero || '-'}</p>
            <br />
            <p style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}><strong>Meknès Le :</strong> {fmtDate(pickVal(facture, 'dateEmission', 'date_emission'))}</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 18, fontSize: 18 }}>
          <strong style={{ color: '#1e3a8a' }}>{civilite(client)} :</strong> {client.nom || '-'}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', border: '1px solid #374151', verticalAlign: 'top', padding: 12, fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 }}>Vision de loin</div>
                <p><strong>OD :</strong> {isVl && vlOd !== '/' ? `(${vlOd})` : '/'}</p>
                <p><strong>OG :</strong> {isVl && vlOg !== '/' ? `(${vlOg})` : '/'}</p>
              </td>
              <td style={{ width: '50%', border: '1px solid #374151', verticalAlign: 'top', padding: 12, fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 }}>Vision de Pr&egrave;s</div>
                <p><strong>OD :</strong> {isVp && vpOd !== '/' ? `(${vpOd})` : '/'}</p>
                <p><strong>OG :</strong> {isVp && vpOg !== '/' ? `(${vpOg})` : '/'}</p>
              </td>
            </tr>
            <tr>
              <td style={{ width: '50%', border: '1px solid #374151', verticalAlign: 'top', padding: 12, fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 }}>Fournitures</div>
                <p><strong>Monture :</strong> {montureLigne.monture_matiere || '-'}</p>
                <br />
                <p><strong>Verres :</strong></p>
                <p>{p.verre_type || '-'}</p>
                <p>{p.verre_indice || '-'}</p>
                <p>{p.verre_traitement || '-'}</p>
              </td>
              <td style={{ width: '50%', border: '1px solid #374151', verticalAlign: 'top', padding: 12, fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 }}>Prix</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span>Monture</span>
                  <span>{monturePrix > 0 ? `${fmt2(monturePrix)} MAD` : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span>Verre OD</span>
                  <span>{odPrix > 0 ? `${fmt2(odPrix)} MAD` : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span>Verre OG</span>
                  <span>{ogPrix > 0 ? `${fmt2(ogPrix)} MAD` : '-'}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ border: '1px solid #374151', borderTop: 'none', padding: 14, textAlign: 'right', fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
          <span style={{ color: '#1e3a8a' }}>TOTAL :</span> {fmt2(totalTtc)} MAD
        </div>

        <div style={{ border: '1px solid #374151', borderTop: 'none', padding: 16, minHeight: 90, lineHeight: 1.8, fontSize: 15 }}>
          <strong>Arr&ecirc;t&eacute;e la pr&eacute;sente facture &agrave; la somme de :</strong>
          <br /><br />
          {amountWords}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 15, color: '#374151', lineHeight: 1.8 }}>
          <p>
            {el.patente && <span>Patente : {el.patente} &mdash; </span>}
            {el.ifNumber && <span>IF : {el.ifNumber} &mdash; </span>}
            {el.ice && <span>ICE : {el.ice}</span>}
          </p>
          <div style={{ marginTop: 8, fontWeight: 'bold', letterSpacing: 1, color: '#111827' }}>
            INPE : {el.inpe || '835037688'}
          </div>
        </div>

      </div>
    </div>
  )
}

export const FactureDocument = forwardRef<HTMLDivElement, FactureDocumentProps>(
  ({ facture, entreprise, lang }, ref) => {
    if (!facture) return null

    if (facture.type === 'optique') {
      return <div ref={ref} style={{ background: '#f4f4f4', padding: 20 }}><OptiqueDocument facture={facture} entreprise={entreprise} lang={lang} /></div>
    }

    const fmtDate = makeFmtDate(lang)

    const lignes = facture.lignes || []
    const totalHt = pickNum(facture, 'montantHt', 'montant_ht')
    const totalTva = pickNum(facture, 'montantTva', 'montant_tva')
    const totalTtc = pickNum(facture, 'montantTtc', 'montant_ttc')
    const dateEmission = fmtDate(pickVal(facture, 'dateEmission', 'date_emission'))
    const numero = facture.numero || '-'
    const modePaiement = (pickVal(facture, 'modePaiement', 'mode_paiement') as string) || ''
    const client = pickVal(facture, 'client', 'fournisseur') || {}
    const entityName = client?.nomSociete || client?.nom || '-'

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
          .fw-doc {
            font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
            color: #000;
            background: #fff;
            position: relative;
          }
          .fw-doc table { border-collapse: collapse; }
          .fw-watermark {
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
        <div ref={ref} className="fw-doc">
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
              <div className="fw-watermark">{entreprise?.watermarkText || 'OptiGestion'}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
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
              <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: '20pt', color: '#000', lineHeight: 1.1 }}>
                    {facture?.isAvoir ? 'Avoir N°' : 'Facture'}
                  </div>
                <div style={{ fontSize: '9pt', fontWeight: 600, color: '#374151', marginTop: 4 }}>
                  {numero}, le {dateEmission}
                </div>
              </div>
            </div>

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
              {client?.adresse && <div>{client.adresse}</div>}
              {client?.telephone && <div>Tél: {client.telephone}</div>}
              {client?.email && <div>Email: {client.email}</div>}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 24,
              fontSize: '9pt',
              marginBottom: 16,
              padding: '4px 0',
              borderTop: '1px solid #000',
              borderBottom: '1px solid #000',
            }}>
              {modePaiement && <span><strong>cheque-fs N°</strong> {modePaiement}</span>}
              <span><strong>Trsf</strong></span>
            </div>

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
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>Quantité</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>PU.HT</th>
                    <th style={{ padding: '6px 8px', fontSize: '12pt', fontWeight: 700, textAlign: 'right', borderBottom: '1.5pt solid #000', color: '#000' }}>MT HT</th>
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
                        {fmt3(getPu(ligne))}
                      </td>
                      <td style={{ padding: '5px 8px', fontSize: '9pt', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>
                        {fmt3(getMt(ligne))}
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

              <div style={{ flex: 1 }} />

              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <table style={{ borderCollapse: 'collapse', fontSize: '9pt' }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: '1.5pt solid #000', padding: '4px 10px', fontWeight: 700, textAlign: 'center', color: '#000' }}>BASE HT</th>
                          <th style={{ borderBottom: '1.5pt solid #000', padding: '4px 10px', fontWeight: 700, textAlign: 'center', color: '#000' }}>TVA%</th>
                          <th style={{ borderBottom: '1.5pt solid #000', padding: '4px 10px', fontWeight: 700, textAlign: 'center', color: '#000' }}>MONTANT TVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tvaBuckets.length > 0 ? tvaBuckets.map((b, i) => (
                          <tr key={i}>
                            <td style={{ padding: '3px 10px', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt3(b.baseHt)}</td>
                            <td style={{ padding: '3px 10px', textAlign: 'center', borderBottom: '0.5pt solid #E5E7EB' }}>{b.rate}%</td>
                            <td style={{ padding: '3px 10px', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>{fmt3(b.montantTva)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td style={{ padding: '3px 10px', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>0,000</td>
                            <td style={{ padding: '3px 10px', textAlign: 'center', borderBottom: '0.5pt solid #E5E7EB' }}>0%</td>
                            <td style={{ padding: '3px 10px', textAlign: 'right', borderBottom: '0.5pt solid #E5E7EB' }}>0,000</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div style={{ marginTop: 10, maxWidth: 280 }}>
                      <p style={{ fontWeight: 700, margin: 0, textTransform: 'uppercase', fontSize: '8pt' }}>
                        Arrêté le présent document à la somme de:
                      </p>
                      <p style={{ fontWeight: 700, margin: '4px 0 0', textTransform: 'uppercase', fontSize: '8pt', lineHeight: 1.3 }}>
                        {amountWords} DHS
                      </p>
                    </div>
                  </div>

                  <div>
                    <div style={{ border: '1px solid #000', fontSize: '9pt', minWidth: 170 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #000' }}>
                        <span>TOTAL HT</span>
                        <span style={{ fontWeight: 600 }}>{fmt3(totalHt)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #000' }}>
                        <span>TOTAL TVA</span>
                        <span style={{ fontWeight: 600 }}>{fmt3(totalTva)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 700, fontSize: '10pt' }}>
                        <span>TOTAL TTC</span>
                        <span style={{ fontWeight: 800 }}>{fmt3(totalTtc)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '8pt', marginTop: 6, color: '#64748b' }}>
                      Page 1/1
                    </div>
                  </div>
                </div>

                {facture.notes && (
                  <div style={{ marginTop: 4, padding: '3px 6px', fontSize: '8pt', color: '#475569', borderTop: '1px solid #ccc' }}>
                    <strong>Notes:</strong> {facture.notes}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 12,
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
        </div>
      </>
    )
  }
)

FactureDocument.displayName = 'FactureDocument'

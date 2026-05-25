import { supabase } from '@/lib/supabase'

type DocumentFormat = 'yearly' | 'daily'

interface NumberConfig {
  table: string
  prefix: string
  format: DocumentFormat
  numColumn?: string
  userIdColumn?: string
}

const CONFIGS: Record<string, NumberConfig> = {
  facture:           { table: 'factures',           prefix: 'FAC', format: 'yearly' },
  devis:             { table: 'devis',               prefix: 'DEV', format: 'yearly' },
  vente_passager:    { table: 'ventes_passagers',    prefix: 'VP',  format: 'daily' },
  avoir:             { table: 'avoirs',              prefix: 'AVR', format: 'yearly' },
  bon_livraison:     { table: 'bons_livraison',      prefix: 'BL',  format: 'yearly' },
  bon_commande:      { table: 'bons_commande',       prefix: 'BCV', format: 'yearly' },
  bon_commande_verre:{ table: 'bons_commande',       prefix: 'BCV', format: 'yearly' },
  depense:           { table: 'depenses',            prefix: 'DEP', format: 'yearly' },
}

export async function generateDocumentNumber(
  documentType: keyof typeof CONFIGS,
  userId: string,
): Promise<string> {
  const cfg = CONFIGS[documentType]
  if (!cfg) throw new Error(`Unknown document type: ${documentType}`)

  const now = new Date()
  const year = now.getFullYear()

  let pattern: string
  if (cfg.format === 'daily') {
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    pattern = `${cfg.prefix}-${year}${mm}${dd}-`
  } else {
    pattern = `${cfg.prefix}-${year}-`
  }

  const col = cfg.numColumn || 'numero'
  const userIdCol = cfg.userIdColumn || 'user_id'

  const { data } = await supabase
    .from(cfg.table)
    .select(col)
    .eq(userIdCol, userId)
    .like(col, `${pattern}%`)
    .order(col, { ascending: false })
    .limit(1)

  let nextNum = 1
  if (data && data.length > 0 && data[0][col]) {
    const parts = (data[0][col] as string).split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) {
      nextNum = lastSeq + 1
    }
  }

  const pad = cfg.format === 'daily' ? 3 : 4
  const seq = String(nextNum).padStart(pad, '0')
  return `${pattern}${seq}`
}

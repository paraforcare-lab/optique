import { supabase } from './supabase'

const recentCreateCache = new Set<string>()

export async function ensureLowStockNotifications(
  userId: string | undefined,
  produitIds?: (number | string)[]
) {
  if (!userId) return

  try {
    let query = supabase
      .from('produits')
      .select('id, designation, nom, stock_actuel, stock_min')
      .eq('user_id', userId)

    if (produitIds && produitIds.length > 0) {
      query = query.in('id', produitIds)
    }

    const { data: produits } = await query

    if (!produits || produits.length === 0) return

    const toInsert: any[] = []

    for (const p of produits) {
      const threshold = Math.max(Number(p.stock_min) || 0, 5)
      if (Number(p.stock_actuel) <= threshold) {
        const designation = p.designation || p.nom || 'Produit'
        const cacheKey = `${userId}:${p.id}`
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        if (recentCreateCache.has(cacheKey)) continue

        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('title', 'Stock Faible')
          .ilike('message', `${designation} - %`)
          .gte('created_at', twentyFourHoursAgo)
          .limit(1)

        if (!existing || existing.length === 0) {
          toInsert.push({
            user_id: userId,
            title: 'Stock Faible',
            message: `${designation} - ${p.stock_actuel} unités restantes`,
            type: 'warning',
            is_read: false,
            link: `/produits?id=${p.id}`,
            created_at: new Date().toISOString()
          })
          recentCreateCache.add(cacheKey)
        }
      }
    }

    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert)
    }
  } catch (err) {
    console.error('Error ensuring low stock notifications:', err)
  }
}

export async function updateStockAndNotify(
  userId: string | undefined,
  produitId: number | string,
  delta: number,
  opts?: { sourceDocumentType?: string; sourceDocumentRef?: string }
) {
  if (!userId || !produitId) return

  try {
    await fetch('/api/stock-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produitId: Number(produitId),
        delta,
        userId,
        sourceDocumentType: opts?.sourceDocumentType || 'ajustement',
        sourceDocumentRef: opts?.sourceDocumentRef || null,
      }),
    })
  } catch (e) {
    console.error('[updateStockAndNotify] API error:', e)
  }
}

export async function updateStockAndNotifySafe(
  userId: string | undefined,
  produitId: number | string,
  delta: number,
  opts?: { sourceDocumentType?: string; sourceDocumentRef?: string }
) {
  if (!userId || !produitId) return

  try {
    await fetch('/api/stock-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produitId: Number(produitId),
        delta,
        userId,
        sourceDocumentType: opts?.sourceDocumentType || 'ajustement',
        sourceDocumentRef: opts?.sourceDocumentRef || null,
        clampToZero: true,
      }),
    })
  } catch (e) {
    console.error('[updateStockAndNotifySafe] API error:', e)
  }
}

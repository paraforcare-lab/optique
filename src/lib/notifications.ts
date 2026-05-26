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
  delta: number
) {
  if (!userId || !produitId) return

  const { data: produit } = await supabase
    .from('produits')
    .select('stock_actuel, designation, nom, stock_min')
    .eq('id', produitId)
    .single()

  if (!produit) return

  const currentStock = Number(produit.stock_actuel || 0)
  const newStock = currentStock + delta

  if (newStock < 0) {
    console.warn(`Stock insuffisant pour le produit ${produitId}. Stock actuel: ${currentStock}, tentative de réduction: ${Math.abs(delta)}`)
    return
  }

  await supabase
    .from('produits')
    .update({ stock_actuel: newStock })
    .eq('id', produitId)

  const designation = produit.designation || produit.nom || 'Produit'
  const threshold = Math.max(Number(produit.stock_min) || 0, 5)

  if (delta < 0 && newStock <= threshold) {
    const cacheKey = `${userId}:${produitId}`
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    if (recentCreateCache.has(cacheKey)) return

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('title', 'Stock Faible')
      .ilike('message', `${designation} - %`)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('notifications').insert([{
        user_id: userId,
        title: 'Stock Faible',
        message: `${designation} - ${newStock} unités restantes`,
        type: 'warning',
        is_read: false,
        link: `/produits?id=${produitId}`,
        created_at: new Date().toISOString()
      }])
      recentCreateCache.add(cacheKey)
    }
  }
}

export async function updateStockAndNotifySafe(
  userId: string | undefined,
  produitId: number | string,
  delta: number
) {
  if (!userId || !produitId) return

  const { data: produit } = await supabase
    .from('produits')
    .select('stock_actuel, designation, nom, stock_min')
    .eq('id', produitId)
    .single()

  if (!produit) return

  const currentStock = Number(produit.stock_actuel || 0)
  const newStock = Math.max(0, currentStock + delta)

  if (newStock !== currentStock + delta) {
    console.warn(`Stock clôturé à 0 pour le produit ${produitId} lors de l'ajustement de ${delta} (stock actuel: ${currentStock})`)
  }

  await supabase
    .from('produits')
    .update({ stock_actuel: newStock })
    .eq('id', produitId)

  const designation = produit.designation || produit.nom || 'Produit'
  const threshold = Math.max(Number(produit.stock_min) || 0, 5)

  if (delta < 0 && newStock <= threshold) {
    const cacheKey = `${userId}:${produitId}`
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    if (recentCreateCache.has(cacheKey)) return

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('title', 'Stock Faible')
      .ilike('message', `${designation} - %`)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('notifications').insert([{
        user_id: userId,
        title: 'Stock Faible',
        message: `${designation} - ${newStock} unités restantes`,
        type: 'warning',
        is_read: false,
        link: `/produits?id=${produitId}`,
        created_at: new Date().toISOString()
      }])
      recentCreateCache.add(cacheKey)
    }
  }
}

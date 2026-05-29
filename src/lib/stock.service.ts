import { supabaseAdmin } from './supabase.server'

export type MovementType = 'achat' | 'vente' | 'ajustement' | 'annulation' | 'initial'
export type SourceDocumentType = 'bon_commande' | 'facture' | 'vente_passager' | 'bon_livraison' | 'ajustement_manuel'

export interface StockMovementInput {
  produit_id: number
  quantite: number
  type: MovementType
  source_document_type: SourceDocumentType
  source_document_id?: number
  source_document_ref?: string
  notes?: string
  entite_nom?: string
  prix_unitaire?: number
  user_id?: string
}

export interface ProcessStockMovementResult {
  success: boolean
  ancien_stock: number
  nouveau_stock: number
  mouvement_id?: number
  error?: string
}

const doubleMovementCache = new Set<string>()

const makeMovementKey = (input: StockMovementInput): string => {
  return `${input.source_document_type}:${input.source_document_id || input.source_document_ref}:${input.produit_id}:${input.type}`
}

const checkExistingMovement = async (input: StockMovementInput): Promise<boolean> => {
  const cacheKey = makeMovementKey(input)
  if (doubleMovementCache.has(cacheKey)) return true

  if (input.source_document_id) {
    const { data: existing } = await supabaseAdmin
      .from('stock_history')
      .select('id')
      .eq('produit_id', input.produit_id)
      .eq('source_document_type', input.source_document_type)
      .eq('source_document_id', input.source_document_id)
      .eq('type', input.type)
      .limit(1)

    if (existing && existing.length > 0) {
      doubleMovementCache.add(cacheKey)
      return true
    }
  }

  return false
}

export const processStockMovement = async (
  input: StockMovementInput
): Promise<ProcessStockMovementResult> => {
  try {
    if (input.source_document_id) {
      const alreadyExists = await checkExistingMovement(input)
      if (alreadyExists) {
        return {
          success: false,
          ancien_stock: 0,
          nouveau_stock: 0,
          error: `Double mouvement détecté: ${input.type} déjà enregistré pour ${input.source_document_type}#${input.source_document_id} sur le produit ${input.produit_id}`
        }
      }
    }

    const { data: produit, error: fetchError } = await supabaseAdmin
      .from('produits')
      .select('stock_actuel, stock_min, designation, nom, user_id')
      .eq('id', input.produit_id)
      .single()

    if (fetchError || !produit) {
      return {
        success: false,
        ancien_stock: 0,
        nouveau_stock: 0,
        error: `Produit introuvable: ${input.produit_id}`
      }
    }

    const ancienStock = Number(produit.stock_actuel || 0)
    let nouveauStock = ancienStock + input.quantite
    let clamped = false
    let mouvementId: number | undefined

    if (input.type === 'vente' && input.quantite < 0 && nouveauStock < 0) {
      return {
        success: false,
        ancien_stock: ancienStock,
        nouveau_stock: ancienStock,
        error: `Stock insuffisant pour le produit ${input.produit_id}. Stock actuel: ${ancienStock}, requis: ${Math.abs(input.quantite)}`
      }
    }

    if (nouveauStock < 0) {
      nouveauStock = Math.max(0, nouveauStock)
      clamped = true
    }

    const { error: updateError } = await supabaseAdmin
      .from('produits')
      .update({ stock_actuel: nouveauStock })
      .eq('id', input.produit_id)

    if (updateError) {
      return {
        success: false,
        ancien_stock: ancienStock,
        nouveau_stock: ancienStock,
        error: `Erreur mise à jour stock: ${updateError.message}`
      }
    }

    try {
      const historyRecord = {
        produit_id: input.produit_id,
        quantite: input.quantite,
        type: input.type,
        source_document_type: input.source_document_type,
        source_document_id: input.source_document_id || null,
        source_document_ref: input.source_document_ref || null,
        ancien_stock: ancienStock,
        nouveau_stock: nouveauStock,
        entite_nom: input.entite_nom || null,
        prix_unitaire: input.prix_unitaire || 0,
        notes: clamped
          ? `${input.notes || ''} (Stock clôturé à 0 - ajustement forcé)`
          : (input.notes || ''),
        user_id: input.user_id || produit.user_id || null
      }

      const { data: history, error: historyError } = await supabaseAdmin
        .from('stock_history')
        .insert([historyRecord])
        .select()
        .single()

      if (!historyError && history) {
        mouvementId = history.id
      } else if (historyError) {
        console.warn(`Stock history non enregistré: ${historyError.message}`)
      }
    } catch (histErr) {
      console.warn(`Stock history table non disponible:`, histErr)
    }

    if (input.source_document_id) {
      doubleMovementCache.add(makeMovementKey(input))
    }

    if (input.quantite < 0 && nouveauStock <= Number(produit.stock_min) && Number(produit.stock_min) > 0 && produit.user_id) {
      try {
        const designation = produit.designation || produit.nom || 'Produit'
        const { data: recentNotifs } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('user_id', produit.user_id)
          .eq('title', 'Stock Faible')
          .ilike('message', `${designation} - %`)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)

        if (!recentNotifs || recentNotifs.length === 0) {
          await supabaseAdmin.from('notifications').insert([{
            user_id: produit.user_id,
            title: 'Stock Faible',
            message: `${designation} - ${nouveauStock} unités restantes`,
            type: 'warning',
            is_read: false,
            link: '/produits'
          }])
        }
      } catch (err) {
        console.error('Erreur notification stock faible:', err)
      }
    }

    if (!clamped) {
      const { data: existing } = await supabaseAdmin
        .from('mouvements_stock')
        .select('id')
        .eq('produit_id', input.produit_id)
        .eq('reference_document', input.source_document_ref || '')
        .eq('type', input.type)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabaseAdmin.from('mouvements_stock').insert([{
          produit_id: input.produit_id,
          type: input.type,
          quantite: input.quantite,
          notes: input.notes || '',
          reference_document: input.source_document_ref,
          entite_nom: input.entite_nom,
          prix_unitaire: input.prix_unitaire || 0,
          date_mouvement: new Date()
        }])
      }
    }

    return {
      success: true,
      ancien_stock: ancienStock,
      nouveau_stock: nouveauStock,
      mouvement_id: mouvementId
    }
  } catch (error: any) {
    return {
      success: false,
      ancien_stock: 0,
      nouveau_stock: 0,
      error: `Erreur inattendue: ${error.message}`
    }
  }
}

export const processPurchaseOrderStock = async (
  bonCommandeId: number,
  statut: string,
  ancienStatut?: string | null
): Promise<{ success: boolean; errors: string[] }> => {
  const errors: string[] = []
  const isLivré = statut === 'livré' || statut === 'livrée'
  const wasLivré = ancienStatut === 'livré' || ancienStatut === 'livrée'

  if (isLivré === wasLivré) return { success: true, errors }

  const { data: bon } = await supabaseAdmin
    .from('bons_commande')
    .select('*, fournisseur:fournisseurs(nom)')
    .eq('id', bonCommandeId)
    .single()

  if (!bon) return { success: false, errors: ['Bon de commande introuvable'] }

  const { data: lignes } = await supabaseAdmin
    .from('bon_commande_lignes')
    .select('*')
    .eq('bon_commande_id', bonCommandeId)

  if (!lignes || lignes.length === 0) return { success: true, errors }

  const delta = isLivré ? 1 : -1

  for (const l of lignes) {
    if (!l.produit_id) continue

    const result = await processStockMovement({
      produit_id: l.produit_id,
      quantite: delta * Number(l.quantite || 0),
      type: isLivré ? 'achat' : 'annulation',
      source_document_type: 'bon_commande',
      source_document_id: bonCommandeId,
      source_document_ref: bon.numero,
      notes: isLivré
        ? `Réception Bon de Commande ${bon.numero}`
        : `Annulation réception Bon de Commande ${bon.numero}`,
      entite_nom: bon.fournisseur?.nom,
      prix_unitaire: l.prix_unitaire_ht
    })

    if (!result.success) {
      errors.push(`Produit ${l.produit_id}: ${result.error}`)
    }
  }

  return { success: errors.length === 0, errors }
}

export const processInvoiceStock = async (
  factureId: number,
  statut: string,
  ancienStatut?: string | null
): Promise<{ success: boolean; errors: string[] }> => {
  const errors: string[] = []
  const isSale = statut === 'payée' || statut === 'payér' || statut === 'reste_a_payer'
  const wasSale = ancienStatut === 'payée' || ancienStatut === 'payér' || ancienStatut === 'reste_a_payer'
  const isCancelled = statut === 'annulée' || statut === 'annulÃ©e'

  const { data: facture } = await supabaseAdmin
    .from('factures')
    .select('*, client:clients(nom)')
    .eq('id', factureId)
    .single()

  if (!facture) return { success: false, errors: ['Facture introuvable'] }

  const { data: lignes } = await supabaseAdmin
    .from('facture_lignes')
    .select('*')
    .eq('facture_id', factureId)

  if (!lignes || lignes.length === 0) return { success: true, errors }

  if (isSale && !wasSale && !isCancelled) {
    // Passage to sale status: decrease stock
    for (const l of lignes) {
      if (!l.produit_id) continue
      const result = await processStockMovement({
        produit_id: l.produit_id,
        quantite: -Number(l.quantite || 0),
        type: 'vente',
        source_document_type: 'facture',
        source_document_id: factureId,
        source_document_ref: facture.numero,
        notes: `Vente Facture ${facture.numero}`,
        entite_nom: facture.client?.nom,
        prix_unitaire: l.prix_unitaire_ht
      })
      if (!result.success) errors.push(`Produit ${l.produit_id}: ${result.error}`)
    }
  } else if (!isSale && !isCancelled && wasSale) {
    // Passage from sale to non-sale non-cancelled status: restore stock
    for (const l of lignes) {
      if (!l.produit_id) continue
      const result = await processStockMovement({
        produit_id: l.produit_id,
        quantite: Number(l.quantite || 0),
        type: 'annulation',
        source_document_type: 'facture',
        source_document_id: factureId,
        source_document_ref: facture.numero,
        notes: `Annulation vente Facture ${facture.numero}`,
        entite_nom: facture.client?.nom,
        prix_unitaire: l.prix_unitaire_ht
      })
      if (!result.success) errors.push(`Produit ${l.produit_id}: ${result.error}`)
    }
  } else if (isCancelled && wasSale) {
    // Cancellation: restore stock
    for (const l of lignes) {
      if (!l.produit_id) continue
      const result = await processStockMovement({
        produit_id: l.produit_id,
        quantite: Number(l.quantite || 0),
        type: 'annulation',
        source_document_type: 'facture',
        source_document_id: factureId,
        source_document_ref: facture.numero,
        notes: `Annulation Facture ${facture.numero}`,
        entite_nom: facture.client?.nom,
        prix_unitaire: l.prix_unitaire_ht
      })
      if (!result.success) errors.push(`Produit ${l.produit_id}: ${result.error}`)
    }
  }

  return { success: errors.length === 0, errors }
}

export const processVentePassagerStock = async (
  vpId: number,
  isDeletion: boolean = false
): Promise<{ success: boolean; errors: string[] }> => {
  const errors: string[] = []

  const { data: vp } = await supabaseAdmin
    .from('ventes_passagers')
    .select('numero')
    .eq('id', vpId)
    .single()

  if (!vp) return { success: false, errors: ['Vente passager introuvable'] }

  const { data: lignes } = await supabaseAdmin
    .from('ventes_passagers_lignes')
    .select('*')
    .eq('vp_id', vpId)

  if (!lignes || lignes.length === 0) return { success: true, errors }

  const delta = isDeletion ? 1 : -1
  const type: MovementType = isDeletion ? 'annulation' : 'vente'
  const notes = isDeletion
    ? `Annulation Vente Passager ${vp.numero}`
    : `Vente Passager ${vp.numero}`

  for (const l of lignes) {
    if (!l.produit_id) continue
    const result = await processStockMovement({
      produit_id: l.produit_id,
      quantite: delta * Number(l.quantite || 0),
      type,
      source_document_type: 'vente_passager',
      source_document_id: vpId,
      source_document_ref: vp.numero,
      notes,
      entite_nom: 'Passager',
      prix_unitaire: l.prix_unitaire_ht
    })
    if (!result.success) errors.push(`Produit ${l.produit_id}: ${result.error}`)
  }

  return { success: errors.length === 0, errors }
}

export const getStockHistory = async (
  produitId?: number,
  limit: number = 100,
  offset: number = 0
) => {
  let query = supabaseAdmin
    .from('stock_history')
    .select('*, produit:produits(id, designation, nom, reference)')
    .order('created_at', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1)

  if (produitId) {
    query = query.eq('produit_id', produitId)
  }

  const { data, error } = await query
  return { data, error }
}

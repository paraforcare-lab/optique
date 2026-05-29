-- Stock History Table for centralized stock tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS stock_history (
  id BIGSERIAL PRIMARY KEY,
  produit_id BIGINT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  quantite DECIMAL(15,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  source_document_type TEXT NOT NULL,
  source_document_id BIGINT,
  source_document_ref TEXT,
  ancien_stock DECIMAL(15,2) NOT NULL DEFAULT 0,
  nouveau_stock DECIMAL(15,2) NOT NULL DEFAULT 0,
  entite_nom TEXT,
  prix_unitaire DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_history DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stock_history_produit_id ON stock_history(produit_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_source ON stock_history(source_document_type, source_document_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at DESC);

-- Add missing statut values to factures for 'payér' variant
-- (uncomment if needed)
-- ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
-- ALTER TABLE factures ADD CONSTRAINT factures_statut_check
--   CHECK (statut IN ('brouillon', 'payée', 'payér', 'reste_a_payer', 'annulée', 'annulÃ©e', 'en_attente'));

-- Stock Management Migration: Status Constraints & Data Integrity
-- Run this in Supabase SQL Editor after MIGRATION_STOCK_HISTORY.sql

-- 1. Relax statut check constraints to support both encoded (Ã©) and proper (é) French chars
DO $$
BEGIN
  -- factures
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'factures_statut_check' AND table_name = 'factures'
  ) THEN
    ALTER TABLE factures DROP CONSTRAINT factures_statut_check;
  END IF;
  ALTER TABLE factures ADD CONSTRAINT factures_statut_check
    CHECK (statut IN ('brouillon', 'payée', 'payér', 'reste_a_payer', 'annulée', 'annulÃ©e', 'en_attente'));

  -- bons_commande
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bons_commande_statut_check' AND table_name = 'bons_commande'
  ) THEN
    ALTER TABLE bons_commande DROP CONSTRAINT bons_commande_statut_check;
  END IF;
  ALTER TABLE bons_commande ADD CONSTRAINT bons_commande_statut_check
    CHECK (statut IN ('brouillon', 'en_attente', 'confirmé', 'confirmÃ©', 'livré', 'livrée', 'annulé', 'annulÃ©'));

  -- bons_livraison
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bons_livraison_statut_check' AND table_name = 'bons_livraison'
  ) THEN
    ALTER TABLE bons_livraison DROP CONSTRAINT bons_livraison_statut_check;
  END IF;
  ALTER TABLE bons_livraison ADD CONSTRAINT bons_livraison_statut_check
    CHECK (statut IN ('brouillon', 'en_attente', 'livré', 'livrée', 'reçu', 'reÃ§u'));
END $$;

-- 2. Add stock_updated column to bons_commande if not exists (for tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bons_commande' AND column_name = 'stock_updated'
  ) THEN
    ALTER TABLE bons_commande ADD COLUMN stock_updated BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Ensure all products have a valid stock_actuel (non-negative)
UPDATE produits SET stock_actuel = GREATEST(COALESCE(stock_actuel, 0), 0)
WHERE stock_actuel IS NULL OR stock_actuel < 0;

-- 4. Index for stock lookups
CREATE INDEX IF NOT EXISTS idx_produits_stock_alerte ON produits(stock_actuel, stock_min)
  WHERE stock_min > 0 AND stock_actuel <= stock_min;

-- 5. Add user_id column to mouvements_stock if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mouvements_stock' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE mouvements_stock ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

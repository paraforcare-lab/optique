-- ================================================================
-- MIGRATION PARAOPTICA v1.0 — Moroccan Optician ERP
-- Ajoute les champs optique et les nouvelles tables nécessaires
-- ================================================================

-- 1. PRODUITS : Ajouter des colonnes optique
ALTER TABLE produits ADD COLUMN IF NOT EXISTS type_produit TEXT DEFAULT 'monture'
  CHECK (type_produit IN ('monture', 'verre', 'lentille', 'solution', 'accessoire'));

-- Montures
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_taille TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_couleur TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_matiere TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_forme TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_genre TEXT CHECK (monture_genre IN ('homme', 'femme', 'enfant', 'mixte'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_largeur_nb DECIMAL(5,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_hauteur_nb DECIMAL(5,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_ponte_nb DECIMAL(5,1);

-- Verres
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_type TEXT
  CHECK (verre_type IN ('unifocal', 'bifocal', 'progressif', 'travail'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_indice DECIMAL(4,2);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_traitement TEXT;  -- anti-reflet, anti-lumiere-bleue, photochromique, polarisant
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_couleur TEXT;

-- Lentilles
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_type TEXT
  CHECK (lentille_type IN ('journaliere', 'bimensuelle', 'mensuelle', 'trimestrielle', 'annuelle'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_courbe_base DECIMAL(4,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_diametre DECIMAL(4,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_marque TEXT;

-- Solutions
ALTER TABLE produits ADD COLUMN IF NOT EXISTS solution_volume_ml INTEGER;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS solution_type TEXT
  CHECK (solution_type IN ('multifonction', 'peroxyde', 'saline', 'nettoyant'));

-- Traçabilité
ALTER TABLE produits ADD COLUMN IF NOT EXISTS fournisseur_ref TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS emplacement TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS date_peremption DATE;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lot TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS garantie_mois INTEGER DEFAULT 24;

-- ================================================================
-- 2. TABLE PRESCRIPTIONS (ordonnances)
-- ================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    date_ordonnance DATE DEFAULT CURRENT_DATE,
    date_expiration DATE,
    opticien_nom TEXT,
    opticien_adresse TEXT,
    opticien_telephone TEXT,
    notes TEXT,

    -- OD = Oeil Droit, OG = Oeil Gauche

    -- Vision de loin (VL)
    od_sph_vl DECIMAL(5,2),
    od_cyl_vl DECIMAL(5,2),
    od_axe_vl INTEGER,
    od_add_vl DECIMAL(5,2),
    og_sph_vl DECIMAL(5,2),
    og_cyl_vl DECIMAL(5,2),
    og_axe_vl INTEGER,
    og_add_vl DECIMAL(5,2),

    -- Vision de près (VP)
    od_sph_vp DECIMAL(5,2),
    od_cyl_vp DECIMAL(5,2),
    od_axe_vp INTEGER,
    od_add_vp DECIMAL(5,2),
    og_sph_vp DECIMAL(5,2),
    og_cyl_vp DECIMAL(5,2),
    og_axe_vp INTEGER,
    og_add_vp DECIMAL(5,2),

    -- Distance pupillaire
    dp_binoculaire DECIMAL(5,1),
    dp_od DECIMAL(5,1),
    dp_og DECIMAL(5,1),

    -- Hauteur monture
    hauteur_od DECIMAL(5,1),
    hauteur_og DECIMAL(5,1),

    -- Type de verre prescrit
    verre_type TEXT,
    verre_indice DECIMAL(4,2),
    verre_traitement TEXT,

    -- Statut
    statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'expiree', 'remplacee')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_client ON prescriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions (user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 3. CLIENTS : Ajouter champs assurance et médicaux
-- ================================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type_client TEXT DEFAULT 'particulier'
  CHECK (type_client IN ('particulier', 'entreprise', 'mutuelle', 'cnops', 'cnss'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assurance_nom TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assurance_numero TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnops_matricule TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnss_numero TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mutuelle_nom TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mutuelle_numero TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS medecin_traitant TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS medecin_telephone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS medecin_adresse TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS genre TEXT CHECK (genre IN ('homme', 'femme'));

-- ================================================================
-- 4. FACTURES : Ajouter champs optique / CNOPS
-- ================================================================
ALTER TABLE factures ADD COLUMN IF NOT EXISTS prescription_id BIGINT REFERENCES prescriptions(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS type_prise_en_charge TEXT
  CHECK (type_prise_en_charge IN ('particulier', 'cnops', 'cnss', 'mutuelle', 'mixte'));
ALTER TABLE factures ADD COLUMN IF NOT EXISTS numero_bon_prise_en_charge TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS droit_timbre DECIMAL(15,2) DEFAULT 0;

-- ================================================================
-- 5. FACTURE_LIGNES : Ajouter champs optique
-- ================================================================
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS prescription_id BIGINT REFERENCES prescriptions(id);
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS od_og TEXT CHECK (od_og IN ('OD', 'OG', 'OD+OG'));

-- ================================================================
-- 6. PARAMÈTRES : Ajouter champs optique / maroc
-- ================================================================
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS type_etablissement TEXT DEFAULT 'opticien'
  CHECK (type_etablissement IN ('opticien', 'pharmacie', 'optique_pharmacie'));
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS numero_ordre_opticien TEXT;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS licence TEXT;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS cnops_conventionne BOOLEAN DEFAULT FALSE;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS cnss_conventionne BOOLEAN DEFAULT FALSE;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS tva_default DECIMAL(5,2) DEFAULT 20;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_cnops DECIMAL(5,2) DEFAULT 80;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_cnss DECIMAL(5,2) DEFAULT 70;

-- ================================================================
-- 7. INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_produits_type ON produits (type_produit);
CREATE INDEX IF NOT EXISTS idx_produits_marque ON produits (marque);
CREATE INDEX IF NOT EXISTS idx_produits_date_peremption ON produits (date_peremption);

-- ================================================================
-- 8. SEED : Catégories optique dans les paramètres de catégorie
-- ================================================================
-- Note: La colonne 'categorie' du table produits peut déjà contenir des valeurs.
-- Les catégories optiques recommandées :
--   Montures : 'monture', 'monture_enfant', 'monture_soleil'
--   Verres : 'verre_unifocal', 'verre_progressif', 'verre_bifocal', 'verre_travail'
--   Lentilles : 'lentille_journaliere', 'lentille_mensuelle', 'lentille_annuelle'
--   Solutions : 'solution_multifonction', 'solution_peroxyde', 'solution_saline'
--   Accessoires : 'accessoire', 'étui', 'chiffon', 'gourmette'

-- Fin de la migration

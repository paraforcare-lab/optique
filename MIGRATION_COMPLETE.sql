-- ================================================================
-- MIGRATION COMPLETE — All missing tables, columns & fixes
-- Execute this entire script in Supabase SQL Editor (in order)
-- ================================================================

-- ================================================================
-- 1. FIX: stock_mouvements -> mouvements_stock (disable RLS on correct table)
-- ================================================================
ALTER TABLE IF EXISTS stock_mouvements DISABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. ADD user_id to mouvements_stock (missing column)
-- ================================================================
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_user ON mouvements_stock (user_id);

-- ================================================================
-- 3. CREATE tasks table (MISSING — used by Workspace.tsx & api.ts)
-- ================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);

-- ================================================================
-- 4. PRESCRIPTIONS — Full schema (if table doesn't exist yet)
-- ================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    date_ordonnance DATE DEFAULT CURRENT_DATE,
    date_expiration DATE,
    type_prescription TEXT CHECK (type_prescription IN ('premiere', 'renouvellement', 'remplacement')),
    opticien_nom TEXT,
    opticien_adresse TEXT,
    opticien_telephone TEXT,
    notes TEXT,

    -- Réfraction VL
    od_sph_vl DECIMAL(5,2), od_cyl_vl DECIMAL(5,2), od_axe_vl INTEGER, od_add_vl DECIMAL(5,2),
    og_sph_vl DECIMAL(5,2), og_cyl_vl DECIMAL(5,2), og_axe_vl INTEGER, og_add_vl DECIMAL(5,2),

    -- Réfraction VP
    od_sph_vp DECIMAL(5,2), od_cyl_vp DECIMAL(5,2), od_axe_vp INTEGER, od_add_vp DECIMAL(5,2),
    og_sph_vp DECIMAL(5,2), og_cyl_vp DECIMAL(5,2), og_axe_vp INTEGER, og_add_vp DECIMAL(5,2),

    -- Distances pupillaires & hauteurs
    dp_binoculaire DECIMAL(5,1), dp_od DECIMAL(5,1), dp_og DECIMAL(5,1),
    hauteur_od DECIMAL(5,1), hauteur_og DECIMAL(5,1),

    -- Prismes OD
    od_prisme_horizontal DECIMAL(5,2), od_prisme_vertical DECIMAL(5,2),
    od_prisme_base TEXT CHECK (od_prisme_base IN ('nasal','temporal','superieur','inferieur','nasal_superieur','nasal_inferieur','temporal_superieur','temporal_inferieur')),
    -- Prismes OG
    og_prisme_horizontal DECIMAL(5,2), og_prisme_vertical DECIMAL(5,2),
    og_prisme_base TEXT CHECK (og_prisme_base IN ('nasal','temporal','superieur','inferieur','nasal_superieur','nasal_inferieur','temporal_superieur','temporal_inferieur')),

    -- Acuité visuelle
    od_av_vl DECIMAL(4,2), og_av_vl DECIMAL(4,2),
    od_av_vp DECIMAL(4,2), og_av_vp DECIMAL(4,2),
    od_av_nature TEXT CHECK (od_av_nature IN ('cc','sc')),
    og_av_nature TEXT CHECK (og_av_nature IN ('cc','sc')),

    -- Paramètres de montage
    distance_vertex DECIMAL(4,1),
    inclinaison_pantoscopique DECIMAL(4,1),
    angle_courbe_faciale DECIMAL(4,1),

    -- Verre prescrit
    verre_type TEXT, verre_indice DECIMAL(4,2), verre_traitement TEXT,

    -- Scan ordonnance
    scanned_url TEXT,

    statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'expiree', 'remplacee')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_client ON prescriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_statut ON prescriptions (statut);

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 5. ORDRES DE TRAVAIL — Full schema
-- ================================================================
CREATE TABLE IF NOT EXISTS ordres_travail (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    prescription_id BIGINT REFERENCES prescriptions(id) ON DELETE SET NULL,
    numero_ordre TEXT NOT NULL,
    date_creation DATE DEFAULT CURRENT_DATE,
    date_souhaitee DATE,
    date_envoi_labo DATE,
    date_reception_labo DATE,
    date_montage DATE,
    date_controle DATE,
    date_remise DATE,
    statut TEXT DEFAULT 'brouillon'
      CHECK (statut IN ('brouillon', 'envoye_labo', 'reçu_labo', 'montage', 'controle', 'termine', 'annule')),
    produit_monture_id BIGINT REFERENCES produits(id) ON DELETE SET NULL,
    monture_reference TEXT,
    monture_designation TEXT,
    produit_verre_id BIGINT REFERENCES produits(id) ON DELETE SET NULL,
    verre_type TEXT,
    verre_indice DECIMAL(4,2),
    verre_traitement TEXT,
    verre_couleur TEXT,
    verre_designation TEXT,
    instructions_labo TEXT,
    type_detourage TEXT,
    centrage_notes TEXT,
    biseau_type TEXT,
    labo_nom TEXT,
    labo_contact TEXT,
    labo_prix DECIMAL(15,2) DEFAULT 0,
    prix_vente_ht DECIMAL(15,2) DEFAULT 0,
    taux_tva DECIMAL(5,2) DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordres_travail_client ON ordres_travail (client_id);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_user ON ordres_travail (user_id);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_statut ON ordres_travail (statut);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_date ON ordres_travail (date_creation);

DROP TRIGGER IF EXISTS update_ordres_travail_updated_at ON ordres_travail;
CREATE TRIGGER update_ordres_travail_updated_at
    BEFORE UPDATE ON ordres_travail
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 6. RENDEZ-VOUS — Full schema
-- ================================================================
CREATE TABLE IF NOT EXISTS rendez_vous (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    prescription_id BIGINT REFERENCES prescriptions(id) ON DELETE SET NULL,
    ordre_travail_id BIGINT REFERENCES ordres_travail(id) ON DELETE SET NULL,
    date_rdv DATE NOT NULL,
    heure_rdv TIME NOT NULL,
    duree_minutes INTEGER DEFAULT 30,
    type_rdv TEXT NOT NULL
      CHECK (type_rdv IN ('examen_vue', 'essayage', 'livraison', 'reparation', 'reglage', 'rappel_periodique', 'autre')),
    statut TEXT DEFAULT 'planifie'
      CHECK (statut IN ('planifie', 'confirme', 'effectue', 'annule', 'reporte')),
    notes TEXT,
    rappel_sms BOOLEAN DEFAULT FALSE,
    rappel_email BOOLEAN DEFAULT FALSE,
    rappel_envoye BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rdv_client ON rendez_vous (client_id);
CREATE INDEX IF NOT EXISTS idx_rdv_user ON rendez_vous (user_id);
CREATE INDEX IF NOT EXISTS idx_rdv_date ON rendez_vous (date_rdv);

DROP TRIGGER IF EXISTS update_rendez_vous_updated_at ON rendez_vous;
CREATE TRIGGER update_rendez_vous_updated_at
    BEFORE UPDATE ON rendez_vous
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 7. NGAP CODES
-- ================================================================
CREATE TABLE IF NOT EXISTS ngap_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    tarif_tnr DECIMAL(15,2),
    taux_remboursement_cnops DECIMAL(5,2),
    taux_remboursement_cnss DECIMAL(5,2),
    categorie TEXT CHECK (categorie IN ('consultation', 'optique', 'lentille', 'acte', 'autre')),
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ngap_codes (code, libelle, tarif_tnr, taux_remboursement_cnops, taux_remboursement_cnss, categorie) VALUES
  ('FQ', 'Monture de lunettes (forfait)', 200, 80, 70, 'optique'),
  ('FV', 'Verre simple foyer', 150, 80, 70, 'optique'),
  ('FV-MF', 'Verre multifocal/progressif', 300, 80, 70, 'optique'),
  ('LENT', 'Lentille de contact par œil', 250, 80, 70, 'lentille'),
  ('CS', 'Consultation spécialiste', 150, 80, 70, 'consultation'),
  ('CG', 'Consultation généraliste', 80, 80, 70, 'consultation'),
  ('REF', 'Réfraction (examen de vue)', 100, 80, 70, 'acte')
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- 8. AYANTS DROIT
-- ================================================================
CREATE TABLE IF NOT EXISTS ayants_droit (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    date_naissance DATE,
    lien_parente TEXT CHECK (lien_parente IN ('conjoint', 'enfant', 'parent', 'autre')),
    cnops_matricule TEXT,
    cnss_numero TEXT,
    mutuelle_numero TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ayants_droit_client ON ayants_droit (client_id);

-- ================================================================
-- 9. PRODUITS — Add optical columns if missing
-- ================================================================
ALTER TABLE produits ADD COLUMN IF NOT EXISTS type_produit TEXT DEFAULT 'monture'
  CHECK (type_produit IN ('monture', 'verre', 'lentille', 'solution', 'accessoire'));

-- Update type_produit constraint: remove lentille, solution, accessoire; add autre
ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_type_produit_check;
ALTER TABLE produits ADD CONSTRAINT produits_type_produit_check
  CHECK (type_produit IN ('monture', 'verre', 'autre'));

ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_taille TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_couleur TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_matiere TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_forme TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_genre TEXT CHECK (monture_genre IN ('homme', 'femme', 'enfant', 'mixte'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_largeur_nb DECIMAL(5,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_hauteur_nb DECIMAL(5,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS monture_ponte_nb DECIMAL(5,1);

ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_type TEXT
  CHECK (verre_type IN ('unifocal', 'bifocal', 'progressif', 'travail'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_indice DECIMAL(4,2);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_traitement TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS verre_couleur TEXT;

ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_type TEXT
  CHECK (lentille_type IN ('journaliere', 'bimensuelle', 'mensuelle', 'trimestrielle', 'annuelle'));
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_courbe_base DECIMAL(4,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_diametre DECIMAL(4,1);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lentille_marque TEXT;

ALTER TABLE produits ADD COLUMN IF NOT EXISTS solution_volume_ml INTEGER;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS solution_type TEXT
  CHECK (solution_type IN ('multifonction', 'peroxyde', 'saline', 'nettoyant'));

ALTER TABLE produits ADD COLUMN IF NOT EXISTS fournisseur_ref TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS emplacement TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS date_peremption DATE;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS lot TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS garantie_mois INTEGER DEFAULT 24;

-- ================================================================
-- 10. CLIENTS — Add insurance & medical columns if missing
-- ================================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS type_client TEXT;
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
ALTER TABLE clients ADD COLUMN IF NOT EXISTS genre TEXT;

-- ================================================================
-- 11. FACTURES — Add optical billing columns if missing
-- ================================================================
ALTER TABLE factures ADD COLUMN IF NOT EXISTS prescription_id BIGINT REFERENCES prescriptions(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS ordre_travail_id BIGINT REFERENCES ordres_travail(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS type_prise_en_charge TEXT
  CHECK (type_prise_en_charge IN ('particulier', 'cnops', 'cnss', 'mutuelle', 'mixte'));
ALTER TABLE factures ADD COLUMN IF NOT EXISTS numero_bon_prise_en_charge TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS droit_timbre DECIMAL(15,2) DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS ngap_code_id BIGINT REFERENCES ngap_codes(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_base_remboursement DECIMAL(15,2) DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS taux_remboursement DECIMAL(5,2) DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_rembourse DECIMAL(15,2) DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reste_a_charge_client DECIMAL(15,2) DEFAULT 0;

-- ================================================================
-- 12. PARAMETRES — Add optical settings if missing
-- ================================================================
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS ngap_defaut_id BIGINT REFERENCES ngap_codes(id);
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_tva_verre DECIMAL(5,2) DEFAULT 20;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_tva_monture DECIMAL(5,2) DEFAULT 20;

-- ================================================================
-- 13. INDEXES SUPPLÉMENTAIRES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_factures_prise_en_charge ON factures (type_prise_en_charge);
CREATE INDEX IF NOT EXISTS idx_factures_prescription ON factures (prescription_id);

-- ================================================================
-- 14. PRESCRIPTIONS — Add médecin traitant columns
-- ================================================================
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medecin_traitant_nom TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medecin_traitant_specialite TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medecin_traitant_telephone TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medecin_traitant_email TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medecin_traitant_adresse TEXT;

-- ================================================================
-- 15. BONS COMMANDE — Add type, client_id, prescription_id for Verre Commande
-- ================================================================
ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple'
  CHECK (type IN ('simple', 'verre'));
ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_bons_commande_type ON bons_commande (type);
CREATE INDEX IF NOT EXISTS idx_bons_commande_client ON bons_commande (client_id);

ALTER TABLE bon_commande_lignes ADD COLUMN IF NOT EXISTS prescription_id BIGINT REFERENCES prescriptions(id);
CREATE INDEX IF NOT EXISTS idx_bon_commande_lignes_prescription ON bon_commande_lignes (prescription_id);

-- ================================================================
-- 16. FACTURE LIGNES — Add prescription_id and OD/OG pricing for verre
-- ================================================================
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS prescription_id BIGINT REFERENCES prescriptions(id);
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS prix_od_ht DECIMAL(15,2);
ALTER TABLE facture_lignes ADD COLUMN IF NOT EXISTS prix_og_ht DECIMAL(15,2);

-- ================================================================
-- 17. RELOAD SCHEMA
-- ================================================================
NOTIFY pgrst, 'reload schema';

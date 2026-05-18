-- ================================================================
-- MIGRATION PARAOPTICA V2 — Optician ERP Complete Schema
-- Ajoute: ordres de travail (labo), rendez-vous, prescriptions améliorées,
-- codes NGAP/prise en charge, ayants droit clients
-- ================================================================

-- 1. PRESCRIPTIONS : Ajouter prismes, acuité visuelle, paramètres montage
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS type_prescription TEXT
  CHECK (type_prescription IN ('premiere', 'renouvellement', 'remplacement'));

-- Prismes OD
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_prisme_horizontal DECIMAL(5,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_prisme_vertical DECIMAL(5,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_prisme_base TEXT
  CHECK (od_prisme_base IN ('nasal', 'temporal', 'superieur', 'inferieur', 'nasal_superieur', 'nasal_inferieur', 'temporal_superieur', 'temporal_inferieur'));

-- Prismes OG
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_prisme_horizontal DECIMAL(5,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_prisme_vertical DECIMAL(5,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_prisme_base TEXT
  CHECK (og_prisme_base IN ('nasal', 'temporal', 'superieur', 'inferieur', 'nasal_superieur', 'nasal_inferieur', 'temporal_superieur', 'temporal_inferieur'));

-- Acuité visuelle
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_av_vl DECIMAL(4,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_av_vl DECIMAL(4,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_av_vp DECIMAL(4,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_av_vp DECIMAL(4,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS od_av_nature TEXT CHECK (od_av_nature IN ('cc', 'sc'));
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS og_av_nature TEXT CHECK (og_av_nature IN ('cc', 'sc'));

-- Paramètres de montage
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS distance_vertex DECIMAL(4,1);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS inclinaison_pantoscopique DECIMAL(4,1);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS angle_courbe_faciale DECIMAL(4,1);

-- Scanner l'ordonnance
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS scanned_url TEXT;

-- ================================================================
-- 2. TABLE ORDRES DE TRAVAIL (LABO/ATELIER)
-- ================================================================
CREATE TABLE IF NOT EXISTS ordres_travail (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
    prescription_id BIGINT REFERENCES prescriptions(id) ON DELETE SET NULL,

    -- Référence
    numero_ordre TEXT NOT NULL,
    date_creation DATE DEFAULT CURRENT_DATE,
    date_souhaitee DATE,
    date_envoi_labo DATE,
    date_reception_labo DATE,
    date_montage DATE,
    date_controle DATE,
    date_remise DATE,

    -- Statut workflow
    statut TEXT DEFAULT 'brouillon'
      CHECK (statut IN ('brouillon', 'envoye_labo', 'reçu_labo', 'montage', 'controle', 'termine', 'annule')),

    -- Produits liés
    produit_monture_id BIGINT REFERENCES produits(id) ON DELETE SET NULL,
    monture_reference TEXT,
    monture_designation TEXT,

    -- L'un ou l'autre pour les verres (produit stocké OU description libre)
    produit_verre_id BIGINT REFERENCES produits(id) ON DELETE SET NULL,
    verre_type TEXT,
    verre_indice DECIMAL(4,2),
    verre_traitement TEXT,
    verre_couleur TEXT,
    verre_designation TEXT,

    -- Instructions pour le laboratoire
    instructions_labo TEXT,
    type_detourage TEXT,  -- manuel, automatique
    centrage_notes TEXT,
    biseau_type TEXT,     -- standard, mince, plastique

    -- Fournisseur / laboratoire
    labo_nom TEXT,
    labo_contact TEXT,
    labo_prix DECIMAL(15,2) DEFAULT 0,

    -- Prix de vente
    prix_vente_ht DECIMAL(15,2) DEFAULT 0,
    taux_tva DECIMAL(5,2) DEFAULT 20,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordres_travail_client ON ordres_travail (client_id);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_user ON ordres_travail (user_id);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_statut ON ordres_travail (statut);
CREATE INDEX IF NOT EXISTS idx_ordres_travail_date_creation ON ordres_travail (date_creation);

DROP TRIGGER IF EXISTS update_ordres_travail_updated_at ON ordres_travail;
CREATE TRIGGER update_ordres_travail_updated_at
    BEFORE UPDATE ON ordres_travail
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 3. TABLE RENDEZ-VOUS
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
-- 4. TABLE CODES NGAP (NOMENCLATURE MAROCAINE)
-- ================================================================
CREATE TABLE IF NOT EXISTS ngap_codes (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    libelle TEXT NOT NULL,
    tarif_tnr DECIMAL(15,2),              -- Tarif National de Référence
    taux_remboursement_cnops DECIMAL(5,2), -- Taux CNOPS (%)
    taux_remboursement_cnss DECIMAL(5,2),  -- Taux CNSS (%)
    categorie TEXT CHECK (categorie IN ('consultation', 'optique', 'lentille', 'acte', 'autre')),
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NGAP optique Maroc (exemples à adapter)
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
-- 5. CLIENTS : Ajouter ayants droit
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
-- 6. FACTURES : Ajouter champs optique marocains
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
-- 7. PARAMÈTRES OPTIQUE (complément V1)
-- ================================================================
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS ngap_defaut_id BIGINT REFERENCES ngap_codes(id);
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_tva_verre DECIMAL(5,2) DEFAULT 20;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS taux_tva_monture DECIMAL(5,2) DEFAULT 20;

-- ================================================================
-- 8. INDEXES SUPPLÉMENTAIRES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_factures_prise_en_charge ON factures (type_prise_en_charge);
CREATE INDEX IF NOT EXISTS idx_factures_prescription ON factures (prescription_id);

-- ================================================================
-- Fin de la migration V2
-- ================================================================

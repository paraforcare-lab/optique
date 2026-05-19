import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FileEdit, Trash2, FileText, Download, CheckCircle,
  Clock, AlertCircle, Ban, Receipt, DollarSign, ArrowLeft,
  ArrowUpRight, ChevronLeft, ChevronRight, Send, CalendarDays, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCurrency, formatCurrencyLocale, formatDate } from '@/lib/utils'
import { FactureForm } from '@/components/forms/FactureForm'
import { FactureDocument } from '@/components/documents/FactureDocument'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import { useReactToPrint } from 'react-to-print'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'

interface Facture {
  id: number;
  numero: string;
  client: { nom: string; nomSociete?: string; email?: string };
  clientId?: number;
  dateEmission: string;
  dateEcheance?: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
  resteAPayer: number;
  modePaiement?: string;
  lignes?: any[];
}

interface StatutOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const ITEMS_PER_PAGE = 10;

export function FacturesList() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [factureToDelete, setFactureToDelete] = useState<number | null>(null);

  const [printingFacture, setPrintingFacture] = useState<any>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const statusOptions: StatutOption[] = [
    { value: 'brouillon', label: t('shared.status.draft'), icon: FileText, color: 'text-sky-700', bgColor: 'dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20 bg-sky-50 text-sky-700 border border-sky-200/50' },
    { value: 'en_attente', label: t('shared.status.pending'), icon: Clock, color: 'text-rose-700', bgColor: 'dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 bg-rose-50 text-rose-700 border border-rose-200/50' },
    { value: 'reste_a_payer', label: t('shared.status.partial'), icon: AlertCircle, color: 'text-orange-700', bgColor: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 bg-orange-50 text-orange-700 border border-orange-200/50' },
    { value: 'payée', label: t('shared.status.paid'), icon: CheckCircle, color: 'text-emerald-700', bgColor: 'dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
    { value: 'annulée', label: t('shared.status.cancelled'), icon: Ban, color: 'text-red-700', bgColor: 'dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 bg-red-50 text-red-700 border border-red-200/50' },
  ];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printingFacture ? `Facture_${printingFacture.numero}` : 'Facture',
    onAfterPrint: () => setPrintingFacture(null),
  });

  const mapFacture = (f: any) => ({
    ...f,
    numero: f.numero,
    clientId: f.client_id,
    client: f.client,
    dateEmission: f.date_emission,
    dateEcheance: f.date_echeance,
    montantHt: f.montant_ht,
    montantTva: f.montant_tva,
    montantTtc: f.montant_ttc,
    statut: f.statut,
    resteAPayer: f.reste_a_payer,
    modePaiement: f.mode_paiement,
  });

  const fetchFactures = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('factures')
        .select('*, client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map((f: any) => ({
        ...f,
        clientId: f.client_id,
        client: f.client,
        dateEmission: f.date_emission,
        dateEcheance: f.date_echeance,
        montantHt: f.montant_ht,
        montantTva: f.montant_tva,
        montantTtc: f.montant_ttc,
        statut: f.statut,
        resteAPayer: f.reste_a_payer,
        modePaiement: f.mode_paiement,
      }));

      setFactures(mapped);
    } catch (error) {
      console.error('Failed to fetch factures', error);
      toast.error(t('factures.toast_load_error'));
      setFactures([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntreprise = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('parametres')
        .select('id,user_id,nom_societe,nom,adresse,ville,telephone,email,ice,logo_url,couleur_principale,watermark_text,activer_filigrane')
        .eq('user_id', String(user.id))
        .maybeSingle();

      if (!data) {
        console.log('No parametres found');
        setEntreprise(null);
        return;
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching parametres:', error);
      }

      if (data) {
        const cleanLogoUrl = !data.logo_url || data.logo_url === 'image.png'
          ? ''
          : data.logo_url;
        setEntreprise({
          userId: user.id,
          nomEntreprise: data.nom_societe || data.nom || '',
          adresse: data.adresse || '',
          ville: data.ville || '',
          telephone: data.telephone || '',
          email: data.email || '',
          ice: data.ice || '',
          logoUrl: cleanLogoUrl,
          couleurPrincipale: data.couleur_principale || '#267E54',
          watermarkText: data.watermark_text || 'OptiGestion',
          activerFiligrane: data.activer_filigrane !== undefined ? data.activer_filigrane : true,
        });
      }
    } catch (error) {
      console.warn('Failed to fetch entreprise:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchFactures();
      fetchEntreprise();
    }
  }, [user?.id]);

  useEffect(() => {
    if (printingFacture && printRef.current) {
      handlePrint();
    }
  }, [printingFacture, handlePrint]);

  const handleDelete = async () => {
    if (!factureToDelete) return;

    try {
      const { error } = await supabase.from('factures').delete().eq('id', factureToDelete);
      if (error) throw error;
      toast.success(t('factures.toast_deleted'));
      fetchFactures();
    } catch (error) {
      toast.error(t('shared.toast.delete_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setFactureToDelete(null);
    }
  };

  const handleEdit = async (facture: Facture) => {
    try {
      const [factureResult, clientResult, lignesResult, allProductsResult] = await Promise.all([
        supabase.from('factures').select('*').eq('id', facture.id).single(),
        supabase.from('clients').select('*').eq('id', facture.clientId).single(),
        supabase.from('facture_lignes').select('*').eq('facture_id', facture.id).order('ordre'),
        supabase.from('produits').select('*').eq('user_id', user?.id).order('nom')
      ]);

      const { data: factureData, error: fError } = factureResult;
      if (fError) throw fError;

      const { data: clientData } = clientResult;
      const { data: lignesData } = lignesResult;
      const { data: allProductsData } = allProductsResult;

      const produitsMap: any = {};
      (allProductsData || []).forEach((p: any) => {
        produitsMap[p.id] = p;
      });

      (lignesData || []).forEach((l: any) => {
        if (l.produit_id && !produitsMap[l.produit_id]) {
          produitsMap[l.produit_id] = { id: l.produit_id, nom: l.designation };
        }
      });

      const mappedLignes = (lignesData || []).map((l: any) => {
        const produit = produitsMap[l.produit_id];
        return {
          id: l.id,
          produitId: String(l.produit_id || ''),
          produit: produit,
          reference: l.reference || produit?.reference || '',
          designation: l.designation || l.description || produit?.nom || produit?.designation || '',
          quantite: l.quantite || 1,
          prixUnitaireHt: Number(l.prix_unitaire_ht || l.prix_unitaire || produit?.prix_vente_ht || 0),
          tva: Number(l.tva || produit?.taux_tva || produit?.tva || 20),
          montantHt: Number(l.montant_ht || 0),
          montantTtc: Number(l.montant_ttc || 0),
        };
      });

      const mappedData = {
        ...factureData,
        client: clientData,
        clientId: String(factureData?.client_id || ''),
        dateEmission: factureData?.date_emission?.split('T')[0] || new Date().toISOString().split('T')[0],
        dateEcheance: factureData?.date_echeance?.split('T')[0] || '',
        montantHt: Number(factureData?.montant_ht || 0),
        montantTva: Number(factureData?.montant_tva || 0),
        montantTtc: Number(factureData?.montant_ttc || 0),
        statut: factureData?.statut || 'brouillon',
        resteAPayer: Number(factureData?.reste_a_payer || 0),
        modePaiement: factureData?.mode_paiement || 'Virement',
        notes: factureData?.notes || '',
        conditionsPaiement: factureData?.conditions_paiement || '',
        lignes: mappedLignes,
      };

      setEditingFacture(mappedData);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading facture:', error);
      toast.error(t('factures.toast_load_detail_error'));
    }
  };

  const handleMarkAsPaid = async (id: number) => {
    try {
      const { error } = await supabase
        .from('factures')
        .update({ statut: 'payée', reste_a_payer: 0 })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      toast.success(t('factures.toast_marked_paid'));
      fetchFactures();
    } catch (error) {
      toast.error(t('shared.toast.update_error'));
    }
  };

  const createAvoirForFacture = async (factureId: number): Promise<{ id: number; numero: string }> => {
    const { data: factureData, error: fetchError } = await supabase
      .from('factures')
      .select('*, client:clients(*)')
      .eq('id', factureId)
      .single();

    if (fetchError || !factureData) throw new Error('Facture non trouvée');

    const { data: lignesData } = await supabase
      .from('facture_lignes')
      .select('*')
      .eq('facture_id', factureId)
      .order('ordre');

    const year = new Date().getFullYear();
    const { count } = await supabase.from('avoirs').select('*', { count: 'exact', head: true });
    const randomNum = String((count || 0) + 1).padStart(4, '0');
    const numeroAvoir = `AV-${year}-${randomNum}`;

    const { data: avoirData, error: avoirError } = await supabase
      .from('avoirs')
      .insert([{
        user_id: user?.id,
        numero: numeroAvoir,
        facture_id: factureData.id,
        client_id: factureData.client_id,
        date_emission: new Date().toISOString(),
        montant_ht: factureData.montant_ht,
        montant_tva: factureData.montant_tva,
        montant_ttc: factureData.montant_ttc,
        statut: 'Généré',
        notes: `Avoir pour annulation de la facture ${factureData.numero}`,
      }])
      .select()
      .single();

    if (avoirError) throw avoirError;

    if (lignesData && lignesData.length > 0) {
      const lignesPayload = lignesData.map((l: any, index: number) => ({
        avoir_id: avoirData.id,
        produit_id: l.produit_id,
        designation: l.description || l.designation || '',
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht || l.prix_unitaire || 0,
        tva: l.tva,
        montant_ht: l.montant_ht,
        montant_ttc: l.montant_ttc,
        ordre: index,
      }));

      const { error: lignesError } = await supabase.from('avoir_lignes').insert(lignesPayload);
      if (lignesError) throw lignesError;
    }

    return { id: avoirData.id, numero: numeroAvoir };
  };

  const handleAnnuler = async (facture: Facture) => {
    try {
      const { numero: numeroAvoir } = await createAvoirForFacture(facture.id);

      const { error: updateError } = await supabase
        .from('factures')
        .update({ statut: 'annulée' })
        .eq('id', facture.id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      toast.success(t('factures.toast_cancelled', { number: numeroAvoir }));
      fetchFactures();
    } catch (error: any) {
      console.error('Error cancelling facture:', error);
      toast.error(error.message || t('factures.toast_cancel_error'));
    }
  };

  const handleDownload = async (facture: Facture) => {
    try {
      toast.info(t('shared.toast.pdf_preparing'));

      const [factureResult, allProductsResult] = await Promise.all([
        supabase.from('factures').select('*, client:clients(*)').eq('id', facture.id).single(),
        supabase.from('produits').select('*').eq('user_id', user?.id).order('nom')
      ]);

      const { data: factureData, error } = factureResult;
      if (error) throw error;

      const { data: allProductsData } = allProductsResult;

      const { data: lignesData } = await supabase.from('facture_lignes').select('*').eq('facture_id', facture.id).order('ordre');

      const produitsMap: any = {};
      (allProductsData || []).forEach((p: any) => {
        produitsMap[p.id] = p;
      });

      const mappedLignes = (lignesData || []).map((l: any) => {
        const produit = produitsMap[l.produit_id];
        return {
          ...l,
          designation: l.designation || l.description || produit?.nom || produit?.designation || '',
          reference: l.reference || produit?.reference || '',
        };
      });

      const mappedFacture = {
        ...factureData,
        numero: factureData.numero,
        clientId: factureData.client_id,
        client: factureData.client,
        dateEmission: factureData.date_emission,
        dateEcheance: factureData.date_echeance,
        montantHt: factureData.montant_ht,
        montantTva: factureData.montant_tva,
        montantTtc: factureData.montant_ttc,
        statut: factureData.statut,
        resteAPayer: factureData.reste_a_payer,
        modePaiement: factureData.mode_paiement,
        lignes: mappedLignes,
      };
      setPrintingFacture(mappedFacture);
    } catch (error) {
      toast.error(t('factures.toast_load_detail_error'));
    }
  };

  const handleStatusChange = async (id: number, newStatut: string) => {
    try {
      const { data: facture } = await supabase.from('factures').select('statut').eq('id', id).single();

      if (facture?.statut === 'annulée' && newStatut !== 'annulée') {
        const { data: avoir } = await supabase.from('avoirs').select('id').eq('facture_id', id).single();
        if (avoir) {
          await supabase.from('avoir_lignes').delete().eq('avoir_id', avoir.id);
          await supabase.from('avoirs').delete().eq('id', avoir.id);
        }
      }

      const oldStatut = facture?.statut;
      const updateData: any = { statut: newStatut };
      if (newStatut === 'payée') {
        updateData.reste_a_payer = 0;
      }

      // Create avoir BEFORE updating status (transaction integrity)
      if (newStatut === 'annulée' && oldStatut && oldStatut !== 'annulée') {
        await createAvoirForFacture(id);
      }

      const activeStatuses = ['payée', 'reste_a_payer'];
      const wasActive = activeStatuses.includes(oldStatut);
      const isActive = activeStatuses.includes(newStatut);

      // Stock update logic
      const changedIds: (number | string)[] = [];
      if (isActive && !wasActive) {
        const { data: lignes } = await supabase
          .from('facture_lignes')
          .select('produit_id, quantite')
          .eq('facture_id', id);

        if (lignes) {
          for (const l of lignes) {
            if (l.produit_id) {
              await updateStockAndNotify(user?.id, l.produit_id, -Number(l.quantite));
              changedIds.push(l.produit_id);
            }
          }
        }
      } else if (!isActive && wasActive && newStatut === 'annulée') {
        const { data: lignes } = await supabase
          .from('facture_lignes')
          .select('produit_id, quantite')
          .eq('facture_id', id);

        if (lignes) {
          for (const l of lignes) {
            if (l.produit_id) {
              await updateStockAndNotify(user?.id, l.produit_id, Number(l.quantite));
            }
          }
        }
      }

      if (changedIds.length > 0) {
        await ensureLowStockNotifications(user?.id, changedIds);
      }

      const { error } = await supabase
        .from('factures')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      toast.success(t('shared.toast.status_updated'));
      fetchFactures();
    } catch (error) {
      toast.error(t('shared.toast.update_error'));
    }
  };

  const openNewForm = () => {
    setEditingFacture(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingFacture(null);
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const filteredFactures = useMemo(() => {
    let filtered = factures.filter((facture) =>
      facture.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facture.client?.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facture.client?.nomSociete?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.statut === statusFilter);
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (timeFilter) {
        case '30days':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'thisMonth':
          cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'thisYear':
          cutoff = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          cutoff = new Date(0);
      }
      filtered = filtered.filter(f => new Date(f.dateEmission) >= cutoff);
    }

    return filtered;
  }, [factures, searchQuery, statusFilter, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredFactures.length / ITEMS_PER_PAGE));
  const paginatedFactures = filteredFactures.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalFactures = factures.length;
  const facturesPayees = factures.filter(f => f.statut === 'payée').length;
  const facturesEnAttente = factures.filter(f => ['en_attente', 'reste_a_payer'].includes(f.statut)).length;
  const totalMontant = filteredFactures.reduce((sum, f) => sum + (f.montantTtc || 0), 0);
  const totalResteAPayer = filteredFactures.reduce((sum, f) => sum + (f.resteAPayer || 0), 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30Factures = factures.filter(f => new Date(f.dateEmission) >= thirtyDaysAgo);
  const drafted30 = last30Factures.filter(f => f.statut === 'brouillon');
  const sent30 = last30Factures.filter(f => f.statut === 'en_attente');
  const paid30 = last30Factures.filter(f => f.statut === 'payée');
  const total30Amount = last30Factures.reduce((sum, f) => sum + (f.montantTtc || 0), 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, timeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_invoice')}
        description={t('shared.confirm_delete.body_invoice')}
      />

      <div style={{ display: 'none' }}>
        {printingFacture && (
          <FactureDocument ref={printRef} facture={printingFacture} entreprise={entreprise} lang={i18n.language} />
        )}
      </div>

      {showForm ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {editingFacture ? t('factures.dialog_edit') : t('factures.dialog_create')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingFacture ? t('factures.dialog_subtitle_edit', { number: editingFacture.numero }) : t('factures.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-6">
            <FactureForm
              initialData={editingFacture}
              onSuccess={() => {
                closeForm();
                fetchFactures();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-rose-500/10 dark:border-rose-500/20 bg-rose-50 border border-rose-200/50">
                <Receipt className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{t('factures.page_title')}</h2>
                <p className="text-sm text-muted-foreground">{t('factures.page_subtitle')}</p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-sm h-10 px-5 shadow-none"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('factures.new_button')}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400" />
                  <Input
                    type="search"
                    placeholder={t('factures.search_ph')}
                    className="pl-9 h-10 dark:bg-slate-900 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-[140px] dark:bg-slate-900 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                    <Filter className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 me-2" />
                    <SelectValue placeholder={t('shared.table.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('shared.filters.all_statuses')}</SelectItem>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="h-10 w-[150px] dark:bg-slate-900 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                    <CalendarDays className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 me-2" />
                    <SelectValue placeholder={t('shared.filters.all_periods')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('shared.filters.all_periods')}</SelectItem>
                    <SelectItem value="30days">{t('shared.filters.last_30_days')}</SelectItem>
                    <SelectItem value="thisMonth">{t('shared.filters.this_month')}</SelectItem>
                    <SelectItem value="thisYear">{t('shared.filters.this_year')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b dark:border-white/5 border-slate-100">
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.client')}</TableHead>
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.number')}</TableHead>
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.amount')}</TableHead>
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('shared.table.status')}</TableHead>
                      <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm text-muted-foreground font-medium">{t('factures.loading')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedFactures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                              <Receipt className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                            </div>
                            <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                              {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                                ? t('factures.empty_filtered')
                                : t('factures.empty_all')}
                            </p>
                            {!searchQuery && statusFilter === 'all' && timeFilter === 'all' && (
                              <Button
                                variant="outline"
                                className="mt-1 rounded-sm text-sm"
                                onClick={openNewForm}
                              >
                                <Plus className="me-2 h-4 w-4" />
                                {t('factures.create_first')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedFactures.map((facture) => {
                        const status = getStatusConfig(facture.statut);
                        const StatusIcon = status.icon;
                        const clientInitial = (facture.client?.nom || '?').charAt(0).toUpperCase();

                        return (
                          <TableRow
                            key={facture.id}
                            className="border-b dark:border-white/5 border-slate-100"
                          >
                            <TableCell className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar size="sm" className="h-8 w-8 dark:border-white/10 border border-slate-200">
                                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${facture.client?.nom}`} />
                                  <AvatarFallback className="text-xs font-semibold dark:bg-slate-800 dark:text-muted-foreground bg-slate-100 text-slate-600">
                                    {clientInitial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">
                                    {facture.client?.nom || facture.client?.nomSociete || '-'}
                                  </p>
                                  <p className="text-xs dark:text-muted-foreground text-slate-400">
                                    {facture.client?.email || facture.numero}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <span dir="ltr" className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{facture.numero}</span>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <span
                                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                                className="text-sm dark:text-muted-foreground text-slate-500"
                              >
                                {formatDate(facture.dateEmission, 'dd MMM yyyy', i18n.language)}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-start">
                              <span
                                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                                className="text-sm font-bold dark:text-card-foreground text-slate-800"
                              >
                                {formatCurrencyLocale(facture.montantTtc, i18n.language)}
                              </span>
                              <ArrowUpRight className="h-3 w-3 dark:text-muted-foreground text-slate-400 inline-block ms-1 -mt-0.5" />
                            </TableCell>
                            <TableCell className="px-4 py-4 text-center">
                              <Select
                                value={facture.statut}
                                onValueChange={(val) => handleStatusChange(facture.id, val)}
                              >
                                <SelectTrigger className="h-auto w-auto mx-auto bg-transparent border-none shadow-none focus:ring-0 p-0">
                                  <SelectValue>
                                    <span className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                                      status.bgColor
                                    )}>
                                      <StatusIcon className={cn("h-3 w-3", status.color)} />
                                      {status.label}
                                    </span>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map(opt => {
                                    const OptIcon = opt.icon;
                                    return (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        <div className="flex items-center gap-2">
                                          <OptIcon className={cn("h-4 w-4", opt.color)} />
                                          <span>{opt.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-start">
                              <div className="flex justify-end gap-0.5">
                                {!['payée', 'reste_a_payer'].includes(facture.statut) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 dark:text-muted-foreground dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-sm"
                                    onClick={() => handleMarkAsPaid(facture.id)}
                                    title={t('factures.tooltip_mark_paid')}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                                  onClick={() => handleDownload(facture)}
                                  title={t('shared.actions.download_pdf')}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                                  onClick={() => handleEdit(facture)}
                                  title={t('shared.actions.edit')}
                                >
                                  <FileEdit className="h-4 w-4" />
                                </Button>
                                {facture.statut === 'brouillon' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                                    onClick={() => {
                                      setFactureToDelete(facture.id);
                                      setDeleteConfirmOpen(true);
                                    }}
                                    title={t('shared.actions.delete')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : facture.statut !== 'annulée' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                                    onClick={() => handleAnnuler(facture)}
                                    title={t('factures.tooltip_cancel')}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {!isLoading && paginatedFactures.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                    <p className="text-xs dark:text-muted-foreground text-slate-400" dir="ltr">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredFactures.length)} {t('shared.pagination.of')} {filteredFactures.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-sm dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 min-w-[32px] rounded-sm text-sm font-medium",
                            page === currentPage
                              ? "dark:bg-white/10 dark:text-card-foreground bg-slate-100 text-slate-800"
                              : "dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          )}
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-sm dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                      >
                        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">
                <CardHeader className="px-4 py-4 border-b dark:border-white/5 border-slate-100">
                  <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">{t('factures.sidebar_title')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-sky-50 border border-sky-200/50 shrink-0">
                      <FileText className="h-4 w-4 dark:text-primary text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs dark:text-muted-foreground text-slate-500">{t('factures.sidebar_draft')}</p>
                      <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{drafted30.length} {drafted30.length !== 1 ? t('factures.sidebar_invoice_other') : t('factures.sidebar_invoice_one')}</p>
                    </div>
                    <span dir="ltr" className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                      {formatCurrency(drafted30.reduce((s, f) => s + (f.montantTtc || 0), 0))}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-rose-50 border border-rose-200/50 shrink-0">
                      <Send className="h-4 w-4 dark:text-primary text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs dark:text-muted-foreground text-slate-500">{t('factures.sidebar_sent')}</p>
                      <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{sent30.length} {sent30.length !== 1 ? t('factures.sidebar_invoice_other') : t('factures.sidebar_invoice_one')}</p>
                    </div>
                    <span dir="ltr" className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                      {formatCurrency(sent30.reduce((s, f) => s + (f.montantTtc || 0), 0))}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-blue-50 border border-blue-200/50 shrink-0">
                      <CheckCircle className="h-4 w-4 dark:text-primary text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs dark:text-muted-foreground text-slate-500">{t('factures.sidebar_paid')}</p>
                      <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{paid30.length} {paid30.length !== 1 ? t('factures.sidebar_invoice_other') : t('factures.sidebar_invoice_one')}</p>
                    </div>
                    <span dir="ltr" className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                      {formatCurrency(paid30.reduce((s, f) => s + (f.montantTtc || 0), 0))}
                    </span>
                  </div>

                  <div className="pt-3 border-t dark:border-white/5 border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{t('factures.sidebar_total')}</p>
                      <p dir="ltr" className="text-base font-bold text-rose-500">{formatCurrency(total30Amount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

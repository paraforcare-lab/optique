import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FileEdit, Trash2, Download, ShoppingCart, Package,
  FileText, Clock, CheckCircle, Ban, Truck, Send, ChevronLeft,
  ChevronRight, CalendarDays, Filter, Building2, ArrowUpRight,
  ArrowLeft
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatCurrencyLocale, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { BonCommandeForm } from '@/components/forms/BonCommandeForm'
import { useReactToPrint } from 'react-to-print'
import { BonCommandeDocument } from '@/components/documents/BonCommandeDocument'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'

interface BonCommande {
  id: number;
  numero: string;
  type: string;
  fournisseurId: number;
  fournisseur: { nom: string; nomSociete?: string; email?: string };
  clientId: number;
  client: { nom: string; cine?: string };
  dateCommande: string;
  dateLivraisonPrevue?: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
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

export function BonsCommandeList() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth();
  const [bons, setBons] = useState<BonCommande[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBon, setEditingBon] = useState<any | null>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const [selectedBon, setSelectedBon] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bonToDelete, setBonToDelete] = useState<number | null>(null);

  const statusOptions: StatutOption[] = [
    { value: 'brouillon', label: t('shared.status.draft'), icon: FileText, color: 'text-amber-700', bgColor: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'envoyé', label: t('shared.status.sent'), icon: Send, color: 'text-amber-700', bgColor: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
    { value: 'confirmé', label: t('shared.status.confirmed'), icon: CheckCircle, color: 'text-emerald-700', bgColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
    { value: 'livré', label: t('shared.status.delivered'), icon: Truck, color: 'text-violet-700', bgColor: 'bg-violet-50 text-violet-700 border border-violet-200/50' },
    { value: 'annulé', label: t('shared.status.cancelled'), icon: Ban, color: 'text-rose-700', bgColor: 'bg-rose-50 text-rose-700 border border-rose-200/50' },
  ];

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: selectedBon ? `Bon_Commande_${selectedBon.numero}` : 'Bon_Commande',
  });

  const mapBonCommande = (b: any) => ({
    ...b,
    id: b.id,
    numero: b.numero || '',
    type: b.type || 'simple',
    fournisseurId: b.fournisseur_id,
    fournisseur: b.fournisseur,
    clientId: b.client_id,
    client: b.client,
    dateCommande: b.date_commande,
    dateLivraisonPrevue: b.date_livraison_prevue,
    montantHt: Number(b.montant_ht || 0),
    montantTva: Number(b.montant_tva || 0),
    montantTtc: Number(b.montant_ttc || 0),
    statut: b.statut || 'brouillon',
  });

  const fetchBons = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*), client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBons(Array.isArray(data) ? (data || []).map(mapBonCommande) : []);
    } catch (error) {
      console.error('Failed to fetch bons de commande', error);
      toast.error(t('shared.toast.loading_error'));
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
        setEntreprise(null);
        return;
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Error:', error);
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
          watermarkText: data.watermark_text || 'ParaGestion',
          activerFiligrane: data.activer_filigrane !== undefined ? data.activer_filigrane : true,
        });
      }
    } catch (error) {
      console.warn('Failed to fetch entreprise:', error);
    }
  };

  useEffect(() => {
    fetchBons();
    fetchEntreprise();
  }, [user]);

  const handleDelete = async () => {
    if (!bonToDelete) return;

    try {
      const { error } = await supabase.from('bons_commande').delete().eq('id', bonToDelete);
      if (error) throw error;
      toast.success(t('bons_commande.toast_deleted'));
      fetchBons();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('shared.toast.delete_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setBonToDelete(null);
    }
  };

  const handleEdit = async (bon: BonCommande) => {
    try {
      const { data: bonData, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', bon.id)
        .order('ordre');

      const mappedData = {
        ...bonData,
        type: bonData.type || 'simple',
        fournisseurId: bonData.fournisseur_id?.toString() || '',
        clientId: bonData.client_id?.toString() || '',
        dateCommande: bonData.date_commande?.split('T')[0] || '',
        dateLivraisonPrevue: bonData.date_livraison_prevue?.split('T')[0] || '',
        lignes: (lignesData || []).map((l: any) => ({
          produitId: l.produit_id?.toString() || '',
          prescriptionId: l.prescription_id?.toString() || '',
          reference: l.reference || '',
          designation: l.designation || '',
          quantite: Number(l.quantite || 1),
          prixUnitaireHt: Number(l.prix_unitaire_ht || 0),
          tva: Number(l.tva || 20),
          montantHt: Number(l.montant_ht || 0),
          montantTtc: Number(l.montant_ttc || 0),
        })),
      };

      setEditingBon(mappedData);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading bon:', error);
      toast.error(t('bons_commande.toast_load_error'));
    }
  };

  const handleDownload = async (bon: BonCommande) => {
    try {
      toast.info(t('shared.toast.pdf_preparing'));

      const { data: bonData, error } = await supabase
        .from('bons_commande')
        .select('*, fournisseur:fournisseurs(*), client:clients(*)')
        .eq('id', bon.id)
        .single();

      if (error) throw error;

      const { data: lignesData } = await supabase
        .from('bon_commande_lignes')
        .select('*')
        .eq('bon_commande_id', bon.id)
        .order('ordre');

      let prescriptionData = null;
      const isVerre = bonData.type === 'verre';
      if (isVerre && lignesData && lignesData.length > 0 && lignesData[0].prescription_id) {
        const { data: pData } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('id', lignesData[0].prescription_id)
          .single();
        prescriptionData = pData;
      }

      const mappedBon = {
        ...bonData,
        numero: bonData.numero,
        type: bonData.type || 'simple',
        fournisseurId: bonData.fournisseur_id,
        fournisseur: bonData.fournisseur,
        clientId: bonData.client_id,
        client: bonData.client,
        dateCommande: bonData.date_commande,
        dateLivraisonPrevue: bonData.date_livraison_prevue,
        montantHt: bonData.montant_ht,
        montantTva: bonData.montant_tva,
        montantTtc: bonData.montant_ttc,
        statut: bonData.statut,
        prescription: prescriptionData,
        lignes: (lignesData || []).map((l: any) => ({
          designation: l.designation || '',
          reference: l.reference || '',
          quantite: l.quantite,
          prixUnitaireHt: l.prix_unitaire_ht,
          prix_unitaire_ht: l.prix_unitaire_ht,
          tva: l.tva,
          montantHt: l.montant_ht,
          montant_ht: l.montant_ht,
          montantTtc: l.montant_ttc,
          montant_ttc: l.montant_ttc,
          prescriptionId: l.prescription_id?.toString() || '',
        })),
      };
      setSelectedBon(mappedBon);
      setTimeout(() => handlePrint(), 100);
    } catch (error) {
      toast.error(t('shared.toast.loading_error'));
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/bons-commande/${id}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('shared.toast.update_error'));
      }
      toast.success(t('shared.toast.status_updated'));
      fetchBons();
    } catch (error: any) {
      toast.error(error?.message || t('shared.toast.update_error'));
    }
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const openNewForm = () => {
    setEditingBon(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBon(null);
  };

  const filteredBons = useMemo(() => {
    let filtered = bons.filter((bon) =>
      bon.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bon.fournisseur?.nomSociete?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bon.fournisseur?.nom?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.statut === statusFilter);
    }

    return filtered;
  }, [bons, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBons.length / ITEMS_PER_PAGE));
  const paginatedBons = filteredBons.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const totalBons = bons.length;
  const bonsConfirmes = bons.filter(b => ['confirmé', 'livré'].includes(b.statut)).length;
  const bonsEnAttente = bons.filter(b => ['brouillon', 'envoyé'].includes(b.statut)).length;
  const totalMontant = filteredBons.reduce((sum, b) => sum + (b.montantTtc || b.montant_ttc || 0), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthBons = bons.filter(b => {
    const d = new Date(b.dateCommande);
    return d >= monthStart;
  });
  const monthCount = monthBons.length;
  const monthValue = monthBons.reduce((sum, b) => sum + (b.montantTtc || 0), 0);
  const pendingOrders = monthBons.filter(b => ['brouillon', 'envoyé'].includes(b.statut)).length;
  const deliveredOrders = monthBons.filter(b => b.statut === 'livré').length;
  const cancelledOrders = monthBons.filter(b => b.statut === 'annulé').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_order')}
        description={t('shared.confirm_delete.body_order')}
      />

      <div className="hidden">
        <BonCommandeDocument ref={componentRef} bon={selectedBon} entreprise={entreprise} lang={i18n.language} />
      </div>

      {showForm ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {editingBon ? t('bons_commande.dialog_edit') : t('bons_commande.dialog_create')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingBon
                  ? t('bons_commande.dialog_subtitle_edit', { number: editingBon.numero })
                  : t('bons_commande.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-[6px] border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-slate-900 dark:rounded-sm">
            <BonCommandeForm
              initialData={editingBon}
              onSuccess={() => {
                closeForm();
                fetchBons();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-emerald-50 border border-emerald-200/50 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
                <ShoppingCart className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{t('bons_commande.page_title')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('bons_commande.page_subtitle')}
                </p>
              </div>
            </div>

            <Button
              onClick={openNewForm}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-[4px] h-10 px-5 shadow-none dark:rounded-sm"
            >
              <Plus className="me-2 h-4 w-4" />
              {t('bons_commande.new_button')}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column - Table */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="search"
                    placeholder={t('bons_commande.search_ph')}
                    className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-[140px] bg-white border-slate-200 rounded-[4px] shadow-none text-sm dark:bg-transparent dark:border-white/10 dark:rounded-sm">
                    <Filter className="h-3.5 w-3.5 text-slate-400 me-2" />
                    <SelectValue placeholder={t('shared.table.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('shared.filters.all_statuses')}</SelectItem>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 dark:border-white/5">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.supplier')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Type</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.bon_number')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.date')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{t('shared.table.delivery')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.amount')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('shared.table.status')}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-start">{t('shared.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm text-muted-foreground font-medium">{t('shared.empty.loading')}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedBons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5 dark:rounded-sm">
                              <Package className="h-8 w-8 text-slate-300" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                              {searchQuery || statusFilter !== 'all'
                                ? t('bons_commande.empty_filtered')
                                : t('bons_commande.empty_all')}
                            </p>
                            {!searchQuery && statusFilter === 'all' && (
                              <Button
                                variant="outline"
                                className="mt-1 rounded-[4px] text-sm"
                                onClick={openNewForm}
                              >
                                <Plus className="me-2 h-4 w-4" />
                                {t('bons_commande.create_first')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedBons.map((bon) => {
                        const status = getStatusConfig(bon.statut);
                        const StatusIcon = status.icon;
                        const fournisseurInitial = (bon.fournisseur?.nom || '?').charAt(0).toUpperCase();

                        return (
                          <TableRow
                            key={bon.id}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.03]"
                          >
                            <TableCell className="px-4 py-5">
                              {bon.type === 'verre' ? (
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-[6px] bg-sky-50 border border-sky-200/50 flex items-center justify-center dark:bg-sky-500/10 dark:border-sky-500/20">
                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{bon.client?.nom?.charAt(0) || '?'}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                      {bon.client?.nom || '-'}
                                    </p>
                                    {bon.client?.cine && (
                                      <p className="text-xs text-slate-400">{bon.client.cine}</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <Avatar size="sm" className="h-8 w-8 border border-slate-200">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${bon.fournisseur?.nom}`} />
                                    <AvatarFallback className="text-xs font-semibold bg-slate-100 text-slate-600">
                                      {fournisseurInitial}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                      {bon.fournisseur?.nom || bon.fournisseur?.nomSociete || '-'}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {bon.fournisseur?.email || bon.numero}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-5">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                                bon.type === 'verre'
                                  ? "bg-sky-50 text-sky-700 border border-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20"
                                  : "bg-slate-50 text-slate-600 border border-slate-200/50 dark:bg-slate-500/10 dark:text-slate-400"
                              )}>
                                {bon.type === 'verre' ? 'Verre' : 'Simple'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5">
                              <span dir="ltr" className="text-sm font-mono font-medium text-slate-700 dark:text-white">{bon.numero}</span>
                            </TableCell>
                            <TableCell className="px-4 py-5">
                              <span
                                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                                className="text-sm text-slate-500 dark:text-slate-400"
                              >
                                {formatDate(bon.dateCommande || bon.date, 'dd MMM yyyy', i18n.language)}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5">
                              <span
                                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                                className="text-sm text-slate-500 dark:text-slate-400"
                              >
                                {bon.dateLivraisonPrevue
                                  ? formatDate(bon.dateLivraisonPrevue, 'dd MMM yyyy', i18n.language)
                                  : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5 text-start">
                              <span
                                dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}
                                className="text-sm font-bold text-slate-800 dark:text-white"
                              >
                                {formatCurrencyLocale(bon.montantTtc, i18n.language)}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-5 text-center">
                              <Select
                                value={bon.statut}
                                onValueChange={(val) => handleStatusChange(bon.id, val)}
                              >
                                <SelectTrigger className="h-auto w-auto mx-auto bg-transparent border-none shadow-none focus:ring-0 p-0">
                                  <SelectValue>
                                    <span className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                                      status.bgColor,
                                      bon.statut === 'livré' && "dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20"
                                    )}>
                                      <StatusIcon className={cn("h-3 w-3", status.color, bon.statut === 'livré' && "dark:text-violet-300")} />
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
                            <TableCell className="px-4 py-5 text-start">
                              <div className="flex justify-end gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                                  onClick={() => handleDownload(bon)}
                                  title={t('shared.actions.download_pdf')}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
                                  onClick={() => handleEdit(bon)}
                                  title={t('shared.actions.edit')}
                                >
                                  <FileEdit className="h-4 w-4" />
                                </Button>
                                {bon.statut === 'brouillon' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                                    onClick={() => {
                                      setBonToDelete(bon.id);
                                      setDeleteConfirmOpen(true);
                                    }}
                                    title={t('shared.actions.delete')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : bon.statut !== 'annulé' ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:hover:text-red-400 dark:hover:bg-white/5 dark:rounded-sm"
                                    onClick={() => handleStatusChange(bon.id, 'annulé')}
                                    title={t('shared.status.cancelled')}
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

                {!isLoading && paginatedBons.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                    <p className="text-xs text-slate-400" dir="ltr">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredBons.length)} {t('shared.pagination.of')} {filteredBons.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
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
                            "h-8 min-w-[32px] rounded-[4px] text-sm font-medium dark:rounded-sm",
                            page === currentPage
                              ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"
                              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:text-white dark:hover:bg-white/5"
                          )}
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:hover:text-white dark:hover:bg-white/5 dark:rounded-sm"
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

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <Card className="border border-slate-200 shadow-none rounded-[6px] dark:border-white/10 dark:rounded-sm">
                <CardHeader className="px-4 py-4 border-b border-slate-100 dark:border-white/5">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-white">{t('bons_commande.sidebar_title')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 py-4 space-y-5">

                  {/* ── Montant engagé ce mois ───────────────────────────── */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                      <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 dark:text-muted-foreground">
                        {t('bons_commande.sidebar_committed')}
                      </p>
                      <p dir="ltr" className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(monthValue)}
                      </p>
                    </div>
                  </div>

                  {/* ── Commandes passées ────────────────────────────────── */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-emerald-50 border border-emerald-200/50 shrink-0 dark:rounded-sm dark:bg-primary/10 dark:border-primary/20">
                      <Package className="h-4 w-4 text-emerald-600 dark:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 dark:text-muted-foreground">
                        {t('bons_commande.sidebar_orders')}
                      </p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">
                        {monthCount}{' '}
                        <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                          {monthCount === 1
                            ? t('bons_commande.sidebar_order_one')
                            : t('bons_commande.sidebar_order_other')}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* ── Status breakdown ─────────────────────────────────── */}
                  <div className="border-t border-slate-100 pt-4 space-y-3 dark:border-white/5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-muted-foreground">
                        {t('bons_commande.sidebar_pending')}
                      </span>
                      <span dir="ltr" className="font-semibold text-amber-600">{pendingOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-muted-foreground">
                        {t('bons_commande.sidebar_delivered')}
                      </span>
                      <span dir="ltr" className="font-semibold text-violet-600 dark:text-slate-400">{deliveredOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-muted-foreground">
                        {t('bons_commande.sidebar_cancelled')}
                      </span>
                      <span dir="ltr" className="font-semibold text-rose-500 dark:text-slate-400">{cancelledOrders}</span>
                    </div>
                  </div>

                  {/* ── Link to suppliers ────────────────────────────────── */}
                  <div className="border-t border-slate-100 pt-4 dark:border-white/5">
                    <Link
                      to="/fournisseurs"
                      className="flex items-center gap-2 rounded-[6px] bg-slate-50 border border-slate-200/50 px-3 py-2.5 hover:bg-slate-100 transition-colors dark:rounded-sm dark:bg-slate-900/40 dark:border-white/10 dark:hover:bg-slate-900/60"
                    >
                      <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {t('bons_commande.sidebar_view_suppliers')}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-muted-foreground">
                          {t('bons_commande.sidebar_access_list')}
                        </p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0 rtl:rotate-180" />
                    </Link>
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

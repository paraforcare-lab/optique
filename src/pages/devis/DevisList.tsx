import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
  Plus, Search, FileEdit, Trash2, Download, ArrowRightLeft, FileText,
  Send, CheckCircle, Ban, XCircle, Package, CalendarDays, Filter,
  ChevronLeft, ChevronRight, ExternalLink, TrendingUp
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
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { DevisForm } from '@/components/forms/DevisForm'
import { DevisDocument } from '@/components/documents/DevisDocument'
import { useReactToPrint } from 'react-to-print'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Devis {
  id: number;
  numero: string;
  client: { nom: string; nomSociete?: string; email?: string };
  clientId?: number;
  dateEmission: string;
  dateValidite?: string;
  montantHt: number;
  montantTtc: number;
  montantTva: number;
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

const statusOptions: StatutOption[] = [
  { value: 'brouillon', label: 'Brouillon', icon: FileText, color: 'text-slate-700', bgColor: 'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20 bg-slate-50 text-slate-700 border border-slate-200/50' },
  { value: 'envoyé', label: 'Envoyé', icon: Send, color: 'text-amber-700', bgColor: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 bg-amber-50 text-amber-700 border border-amber-200/50' },
  { value: 'accepté', label: 'Accepté', icon: CheckCircle, color: 'text-emerald-700', bgColor: 'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
  { value: 'refusé', label: 'Refusé', icon: XCircle, color: 'text-red-700', bgColor: 'dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 bg-red-50 text-red-700 border border-red-200/50' },
  { value: 'converti', label: 'Converti', icon: ArrowRightLeft, color: 'text-violet-700', bgColor: 'dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20 bg-violet-50 text-violet-700 border border-violet-200/50' },
];

const ITEMS_PER_PAGE = 10;

export function DevisList() {
  const { user } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevis, setEditingDevis] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [devisToDelete, setDevisToDelete] = useState<number | null>(null);
  const [factureMap, setFactureMap] = useState<Record<number, string>>({});

  const [printingDevis, setPrintingDevis] = useState<any>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printingDevis ? `Devis_${printingDevis.numero}` : 'Devis',
    onAfterPrint: () => setPrintingDevis(null),
  });

  const mapDevis = (d: any) => ({
    ...d,
    id: d.id,
    numero: d.numero,
    clientId: d.client_id,
    client: d.client,
    dateEmission: d.date_emission,
    dateValidite: d.date_validite,
    montantHt: d.montant_ht,
    montantTva: d.montant_tva,
    montantTtc: d.montant_ttc,
    statut: d.statut,
    lignes: d.lignes || [],
  });

  const fetchFactureMap = async (devisIds: number[]) => {
    if (devisIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('factures')
        .select('devis_id, numero')
        .in('devis_id', devisIds);
      const map: Record<number, string> = {};
      (data || []).forEach((f: any) => {
        map[f.devis_id] = f.numero;
      });
      setFactureMap(map);
    } catch {
      setFactureMap({});
    }
  };

  const fetchDevis = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('devis')
        .select('*, client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = Array.isArray(data) ? (data || []).map(mapDevis) : [];
      setDevisList(mapped);
      await fetchFactureMap(mapped.map((d: Devis) => d.id));
    } catch (error) {
      console.error('Failed to fetch devis', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntreprise = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('parametres')
        .select('id,user_id,nom_societe,nom,adresse,ville,code_postale,telephone,email,site_web,ice,rc,if_number,tp_patente,cnss,capital_social,forme_juridique,logo_url,couleur_principale,banque,rib,swift,watermark_text,activer_filigrane')
        .eq('user_id', String(user.id))
        .single();

      if (!data) {
        console.log('No parametres found for user');
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
          codePostal: data.code_postale || '',
          telephone: data.telephone || '',
          email: data.email || '',
          ice: data.ice || '',
          rc: data.rc || '',
          ifNumber: data.if_number || '',
          patentes: data.tp_patente || '',
          cnss: data.cnss || '',
          capitalSocial: data.capital_social || '',
          formeJuridique: data.forme_juridique || '',
          logoUrl: cleanLogoUrl,
          couleurPrincipale: data.couleur_principale || '#267E54',
          banque: data.banque || '',
          rib: data.rib || '',
          swift: data.swift || '',
          watermarkText: data.watermark_text || 'ParaGestion',
          activerFiligrane: data.activer_filigrane !== undefined ? data.activer_filigrane : true,
        });
      } else {
        setEntreprise(null);
      }
    } catch (error) {
      console.warn('Failed to fetch entreprise:', error);
    }
  };

  useEffect(() => {
    fetchDevis();
    fetchEntreprise();
  }, [user]);

  useEffect(() => {
    if (printingDevis && printRef.current) {
      handlePrint();
    }
  }, [printingDevis, handlePrint]);

  const handleConvertToFacture = async (id: number) => {
    try {
      const { data: devis, error: fetchError } = await supabase.from('devis').select('*').eq('id', id).single();
      if (fetchError || !devis) throw new Error('Devis not found');

      const { data: devisLignes } = await supabase.from('devis_lignes').select('*').eq('devis_id', id);

      let year = new Date().getFullYear();
      const { count } = await supabase.from('factures').select('*', { count: 'exact', head: true });
      const randomNum = String((count || 0) + 1).padStart(4, '0');
      const numero = `FAC-${year}-${randomNum}`;

      const payload = {
        user_id: user?.id,
        client_id: devis.client_id,
        date_emission: new Date().toISOString(),
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        montant_ht: devis.montant_ht,
        montant_tva: devis.montant_tva,
        montant_ttc: devis.montant_ttc,
        statut: 'en_attente',
        reste_a_payer: devis.montant_ttc,
        devis_id: id,
        numero: numero,
      };

      const { data: newFacture, error: insertError } = await supabase.from('factures').insert([payload]).select().single();
      if (insertError) throw insertError;

      if (devisLignes && devisLignes.length > 0) {
        const lignesPayload = devisLignes.map((l: any, index: number) => ({
          facture_id: newFacture.id,
          produit_id: l.produit_id,
          reference: l.reference,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          tva: l.tva,
          montant_ht: l.montant_ht,
          montant_ttc: l.montant_ttc,
          ordre: index,
        }));
        const { error: lignesError } = await supabase.from('facture_lignes').insert(lignesPayload);
        if (lignesError) {
          await supabase.from('factures').delete().eq('id', newFacture.id);
          throw lignesError;
        }
      }

      await supabase.from('devis').update({ statut: 'converti' }).eq('id', id).eq('user_id', user?.id);

      toast.success('Devis converti en facture avec succès !');
      fetchDevis();
    } catch (error: any) {
      console.error('Conversion error:', error);
      toast.error(error?.message || 'Erreur lors de la conversion');
    }
  };

  const handleDelete = async () => {
    if (!devisToDelete) return;

    try {
      const { error } = await supabase.from('devis').delete().eq('id', devisToDelete);
      if (error) throw error;
      toast.success('Devis supprimé');
      fetchDevis();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteConfirmOpen(false);
      setDevisToDelete(null);
    }
  };

  const handleEdit = async (devis: Devis) => {
    try {
      const { data, error } = await supabase.from('devis').select('*').eq('id', devis.id).single();
      if (error) throw error;

      const { data: lignesData } = await supabase.from('devis_lignes').select('*').eq('devis_id', devis.id).order('ordre');

      const mappedData = {
        ...data,
        clientId: data.client_id?.toString() || '',
        dateEmission: data.date_emission?.split('T')[0] || '',
        dateValidite: data.date_validite?.split('T')[0] || '',
        lignes: (lignesData || []).map((l: any) => ({
          produitId: l.produit_id?.toString() || '',
          reference: l.reference || '',
          designation: l.designation || '',
          prixUnitaireHt: Number(l.prix_unitaire_ht || 0),
          quantite: Number(l.quantite || 1),
          tva: Number(l.tva || 20),
          montantHt: Number(l.montant_ht || 0),
          montantTtc: Number(l.montant_ttc || 0),
        })),
      };

      setEditingDevis(mappedData);
      setIsDialogOpen(true);
    } catch (error) {
      toast.error('Erreur lors du chargement du devis');
    }
  };

  const handleDownload = async (devis: Devis) => {
    try {
      toast.info('Préparation du PDF...');
      const { data, error } = await supabase.from('devis').select('*, client:clients(*)').eq('id', devis.id).single();
      if (error) throw error;

      const { data: lignesData } = await supabase.from('devis_lignes').select('*').eq('devis_id', devis.id).order('ordre');

      const mappedLignes = (lignesData || []).map((l: any) => ({
        ...l,
        reference: l.reference || '',
        designation: l.designation || '',
        quantite: Number(l.quantite || 1),
        prixUnitaireHt: Number(l.prix_unitaire_ht || 0),
        prix_unitaire_ht: Number(l.prix_unitaire_ht || 0),
        montantHt: Number(l.montant_ht || 0),
        montant_ht: Number(l.montant_ht || 0),
      }));

      const mappedDevis = {
        ...data,
        numero: data.numero,
        clientId: data.client_id,
        client: data.client,
        dateEmission: data.date_emission,
        dateValidite: data.date_validite,
        montantHt: data.montant_ht,
        montantTva: data.montant_tva,
        montantTtc: data.montant_ttc,
        statut: data.statut,
        lignes: mappedLignes,
      };
      setPrintingDevis(mappedDevis);
    } catch (error) {
      toast.error('Erreur lors du chargement des détails du devis');
    }
  };

  const handleStatusChange = async (id: number, newStatut: string) => {
    try {
      const { error } = await supabase
        .from('devis')
        .update({ statut: newStatut })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      toast.success('Statut mis à jour');
      fetchDevis();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const openNewForm = () => {
    setEditingDevis(null);
    setIsDialogOpen(true);
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const filteredDevis = useMemo(() => {
    let filtered = devisList.filter((devis) =>
      devis.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      devis.client?.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      devis.client?.nomSociete?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.statut === statusFilter);
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
      filtered = filtered.filter(d => new Date(d.dateEmission) >= cutoff);
    }

    return filtered;
  }, [devisList, searchQuery, statusFilter, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDevis.length / ITEMS_PER_PAGE));
  const paginatedDevis = filteredDevis.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30Devis = devisList.filter(d => new Date(d.dateEmission) >= thirtyDaysAgo);
  const attente30 = last30Devis.filter(d => ['brouillon', 'envoyé'].includes(d.statut));
  const convertis30 = last30Devis.filter(d => d.statut === 'converti');
  const expires30 = last30Devis.filter(d => ['refusé'].includes(d.statut));
  const total30Montant = last30Devis.reduce((sum, d) => sum + (d.montantTtc || 0), 0);
  const conversionRate = last30Devis.length > 0
    ? Math.round((convertis30.length / last30Devis.length) * 100)
    : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, timeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const totalDevis = devisList.length;
  const devisAcceptes = devisList.filter(d => d.statut === 'accepté').length;
  const devisEnAttente = devisList.filter(d => ['brouillon', 'envoyé'].includes(d.statut)).length;
  const totalMontant = devisList.reduce((sum, d) => sum + (d.montantTtc || 0), 0);
  const montantAcceptes = devisList.filter(d => d.statut === 'accepté').reduce((sum, d) => sum + (d.montantTtc || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer le devis"
        description="Êtes-vous sûr de vouloir supprimer ce devis ? Cette action est irréversible."
      />

      <div style={{ display: 'none' }}>
        {printingDevis && (
          <DevisDocument ref={printRef} devis={printingDevis} entreprise={entreprise} />
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-emerald-500/10 dark:border-emerald-500/20 bg-emerald-50 border border-emerald-200/50">
            <FileText className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Devis</h2>
            <p className="text-sm text-muted-foreground">Gérez vos devis et convertissez-les en factures</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingDevis(null);
        }}>
          <DialogTrigger render={
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-sm h-10 px-5 shadow-none">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Devis
            </Button>
          } />
          <DialogContent fullScreen className="bg-gradient-to-br from-background to-muted/20">
            <div className="flex flex-col h-full">
              <DialogHeader className="px-8 py-6 border-b dark:border-white/10 border-border/50 dark:bg-card/50 bg-white/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto w-full">
                  <DialogTitle className="text-2xl font-black text-foreground">
                    {editingDevis ? 'Modifier le devis' : 'Nouveau Devis'}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-muted-foreground">
                    {editingDevis
                      ? `Modification du devis ${editingDevis.numero}`
                      : 'Créez un nouveau devis pour vos clients'}
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto">
                  <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-8">
                    <DevisForm
                      initialData={editingDevis}
                      onSuccess={() => {
                        setIsDialogOpen(false);
                        setEditingDevis(null);
                        fetchDevis();
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400" />
              <Input
                type="search"
                placeholder="Rechercher par numéro ou client..."
                className="pl-9 h-10 dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[140px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                <Filter className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-[150px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                <CalendarDays className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 mr-2" />
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les périodes</SelectItem>
                <SelectItem value="30days">30 derniers jours</SelectItem>
                <SelectItem value="thisMonth">Ce mois</SelectItem>
                <SelectItem value="thisYear">Cette année</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b dark:border-white/5 border-slate-100">
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Client</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Numéro</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Date</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Montant</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">Statut</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Chargement...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedDevis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                          <FileText className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                        </div>
                        <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                          {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                            ? 'Aucun devis trouvé'
                            : 'Aucun devis créé'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDevis.map((devis) => {
                    const status = getStatusConfig(devis.statut);
                    const StatusIcon = status.icon;
                    const clientInitial = (devis.client?.nom || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={devis.id}
                        className="border-b dark:border-white/5 border-slate-100"
                      >
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="h-8 w-8 dark:border-white/10 border border-slate-200">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${devis.client?.nom}`} />
                              <AvatarFallback className="text-xs font-semibold dark:bg-slate-800 dark:text-muted-foreground bg-slate-100 text-slate-600">
                                {clientInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">
                                {devis.client?.nom || devis.client?.nomSociete || '-'}
                              </p>
                              <p className="text-xs dark:text-muted-foreground text-slate-400">
                                {devis.client?.email || devis.numero}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{devis.numero}</span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm dark:text-muted-foreground text-slate-500">
                            {format(new Date(devis.dateEmission), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <span className="text-sm font-bold dark:text-card-foreground text-slate-800">{formatCurrency(devis.montantTtc)}</span>
                          {devis.statut === 'converti' && factureMap[devis.id] && (
                            <div className="text-[10px] text-violet-500 font-medium mt-0.5 flex items-center justify-end gap-1">
                              <ExternalLink className="h-3 w-3" />
                              {factureMap[devis.id]}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-5 text-center">
                          <Select
                            value={devis.statut}
                            onValueChange={(val) => handleStatusChange(devis.id, val)}
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
                        <TableCell className="px-4 py-5 text-right">
                          <div className="flex justify-end gap-0.5">
                            {devis.statut !== 'converti' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 dark:text-muted-foreground dark:hover:text-violet-400 dark:hover:bg-violet-500/10 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded-sm"
                                title="Convertir en facture"
                                onClick={() => handleConvertToFacture(devis.id)}
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                              onClick={() => handleDownload(devis)}
                              title="Télécharger PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                              onClick={() => handleEdit(devis)}
                              title="Modifier"
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            {devis.statut === 'brouillon' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                                onClick={() => {
                                  setDevisToDelete(devis.id);
                                  setDeleteConfirmOpen(true);
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : !['refusé', 'converti'].includes(devis.statut) ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                                onClick={() => handleStatusChange(devis.id, 'refusé')}
                                title="Refuser"
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

            {!isLoading && paginatedDevis.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                <p className="text-xs dark:text-muted-foreground text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredDevis.length)} sur {filteredDevis.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-sm dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
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
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">
            <CardHeader className="px-4 py-4 border-b dark:border-white/5 border-slate-100">
              <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">Statistiques Devis</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-amber-50 border border-amber-200/50 shrink-0">
                  <Send className="h-4 w-4 dark:text-primary text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">En attente</p>
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{attente30.length} devis</p>
                </div>
                <span className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                  {formatCurrency(attente30.reduce((s, d) => s + (d.montantTtc || 0), 0))}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-violet-50 border border-violet-200/50 shrink-0">
                  <ArrowRightLeft className="h-4 w-4 dark:text-primary text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">Convertis</p>
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{convertis30.length} devis</p>
                </div>
                <span className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                  {formatCurrency(convertis30.reduce((s, d) => s + (d.montantTtc || 0), 0))}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-slate-50 border border-slate-200/50 shrink-0">
                  <XCircle className="h-4 w-4 dark:text-primary text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">Expirés / Refusés</p>
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800">{expires30.length} devis</p>
                </div>
                <span className="text-sm font-semibold dark:text-muted-foreground text-slate-600">
                  {formatCurrency(expires30.reduce((s, d) => s + (d.montantTtc || 0), 0))}
                </span>
              </div>

              <div className="pt-3 border-t dark:border-white/5 border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800">Total</p>
                  <p className="text-base font-bold text-emerald-500">{formatCurrency(total30Montant)}</p>
                </div>
                <div className="flex items-center gap-2 rounded-sm dark:bg-slate-900/40 dark:border-white/10 bg-emerald-50 border border-emerald-100/50 px-3 py-2.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-[11px] dark:text-muted-foreground text-slate-500 font-medium">Taux de conversion</p>
                    <p className="text-sm font-bold text-emerald-600">{conversionRate}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

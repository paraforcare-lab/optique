import { useEffect, useState, useRef, useMemo } from 'react'
import { Search, FileText, Download, Trash2, RotateCcw, Receipt, ChevronLeft, ChevronRight, CalendarDays, Filter, Info, ArrowUpRight } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
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
import { useReactToPrint } from 'react-to-print'
import { FactureDocument } from '@/components/documents/FactureDocument'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Avoir {
  id: number;
  numero: string;
  factureId: number;
  facture: { numero: string; statut: string };
  clientId: number;
  client: { nom: string; nomSociete?: string; email?: string };
  dateEmission: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  statut: string;
}

interface StatutOption {
  value: string;
  label: string;
  color: string;
  bgColor: string;
}

const statusOptions: StatutOption[] = [
  { value: 'Généré', label: 'Généré', color: 'text-blue-700', bgColor: 'dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 bg-blue-50 text-blue-700 border border-blue-200/50' },
  { value: 'en_attente', label: 'En attente', color: 'text-amber-700', bgColor: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 bg-amber-50 text-amber-700 border border-amber-200/50' },
  { value: 'émis', label: 'Émis', color: 'text-amber-700', bgColor: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 bg-amber-50 text-amber-700 border border-amber-200/50' },
  { value: 'remboursé', label: 'Remboursé', color: 'text-emerald-700', bgColor: 'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
  { value: 'appliqué', label: 'Appliqué', color: 'text-sky-700', bgColor: 'dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20 bg-sky-50 text-sky-700 border border-sky-200/50' },
  { value: 'annulé', label: 'Annulé', color: 'text-slate-500', bgColor: 'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20 bg-slate-50 text-slate-600 border border-slate-200/50' },
];

const ITEMS_PER_PAGE = 10;

export function AvoirsList() {
  const { user } = useAuth();
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [avoirToDelete, setAvoirToDelete] = useState<number | null>(null);

  const [printingAvoir, setPrintingAvoir] = useState<any>(null);
  const [entreprise, setEntreprise] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printingAvoir ? `Avoir_${printingAvoir.numero}` : 'Avoir',
    onAfterPrint: () => setPrintingAvoir(null),
  });

  const mapAvoir = (a: any) => ({
    ...a,
    id: a.id,
    numero: a.numero || '',
    factureId: a.facture_id,
    clientId: a.client_id,
    client: a.client,
    facture: a.facture,
    dateEmission: a.date_emission,
    montantHt: Number(a.montant_ht || a.montantHt || 0),
    montantTva: Number(a.montant_tva || a.montantTva || 0),
    montantTtc: Number(a.montant_ttc || a.montantTtc || 0),
    statut: a.statut || 'en_attente',
  });

  const fetchAvoirs = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('avoirs')
        .select('*, facture:factures(*), client:clients(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvoirs(Array.isArray(data) ? (data || []).map(mapAvoir) : []);
    } catch (error) {
      console.error('Failed to fetch avoirs', error);
      toast.error('Erreur lors du chargement des avoirs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntreprise = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('parametres')
        .select('id,user_id,nom_societe,nom,adresse,ville,telephone,email,ice,rc,if_number,logo_url,couleur_principale,capital_social,forme_juridique,watermark_text,activer_filigrane')
        .eq('user_id', String(user.id))
        .single();

      if (!data) {
        console.log('No parametres found');
        setEntreprise(null);
        return;
      }

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const cleanLogoUrl = !data.logo_url || data.logo_url === 'image.png'
          ? ''
          : data.logo_url;
        setEntreprise({
          userId: user.id,
          nom: data.nom_societe || data.nom || '',
          nomEntreprise: data.nom_societe || data.nom || '',
          adresse: data.adresse || '',
          ville: data.ville || '',
          telephone: data.telephone || '',
          email: data.email || '',
          ice: data.ice || '',
          logoUrl: cleanLogoUrl,
          watermarkText: data.watermark_text || 'ParaGestion',
          activerFiligrane: data.activer_filigrane !== undefined ? data.activer_filigrane : true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch entreprise settings', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAvoirs();
      fetchEntreprise();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('avoirs-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'avoirs', filter: `user_id=eq.${user.id}` },
        () => { fetchAvoirs(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (printingAvoir && printRef.current) {
      handlePrint();
    }
  }, [printingAvoir, handlePrint]);

  const handleDownload = async (avoir: Avoir) => {
    try {
      toast.info('Préparation du PDF...');

      const { data: lignesData } = await supabase.from('avoir_lignes').select('*').eq('avoir_id', avoir.id).order('ordre');

      const adaptedData = {
        id: avoir.id,
        numero: avoir.numero,
        client: avoir.client,
        clientId: avoir.clientId,
        dateEmission: avoir.dateEmission,
        dateEcheance: avoir.dateEmission,
        montantHt: avoir.montantHt,
        montantTva: avoir.montantTva,
        montantTtc: avoir.montantTtc,
        montant_ht: avoir.montantHt,
        montant_tva: avoir.montantTva,
        montant_ttc: avoir.montantTtc,
        lignes: (lignesData || []).map((l: any) => ({
          designation: l.designation || '',
          quantite: l.quantite,
          prixUnitaireHt: l.prix_unitaire_ht,
          prix_unitaire_ht: l.prix_unitaire_ht,
          tva: l.tva,
          montantHt: l.montant_ht,
          montant_ht: l.montant_ht,
          montantTtc: l.montant_ttc,
          montant_ttc: l.montant_ttc,
        })),
        statut: avoir.statut,
        isAvoir: true,
        type: 'AVOIR',
        numeroFactureOriginale: avoir.facture?.numero || '',
      };

      setPrintingAvoir(adaptedData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors du chargement des détails de l\'avoir');
    }
  };

  const handleDelete = async () => {
    if (!avoirToDelete) return;
    try {
      const { error } = await supabase.from('avoirs').delete().eq('id', avoirToDelete);
      if (error) throw error;
      toast.success('Avoir supprimé');
      fetchAvoirs();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteConfirmOpen(false);
      setAvoirToDelete(null);
    }
  };

  const getStatusConfig = (statut: string) => {
    return statusOptions.find(s => s.value === statut) || statusOptions[0];
  };

  const filteredAvoirs = useMemo(() => {
    let filtered = (avoirs || []).filter((avoir) => {
      const search = searchQuery.toLowerCase();
      return (
        avoir.numero?.toLowerCase().includes(search) ||
        avoir.facture?.numero?.toLowerCase().includes(search) ||
        avoir.client?.nom?.toLowerCase().includes(search) ||
        avoir.client?.nomSociete?.toLowerCase().includes(search)
      );
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.statut === statusFilter);
    }

    return filtered;
  }, [avoirs, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAvoirs.length / ITEMS_PER_PAGE));
  const paginatedAvoirs = filteredAvoirs.slice(
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

  const totalAvoirsGlobal = filteredAvoirs.reduce((sum, a) => sum + a.montantTtc, 0);
  const avoirsCount = filteredAvoirs.length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthAvoirs = avoirs.filter(a => new Date(a.dateEmission) >= monthStart);
  const monthTotal = monthAvoirs.reduce((sum, a) => sum + a.montantTtc, 0);
  const monthCount = monthAvoirs.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer l'avoir"
        description="Êtes-vous sûr de vouloir supprimer cet avoir ? Cette action est irréversible."
      />
      <div style={{ display: 'none' }}>
        {printingAvoir && (
          <FactureDocument ref={printRef} facture={printingAvoir} entreprise={entreprise} />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-orange-500/10 dark:border-orange-500/20 bg-orange-50 border border-orange-200/50">
          <RotateCcw className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Avoirs</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les avoirs liés aux factures annulées
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Rechercher par numéro, facture ou client..."
                className="pl-9 h-10 dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[160px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
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
          </div>

          {/* Table */}
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b dark:border-white/5 border-slate-100">
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Client</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Avoir</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Facture d'origine</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">Date</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Montant TTC</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">Statut</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Chargement des avoirs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedAvoirs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                          <RotateCcw className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                        </div>
                        <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                          {searchQuery || statusFilter !== 'all'
                            ? 'Aucun avoir trouvé'
                            : 'Aucun avoir créé'}
                        </p>
                        {!searchQuery && statusFilter === 'all' && (
                          <p className="text-xs dark:text-muted-foreground text-slate-400 max-w-xs text-center">
                            Les avoirs sont générés automatiquement lors de l'annulation d'une facture.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAvoirs.map((avoir) => {
                    const status = getStatusConfig(avoir.statut);
                    const clientInitial = (avoir.client?.nom || '?').charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={avoir.id}
                        className="border-b dark:border-white/5 border-slate-100"
                      >
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="h-8 w-8 dark:border-white/10 border border-slate-200">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avoir.client?.nom}`} />
                              <AvatarFallback className="text-xs font-semibold dark:bg-slate-800 dark:text-muted-foreground bg-slate-100 text-slate-600">
                                {clientInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">
                                {avoir.client?.nom || avoir.client?.nomSociete || '-'}
                              </p>
                              <p className="text-xs dark:text-muted-foreground text-slate-400">
                                {avoir.client?.email || avoir.numero}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{avoir.numero || '-'}</span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm font-mono font-medium dark:text-emerald-400 dark:bg-emerald-500/10 text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {avoir.facture?.numero || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-sm dark:text-muted-foreground text-slate-500">
                            {avoir.dateEmission ? format(new Date(avoir.dateEmission), 'dd MMM yyyy', { locale: fr }) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <span className="text-sm font-bold text-red-500 dark:text-red-400">{formatCurrency(avoir.montantTtc)}</span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                            status.bgColor
                          )}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                              onClick={() => handleDownload(avoir)}
                              title="Télécharger PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                              onClick={() => {
                                setAvoirToDelete(avoir.id);
                                setDeleteConfirmOpen(true);
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!isLoading && paginatedAvoirs.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                <p className="text-xs dark:text-muted-foreground text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAvoirs.length)} sur {filteredAvoirs.length}
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

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">
            <CardHeader className="px-4 py-4 border-b dark:border-white/5 border-slate-100">
              <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">Activité des Avoirs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-orange-50 border border-orange-200/50 shrink-0">
                  <Receipt className="h-4 w-4 dark:text-primary text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">Total Avoirs (Mois en cours)</p>
                  <p className="text-lg font-bold text-red-500 dark:text-red-400">{formatCurrency(monthTotal)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-orange-50 border border-orange-200/50 shrink-0">
                  <RotateCcw className="h-4 w-4 dark:text-primary text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">Nombre de retours</p>
                  <p className="text-lg font-bold dark:text-card-foreground text-slate-800">{monthCount} retour{monthCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="border-t dark:border-white/5 border-slate-100 pt-4">
                <div className="rounded-sm dark:bg-amber-500/10 dark:border-amber-500/20 bg-amber-50 border border-amber-200/50 p-3 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold dark:text-amber-400 text-amber-800">Impact sur le CA</p>
                    <p className="text-[11px] dark:text-amber-400/80 text-amber-700/80 leading-relaxed mt-0.5">
                      Les avoirs viennent en déduction de votre chiffre d'affaires du mois.
                    </p>
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

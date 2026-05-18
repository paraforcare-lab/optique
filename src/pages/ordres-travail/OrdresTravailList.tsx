import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, FileEdit, Trash2, Eye, ArrowLeft, ChevronLeft, ChevronRight,
  FlaskConical, CalendarDays, Send, Package, Wrench, CheckCircle2, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { toast } from 'sonner'
import { OrdreTravailForm } from '@/components/forms/OrdreTravailForm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface OrdreTravail {
  id: number;
  numero_ordre: string;
  client_id: number;
  client_nom?: string;
  date_creation: string;
  date_souhaitee: string;
  statut: string;
  monture_designation?: string;
  verre_designation?: string;
  prix_vente_ht: number;
  taux_tva: number;
  created_at: string;
}

const STATUTS = ['brouillon', 'envoye_labo', 'reçu_labo', 'montage', 'controle', 'termine', 'annule'] as const;

const statutConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  brouillon:    { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200/50 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20', icon: FileEdit },
  envoye_labo:  { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20', icon: Send },
  reçu_labo:    { color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200/50 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20', icon: Package },
  montage:      { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20', icon: Wrench },
  controle:     { color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200/50 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20', icon: Eye },
  termine:      { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20', icon: CheckCircle2 },
  annule:       { color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20', icon: Ban },
};

const ITEMS_PER_PAGE = 10;

export function OrdresTravailList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrdreTravail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdreTravail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    if (!user?.id) { setOrders([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordres_travail')
        .select('*, clients!inner(nom)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) { toast.error(t('ordres_travail.toast_load_error')); setOrders([]); setIsLoading(false); return; }

      const mapped = (data || []).map((o: any) => ({
        ...o,
        client_nom: o.clients?.nom || `#${o.client_id}`,
      }));
      setOrders(mapped);
    } catch { setOrders([]); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (user?.id) fetchOrders(); }, [user?.id]);

  const handleDelete = async () => {
    if (!orderToDelete || !user?.id) return;
    try {
      const { error } = await supabase.from('ordres_travail').delete().eq('id', orderToDelete);
      if (error) throw error;
      toast.success(t('ordres_travail.toast_deleted'));
      fetchOrders();
    } catch (err: any) { toast.error(err.message || t('shared.toast.delete_error')); }
    finally { setDeleteConfirmOpen(false); setOrderToDelete(null); }
  };

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') result = result.filter((o) => o.statut === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) =>
        o.numero_ordre?.toLowerCase().includes(q) ||
        o.client_nom?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const closeForm = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  const StatutBadge = ({ statut }: { statut: string }) => {
    const cfg = statutConfig[statut] || statutConfig.brouillon;
    const Icon = cfg.icon;
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border", cfg.bg, cfg.color)}>
        <Icon className="h-3 w-3" />
        {t(`ordres_travail.statut_${statut}`)}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_order') || "Supprimer l'ordre"}
        description={t('shared.confirm_delete.body_order') || "Cette action est irréversible."}
      />

      {showForm ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {editingOrder ? t('ordres_travail.dialog_edit') : t('ordres_travail.dialog_create')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {editingOrder ? t('ordres_travail.dialog_subtitle_edit', { numero: editingOrder.numero_ordre }) : t('ordres_travail.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-[6px] border border-slate-200 bg-white p-8 dark:bg-[#0F172A] dark:border-white/10">
            <OrdreTravailForm
              initialData={editingOrder}
              onSuccess={() => { closeForm(); fetchOrders(); }}
            />
          </div>
        </div>
      ) : (
        <>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-amber-50 border border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20">
            <FlaskConical className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('ordres_travail.page_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('ordres_travail.page_subtitle')}</p>
          </div>
        </div>

            <Button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-[4px] h-10 px-5 shadow-none">
              <Plus className="mr-2 h-4 w-4" />{t('ordres_travail.new_button')}
            </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input type="text" placeholder={t('ordres_travail.search_ph')}
            className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] text-sm dark:bg-[#0F172A] dark:border-white/10 dark:text-white"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-10 bg-white border-slate-200 rounded-[4px] dark:bg-[#0F172A] dark:border-white/10">
            <SelectValue placeholder={t('ordres_travail.filter_all_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ordres_travail.filter_all_status')}</SelectItem>
            {STATUTS.map((s) => (
              <SelectItem key={s} value={s}>{t(`ordres_travail.statut_${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:bg-[#0F172A] dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 dark:border-white/5">
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_numero')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_client')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_date_creation')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_date_souhaitee')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_monture')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_verre')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('ordres_travail.col_status')}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right dark:text-slate-400">{t('ordres_travail.col_actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">{t('shared.empty.loading')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-[#0F172A]/40 dark:border-white/10">
                      <FlaskConical className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      {searchQuery || statusFilter !== 'all' ? t('ordres_travail.empty_filtered') : t('ordres_travail.empty_all')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((o) => (
                <TableRow key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]">
                  <TableCell className="px-4 py-4">
                    <span className="text-sm font-mono font-semibold text-slate-800 dark:text-white">{o.numero_ordre}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{o.client_nom || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{o.date_creation || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{o.date_souhaitee || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{o.monture_designation || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{o.verre_designation || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <StatutBadge statut={o.statut} />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px]"
                        onClick={() => { setEditingOrder(o); setShowForm(true); }}>
                        <FileEdit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px]"
                        onClick={() => { setOrderToDelete(o.id); setDeleteConfirmOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && paginated.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
            <p className="text-xs text-slate-400">{(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[4px]" disabled={currentPage === 1}
                onClick={() => { if (currentPage > 1) setCurrentPage(currentPage - 1); }}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button key={page} variant="ghost" size="sm"
                  className={cn("h-8 min-w-[32px] rounded-[4px] text-sm font-medium",
                    page === currentPage ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white" : "text-slate-400"
                  )}
                  onClick={() => setCurrentPage(page)}>{page}</Button>
              ))}
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[4px]" disabled={currentPage === totalPages}
                onClick={() => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </Card>
        </>
      )}
    </div>
  );
}

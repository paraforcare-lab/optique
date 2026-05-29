import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Trash2, ShoppingCart, Receipt, CreditCard, X, ArrowLeft,
  ShoppingBag, CalendarDays, Filter, ChevronLeft, ChevronRight,
  Printer, Eye, User, TrendingUp, DollarSign, FileSpreadsheet, Package,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'
import { ProductSelector } from '@/components/ui/ProductSelector'
import { generateDocumentNumber } from '@/lib/numbering'

interface VentePassager {
  id: string;
  numero: string;
  date: string;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  cogs?: number;
  lignes: any[];
}

interface Produit {
   id: number | string;
   nom?: string;
   designation?: string;
   reference?: string;
   prixVenteHt: number;
   prix_vente_ht?: number;
   prixVenteTtc?: number;
   prix_vente_ttc?: number;
   tauxTva: number;
   tva?: number;
   stockActuel: number;
   stock_actuel?: number;
   prixAchatHt?: number;
   prix_achat_ht?: number;
   marque?: string;
   imageUrl?: string;
   image_url?: string;
 }

const ITEMS_PER_PAGE = 10;

export default function VentesPassagers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ventes, setVentes] = useState<VentePassager[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [detailVente, setDetailVente] = useState<VentePassager | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const mapProduit = (p: any) => ({
    ...p,
    id: p.id,
    reference: p.reference || '',
    designation: p.designation || p.nom || '',
    marque: p.marque || '',
    prixVenteHt: Number(p.prix_vente_ht || p.prixVenteHt || 0),
    prixVenteTtc: Number(p.prix_vente_ttc || 0),
    prixAchatHt: Number(p.prix_achat_ht || p.prixAchatHt || 0),
    tauxTva: Number(p.taux_tva || p.tva || 20),
    stockActuel: Number(p.stock_actuel || p.stockActuel || 0),
    imageUrl: p.image_url || p.imageUrl || undefined,
  });

  const [panier, setPanier] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchVentes();
      fetchProduits();
    }
  }, [user?.id]);

  const fetchVentes = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('ventes_passagers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mappedData = (data || []).map((v: any) => ({
        ...v,
        id: v.id,
        numero: v.numero || '',
        date: v.date || v.created_at,
        montantHt: Number(v.montant_ht || v.montantHt || 0),
        montantTva: Number(v.montant_tva || v.montantTva || 0),
        montantTtc: Number(v.montant_ttc || v.montantTtc || 0),
        cogs: Number(v.cogs || 0),
      }));

      setVentes(mappedData);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error(t('ventes.toast_load_error'));
      setVentes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProduits = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', user.id)
        .order('designation');
      if (error) throw error;
      setProduits(Array.isArray(data) ? data.map(mapProduit) : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('ventes.toast_load_error'));
      setProduits([]);
    }
  };

  const removeFromPanier = (index: number) => {
    setPanier(panier.filter((_, i) => i !== index));
  };

  const closeForm = () => {
    setShowForm(false);
    setPanier([]);
  };

  const handleSubmit = async () => {
    if (panier.length === 0) {
      toast.error(t('ventes.toast_cart_empty'));
      return;
    }

    const totalHt = panier.reduce((sum, item) => sum + item.montantHt, 0);
    const totalTva = panier.reduce((sum, item) => sum + item.montantTva, 0);
    const totalTtc = panier.reduce((sum, item) => sum + item.montantTtc, 0);
    const totalCogs = panier.reduce((sum, item) => sum + (Number(item.prixAchatHt || 0) * item.quantite), 0);

    try {
      const numero = await generateDocumentNumber('vente_passager', user!.id);

      const { data: venteData, error: venteError } = await supabase
        .from('ventes_passagers')
        .insert([{
          user_id: user?.id,
          numero: numero,
          montant_ht: totalHt,
          montant_tva: totalTva,
          montant_ttc: totalTtc,
          cogs: totalCogs,
          date: new Date().toISOString(),
        }])
        .select()
        .single();

      if (venteError) throw venteError;

      const lignesPayload = panier.map((item, index) => ({
        vp_id: venteData.id,
        produit_id: item.produitId,
        designation: item.designation,
        quantite: item.quantite,
        prix_unitaire_ht: item.prixUnitaireHt,
        tva: item.tva,
        montant_ht: item.montantHt,
        montant_ttc: item.montantTtc,
        montant_tva: item.montantTva,
        ordre: index,
      }));

      if (lignesPayload.length > 0) {
        const { error: lignesError } = await supabase.from('ventes_passagers_lignes').insert(lignesPayload);
        if (lignesError) throw lignesError;
      }

      for (const item of panier) {
        await updateStockAndNotify(user?.id, item.produitId, -item.quantite, {
          sourceDocumentType: 'vente_passager',
          sourceDocumentRef: `${numero} (#${venteData.id})`,
        });
      }
      await ensureLowStockNotifications(user?.id);

      toast.success(t('ventes.toast_sale_success'));
      setShowForm(false);
      setPanier([]);
      fetchVentes();
      fetchProduits();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || t('ventes.toast_save_error'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ventes-passagers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(t('ventes.toast_deleted'));
      fetchVentes();
    } catch (error) {
      toast.error(t('ventes.toast_delete_error'));
    }
  };

  const handlePrint = (vente: VentePassager) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('ventes.toast_popup_blocked'));
      return;
    }
    printWindow.document.write(`
      <html><head><title>Ticket ${vente.numero}</title>
      <style>body{font-family:monospace;font-size:14px;padding:20px;max-width:300px;margin:auto}
      h2{text-align:center;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{text-align:left;padding:4px 0}
      .total{font-weight:bold;font-size:16px;margin-top:12px;text-align:right;border-top:2px solid #000;padding-top:8px}
      .footer{text-align:center;margin-top:20px;font-size:12px;color:#666}
      </style></head><body>
      <h2>Ticket de Vente</h2>
      <p><strong>${vente.numero}</strong></p>
      <p>${new Date(vente.date).toLocaleDateString(dateBcp47, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <table>
        <tr><th>Total HT</th><td style="text-align:right">${formatCurrency(vente.montantHt)}</td></tr>
        <tr><th>TVA</th><td style="text-align:right">${formatCurrency(vente.montantTva)}</td></tr>
      </table>
      <div class="total">Total TTC : ${formatCurrency(vente.montantTtc)}</div>
      <div class="footer">Merci de votre visite!</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredVentes = useMemo(() => {
    let filtered = ventes.filter(v => {
      const searchLower = searchTerm.toLowerCase().trim();
      if (!searchLower) return true;
      const matchesNumero = (v.numero || '').toLowerCase().includes(searchLower);
      const matchesDate = v.date && new Date(v.date).toLocaleDateString(dateBcp47).includes(searchLower);
      return matchesNumero || matchesDate;
    });

    if (timeFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (timeFilter) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'thisWeek':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          cutoff = weekAgo;
          break;
        case 'thisMonth':
          cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          cutoff = new Date(0);
      }
      filtered = filtered.filter(v => new Date(v.date) >= cutoff);
    }

    return filtered;
  }, [ventes, searchTerm, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVentes.length / ITEMS_PER_PAGE));
  const paginatedVentes = filteredVentes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeFilter]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleViewDetail = async (vente: VentePassager) => {
    try {
      const { data: lignes } = await supabase
        .from('ventes_passagers_lignes')
        .select('*')
        .eq('vp_id', vente.id)
        .order('ordre');
      setDetailVente({ ...vente, lignes: lignes || [] });
      setIsDetailOpen(true);
    } catch {
      toast.error(t('ventes.toast_detail_error'));
    }
  };

  // ─── Sidebar period switcher ─────────────────────────────────────────────
  type SidebarPeriod = 'today' | 'thisMonth' | 'thisYear' | 'all'
  const [sidebarPeriod, setSidebarPeriod] = useState<SidebarPeriod>('today')

  // Locale helper for date formatting (matches the active UI language)
  const { i18n } = useTranslation()
  const dateBcp47 = i18n.language?.startsWith('ar') ? 'ar-MA'
    : i18n.language?.startsWith('en') ? 'en-US'
    : 'fr-FR'

  const totalVentes = ventes.reduce((sum, v) => sum + (v.montantTtc || 0), 0);

  // Cutoff dates for each period
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)

  function getCutoff(period: SidebarPeriod): Date {
    switch (period) {
      case 'today':     return todayStart
      case 'thisMonth': return monthStart
      case 'thisYear':  return yearStart
      default:          return new Date(0)
    }
  }

  // Filtered list for the currently selected sidebar period
  const sidebarVentes = useMemo(() => {
    const cutoff = getCutoff(sidebarPeriod)
    return ventes.filter(v => new Date(v.date) >= cutoff)
  }, [ventes, sidebarPeriod])

  const sidebarCount   = sidebarVentes.length
  const sidebarRevenue = sidebarVentes.reduce((sum, v) => sum + (v.montantTtc || 0), 0)
  const sidebarAvg     = sidebarCount > 0 ? sidebarRevenue / sidebarCount : 0
  const sidebarTva     = sidebarVentes.reduce((sum, v) => sum + (v.montantTva || 0), 0)

  // Keep a today snapshot for the sparkline (always today regardless of period switch)
  const todayVentesList = ventes.filter(v => new Date(v.date) >= todayStart);
  const todayRevenue    = todayVentesList.reduce((sum, v) => sum + (v.montantTtc || 0), 0);

  // Weekly sparkline data (last 7 days) — labels use the active locale
  const weekDays: { label: string; total: number }[] = useMemo(() => {
    const result: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayTotal = ventes
        .filter(v => {
          const vd = new Date(v.date);
          return vd >= d && vd < next;
        })
        .reduce((s, v) => s + (v.montantTtc || 0), 0);
      result.push({
        label: d.toLocaleDateString(dateBcp47, { weekday: 'short' }).slice(0, 3),
        total: dayTotal,
      });
    }
    return result;
  }, [ventes, dateBcp47]);

  const maxSparkValue = Math.max(...weekDays.map(d => d.total), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {showForm ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{t('ventes.dialog_create')}</h2>
              <p className="text-sm text-muted-foreground">{t('ventes.dialog_subtitle_create')}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Section 1: Information de Vente */}
            <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">{t('ventes.sale_info')}</span>
              </div>
              <div className="p-6 space-y-4">
                <ProductSelector
                  produits={produits}
                  onSelect={(produit, qte) => {
                    const puHt = Number(produit.prixVenteHt ?? 0);
                    const tvaRate = Number(produit.tauxTva ?? 20);
                    const mht = puHt * qte;
                    const mtva = mht * (tvaRate / 100);
                    const mttc = mht + mtva;

                    const existingIndex = panier.findIndex(item => Number(item.produitId) === Number(produit.id));
                    if (existingIndex >= 0) {
                      const existing = panier[existingIndex];
                      const newQte = existing.quantite + qte;
                      const newMht = existing.prixUnitaireHt * newQte;
                      const newMtva = newMht * (existing.tva / 100);
                      const newMttc = newMht + newMtva;

                      setPanier(panier.map((item, idx) =>
                        idx === existingIndex
                          ? { ...item, quantite: newQte, montantHt: newMht, montantTva: newMtva, montantTtc: newMttc }
                          : item
                      ));
                    } else {
                      setPanier([...panier, {
                        produitId: produit.id,
                        designation: produit.designation || t('shared.table.product'),
                        quantite: qte,
                        prixUnitaireHt: puHt,
                        tva: tvaRate,
                        montantHt: mht,
                        montantTva: mtva,
                        montantTtc: mttc,
                        prixAchatHt: Number(produit.prixAchatHt ?? 0)
                      }]);
                    }
                    toast.success(t('ventes.toast_item_added', { name: produit.designation || t('shared.table.product') }));
                  }}
                  trigger={
                    <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-sm shadow-none text-base">
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {t('ventes.select_product')}
                    </Button>
                  }
                />
                <p className="text-xs text-slate-400 text-center">
                  {t('ventes.select_product_hint')}
                </p>
              </div>
            </div>

            {/* Section 2: Panier */}
            <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <Package className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">
                    {t('ventes.cart_title')} <span className="text-slate-400 font-normal">({t(panier.length === 1 ? 'ventes.cart_item_one' : 'ventes.cart_item_other', { count: panier.length })})</span>
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="rounded-sm dark:border-white/10 border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/30">
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4">{t('ventes.col_designation')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_qty')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_unit_price')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_vat')}</TableHead>
                        <TableHead className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-5 py-4 text-right">{t('ventes.col_total')}</TableHead>
                        <TableHead className="w-14 px-5 py-4"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {panier.map((item, index) => (
                        <TableRow key={index} className="border-b dark:border-white/10 border-slate-100 last:border-0">
                          <TableCell className="px-5 py-4">
                            <p className="text-sm font-medium dark:text-card-foreground text-slate-800">{item.designation}</p>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2.5 rounded-sm dark:bg-slate-800 bg-slate-100 text-sm font-bold dark:text-card-foreground text-slate-700">{item.quantite}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.prixUnitaireHt}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setPanier(panier.map((it, idx) =>
                                  idx === index
                                    ? { ...it, prixUnitaireHt: v, montantHt: v * it.quantite, montantTva: (v * it.quantite) * (it.tva / 100), montantTtc: (v * it.quantite) * (1 + it.tva / 100) }
                                    : it
                                ));
                              }}
                              className="h-8 w-24 text-right text-sm bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10"
                            />
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right text-sm dark:text-muted-foreground text-slate-500">{item.tva}%</TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(item.montantTtc)}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[8px]" onClick={() => removeFromPanier(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {panier.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16">
                            <div className="flex flex-col items-center gap-4">
                              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300">
                                <rect x="10" y="26" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                <path d="M8 22C8 19.7909 9.79086 18 12 18H60C62.2091 18 64 19.7909 64 22V26H8V22Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                <path d="M26 34H46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <path d="M22 42H50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <path d="M24 50H36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
                                <circle cx="38" cy="14" r="3" fill="#10B981" stroke="white" strokeWidth="1.5" />
                              </svg>
                              <div>
                                <p className="text-sm font-semibold text-slate-500">{t('ventes.cart_empty_title')}</p>
                                <p className="text-xs text-slate-400 mt-1">{t('ventes.cart_empty_hint')}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {panier.length > 0 && (
                <div className="px-6 py-4 border-t dark:border-white/10 border-slate-100 dark:bg-card bg-slate-50/50">
                  <div className="flex justify-end">
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider">{t('ventes.total_ht')}</p>
                        <p className="text-lg font-bold dark:text-card-foreground text-slate-800">{formatCurrency(panier.reduce((sum, i) => sum + i.montantHt, 0))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider">{t('ventes.total_vat')}</p>
                        <p className="text-lg font-bold dark:text-card-foreground text-slate-800">{formatCurrency(panier.reduce((sum, i) => sum + i.montantTva, 0))}</p>
                      </div>
                      <div className="text-right border-l border-emerald-200 pl-8">
                        <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">{t('ventes.total_ttc')}</p>
                        <p className="text-2xl font-black text-emerald-600">{formatCurrency(panier.reduce((sum, i) => sum + i.montantTtc, 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={closeForm}
                className="h-10 px-5 rounded-sm dark:border-white/10 dark:text-muted-foreground border-slate-300 text-slate-600 font-semibold text-sm shadow-none">
                {t('ventes.btn_cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={panier.length === 0}
                className="h-10 px-5 rounded-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-none">
                <CreditCard className="mr-2 h-4 w-4" />
                {t('ventes.btn_validate')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-emerald-500/10 dark:border-emerald-500/20 bg-blue-50 border border-blue-200/50">
            <ShoppingBag className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('ventes.page_title')}</h2>
            <p className="text-sm text-muted-foreground">{t('ventes.page_subtitle')}</p>
          </div>
        </div>

            <Button onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-sm h-10 px-5 shadow-none">
              <Plus className="mr-2 h-4 w-4" />
              {t('ventes.new_button')}
            </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-muted-foreground text-slate-400" />
              <Input
                type="text"
                placeholder={t('ventes.search_ph')}
                className="pl-9 h-10 dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm focus:border-slate-300 shadow-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-[150px] dark:bg-slate-900/50 dark:border-white/5 bg-white border-slate-200 rounded-sm shadow-none text-sm">
                <CalendarDays className="h-3.5 w-3.5 dark:text-muted-foreground text-slate-400 mr-2" />
                <SelectValue placeholder={t('ventes.filter_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ventes.filter_all')}</SelectItem>
                <SelectItem value="today">{t('ventes.filter_today')}</SelectItem>
                <SelectItem value="thisWeek">{t('ventes.filter_week')}</SelectItem>
                <SelectItem value="thisMonth">{t('ventes.filter_month')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sales Table */}
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b dark:border-white/5 border-slate-100">
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_client')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_number')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3">{t('ventes.col_date')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('ventes.col_details')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-center">{t('ventes.col_status')}</TableHead>
                  <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider px-4 py-3 text-right">{t('ventes.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('ventes.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedVentes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="dark:bg-white/5 dark:border-white/10 bg-slate-50 rounded-sm p-4 border border-slate-100">
                          <Receipt className="h-8 w-8 dark:text-muted-foreground text-slate-300" />
                        </div>
                        <p className="text-sm dark:text-muted-foreground text-slate-500 font-medium">
                          {searchTerm || timeFilter !== 'all'
                            ? t('ventes.empty_filtered')
                            : t('ventes.empty_all')}
                        </p>
                        {!searchTerm && timeFilter === 'all' && (
                          <Button
                            variant="outline"
                            className="mt-1 rounded-sm text-sm"
                            onClick={() => setShowForm(true)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('ventes.create_first')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVentes.map((vente) => (
                    <TableRow
                      key={vente.id}
                      className="border-b dark:border-white/5 border-slate-100"
                    >
                      <TableCell className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full dark:bg-slate-800 dark:border-white/10 bg-slate-100 border border-slate-200">
                            <User className="h-4 w-4 dark:text-muted-foreground text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold dark:text-card-foreground text-slate-800">{t('ventes.walk_in_client')}</p>
                            <p className="text-xs dark:text-muted-foreground text-slate-400">{t('ventes.counter_sale')}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="text-sm font-mono font-medium dark:text-card-foreground text-slate-700">{vente.numero}</span>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <span className="text-sm dark:text-muted-foreground text-slate-500">
                          {new Date(vente.date).toLocaleDateString(dateBcp47, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold dark:text-card-foreground text-slate-800">{formatCurrency(vente.montantTtc)}</span>
                          <span className="text-[11px] dark:text-muted-foreground text-slate-400">
                            HT: {formatCurrency(vente.montantHt)} · TVA: {formatCurrency(vente.montantTva)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t('ventes.status_completed')}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                            onClick={() => handlePrint(vente)}
                            title={t('shared.actions.print_receipt')}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 dark:text-muted-foreground dark:hover:text-card-foreground dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-sm"
                            onClick={() => handleViewDetail(vente)}
                            title={t('shared.actions.view_detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-sm"
                            onClick={() => handleDelete(vente.id?.toString())}
                            title={t('shared.actions.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {!loading && paginatedVentes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-white/5 border-slate-100">
                <p className="text-xs dark:text-muted-foreground text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredVentes.length)} {t('shared.pagination.of')} {filteredVentes.length}
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

        {/* Right Column - Summary */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border dark:border-white/10 border-slate-200 shadow-none rounded-sm">

            {/* ── Card header: title + period toggle buttons ─────────── */}
            <CardHeader className="px-4 py-3 border-b dark:border-white/5 border-slate-100 space-y-3">
              <CardTitle className="text-sm font-semibold dark:text-card-foreground text-slate-700">
                {t(`ventes.sidebar_title_${sidebarPeriod}`)}
              </CardTitle>

              {/* Period toggle pill group */}
              <div className="flex items-center gap-1 p-0.5 rounded-sm bg-slate-100 dark:bg-white/5 w-full">
                {([ 'today', 'thisMonth', 'thisYear', 'all' ] as SidebarPeriod[]).map((period) => {
                  const labelKey = {
                    today:     'ventes.sidebar_period_today',
                    thisMonth: 'ventes.sidebar_period_month',
                    thisYear:  'ventes.sidebar_period_year',
                    all:       'ventes.sidebar_period_all',
                  }[period]
                  const isActive = sidebarPeriod === period
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSidebarPeriod(period)}
                      className={cn(
                        'flex-1 text-[10px] font-semibold px-1 py-1 rounded-[3px] transition-all duration-150 truncate',
                        isActive
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                      )}
                    >
                      {t(labelKey)}
                    </button>
                  )
                })}
              </div>
            </CardHeader>

            <CardContent className="px-4 py-4 space-y-5">

              {/* Sales count */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-blue-50 border border-blue-200/50 shrink-0">
                  <ShoppingBag className="h-4 w-4 dark:text-primary text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">
                    {t('ventes.sidebar_sales_count')}
                  </p>
                  <p className="text-lg font-bold dark:text-card-foreground text-slate-800" dir="ltr">
                    {sidebarCount}{' '}
                    <span className="text-sm font-normal text-slate-400 dark:text-muted-foreground">
                      {sidebarCount === 1
                        ? t('ventes.sidebar_sale_one')
                        : t('ventes.sidebar_sale_other')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Revenue */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-sm dark:bg-primary/10 dark:border-primary/20 bg-blue-50 border border-blue-200/50 shrink-0">
                  <DollarSign className="h-4 w-4 dark:text-primary text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs dark:text-muted-foreground text-slate-500">
                    {t('ventes.sidebar_revenue')}
                  </p>
                  <p className="text-lg font-bold text-emerald-600" dir="ltr">
                    {formatCurrency(sidebarRevenue)}
                  </p>
                </div>
              </div>

              {/* Average basket + VAT */}
              <div className="border-t dark:border-white/5 border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs dark:text-muted-foreground text-slate-500 truncate">
                    {t('ventes.sidebar_avg')}
                  </p>
                  <p className="text-sm font-bold dark:text-card-foreground text-slate-800 shrink-0" dir="ltr">
                    {formatCurrency(sidebarAvg)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs dark:text-muted-foreground text-slate-500 truncate">
                    {t('ventes.sidebar_vat')}
                  </p>
                  <p className="text-sm font-semibold dark:text-muted-foreground text-slate-600 shrink-0" dir="ltr">
                    {formatCurrency(sidebarTva)}
                  </p>
                </div>
              </div>

              {/* Weekly sparkline — always shows last 7 days regardless of period */}
              <div className="border-t dark:border-white/5 border-slate-100 pt-4">
                <p className="text-[11px] font-semibold dark:text-muted-foreground text-slate-500 uppercase tracking-wider mb-3">
                  {t('ventes.sidebar_trend')}
                </p>
                {/* Sparkline SVG is direction-independent; wrap in dir=ltr so SVG
                    coordinates are not mirrored by the parent RTL context */}
                <div dir="ltr">
                  <svg viewBox="0 0 200 60" className="w-full h-16">
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const points = weekDays.map((d, i) => ({
                        x: (i / (weekDays.length - 1)) * 180 + 10,
                        y: 55 - (d.total / maxSparkValue) * 40,
                      }));
                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                      const areaPath = linePath + ` L${points[points.length - 1].x},55 L${points[0].x},55 Z`;
                      return (
                        <>
                          <path d={areaPath} fill="url(#sparkGrad)" />
                          <path d={linePath} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10B981" stroke="white" strokeWidth="1.5" />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="flex justify-between mt-1">
                    {weekDays.map((d, i) => (
                      <span key={i} className="text-[10px] dark:text-muted-foreground text-slate-400">
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-sm dark:bg-emerald-500/10 dark:border-emerald-500/20 bg-blue-50 border border-blue-200/50">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">{t('ventes.detail_title')}</DialogTitle>
                <p className="text-sm text-muted-foreground">{detailVente?.numero}</p>
              </div>
            </div>
          </DialogHeader>
          {detailVente && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4" />
                {new Date(detailVente.date).toLocaleDateString(dateBcp47, {
                  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>

              {detailVente.lignes && detailVente.lignes.length > 0 && (
                <div className="rounded-sm dark:border-white/10 border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b dark:border-white/10 border-slate-100">
                        <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase">{t('ventes.detail_col_product')}</TableHead>
                        <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase text-right">{t('ventes.detail_col_qty')}</TableHead>
                        <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase text-right">{t('ventes.detail_col_price')}</TableHead>
                        <TableHead className="text-xs font-semibold dark:text-muted-foreground text-slate-500 uppercase text-right">{t('ventes.detail_col_total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailVente.lignes.map((l: any, i: number) => (
                        <TableRow key={i} className="border-b dark:border-white/10 border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm dark:text-card-foreground">{l.designation || t('shared.table.product')}</TableCell>
                          <TableCell className="py-3 text-right text-sm font-medium dark:text-card-foreground">{l.quantite}</TableCell>
                          <TableCell className="py-3 text-right text-sm dark:text-muted-foreground text-slate-500">{formatCurrency(l.prix_unitaire_ht || 0)}</TableCell>
                          <TableCell className="py-3 text-right text-sm font-bold dark:text-card-foreground">{formatCurrency(l.montant_ttc || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-100 bg-slate-50/50 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-muted-foreground text-slate-500">{t('ventes.detail_total_ht')}</span>
                  <span className="font-medium dark:text-card-foreground text-slate-800">{formatCurrency(detailVente.montantHt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="dark:text-muted-foreground text-slate-500">{t('ventes.detail_total_vat')}</span>
                  <span className="font-medium dark:text-card-foreground text-slate-800">{formatCurrency(detailVente.montantTva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1.5 border-t dark:border-white/10 border-slate-200">
                  <span className="dark:text-card-foreground text-slate-800">{t('ventes.detail_total_ttc')}</span>
                  <span className="text-emerald-600">{formatCurrency(detailVente.montantTtc)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              className="rounded-sm h-10 dark:border-white/10 dark:text-muted-foreground"
            >
              {t('shared.actions.close')}
            </Button>
            {detailVente && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm h-10 shadow-none"
                onClick={() => { handlePrint(detailVente); setIsDetailOpen(false); }}
              >
                <Printer className="mr-2 h-4 w-4" />
                {t('shared.actions.print_receipt')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

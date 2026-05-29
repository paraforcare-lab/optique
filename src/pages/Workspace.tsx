import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  Plus, FileText, Users, Package, CheckCircle2, TrendingUp,
  Trash2, ShoppingCart, Box, CreditCard, Bell,
  DollarSign, AlertTriangle, Target, ChevronRight, TrendingDown, Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string | number;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

type StockStatus = 'rupture' | 'critique' | 'faible' | 'moyen' | 'stable';

interface InventoryItem {
  id: string;
  name: string;
  reference: string;
  stockActuel: number;
  stockMin: number;
  unite: string;
  status: StockStatus;
  percentage: number;
}

// ─── Stock Config ─────────────────────────────────────────────────────────────
// Labels are now resolved dynamically via t() at render time; only styling here.

const stockStyleConfig: Record<StockStatus, { barColor: string; badgeClass: string }> = {
  rupture:  { barColor: 'bg-red-500',     badgeClass: 'bg-red-50 text-red-600 border-red-200/70 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
  critique: { barColor: 'bg-red-500',     badgeClass: 'bg-red-50 text-red-600 border-red-200/70 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
  faible:   { barColor: 'bg-amber-500',   badgeClass: 'bg-amber-50 text-amber-600 border-amber-200/70 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
  moyen:    { barColor: 'bg-[#6D5BF6]',   badgeClass: 'bg-[#EEEDFB] text-[#4A3FCF] border-[#D4CCFF] dark:bg-[#6D5BF6]/10 dark:text-[#A78BFA] dark:border-[#6D5BF6]/20' },
  stable:   { barColor: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
};

function getStockInfo(actuel: number, min: number): { status: StockStatus; percentage: number } {
  if (actuel <= 0) return { status: 'rupture', percentage: 0 };
  const max = Math.max(min * 3, 1);
  const pct = Math.min(100, Math.round((actuel / max) * 100));
  if (actuel <= min)        return { status: 'critique', percentage: pct };
  if (actuel <= min * 1.5)  return { status: 'faible',   percentage: pct };
  if (actuel <= min * 2.5)  return { status: 'moyen',    percentage: pct };
  return { status: 'stable', percentage: pct };
}

// ─── Quick Action & AI Reco configs (labels resolved via t() at render time) ──

type QuickActionKey = 'invoice' | 'quote' | 'order' | 'delivery' | 'expense' | 'customer';

const quickActionDefs: Array<{
  key: QuickActionKey;
  icon: React.ElementType;
  href: string;
  iconBg: string;
  iconColor: string;
}> = [
  { key: 'invoice',  icon: FileText,     href: '/factures',       iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',    iconColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'quote',    icon: TrendingUp,   href: '/devis',          iconBg: 'bg-violet-500/10 dark:bg-violet-500/20', iconColor: 'text-violet-600 dark:text-violet-400' },
  { key: 'order',    icon: ShoppingCart, href: '/bons-commande',  iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',  iconColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'delivery', icon: Box,          href: '/bons-livraison', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'expense',  icon: CreditCard,   href: '/depenses',       iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',   iconColor: 'text-rose-600 dark:text-rose-400' },
  { key: 'customer', icon: Users,        href: '/clients',        iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20', iconColor: 'text-indigo-600 dark:text-indigo-400' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function Workspace() {
  const { t, i18n } = useTranslation()

  // Derive direction from live language for sub-component layout decisions
  const isRTL = i18n.language?.startsWith('ar')

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const { user } = useAuth();

  const [stats, setStats] = useState({
    invoiced: 0,
    pending: 0,
    clients: 0,
    products: 0,
    monthlyGrowth: 12.5,
  });
  const [changeStats, setChangeStats] = useState({
    invoicedChange: 0,
    invoicedPositive: true,
    clientsChange: 0,
    productsChange: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedRange, setSelectedRange] = useState('6m');
  const [isLoading, setIsLoading] = useState(true);
  const [newClients, setNewClients] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications-enabled') !== 'false';
  });

  const [expiredOrdonnances, setExpiredOrdonnances] = useState<any[]>([]);
  const [expiredLunettes, setExpiredLunettes] = useState<any[]>([]);
  const [dueExpiredOrdonnances, setDueExpiredOrdonnances] = useState<any[]>([]);
  const [dueExpiredLunettes, setDueExpiredLunettes] = useState<any[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);

  // ─── Month name map (i18n-aware) ───────────────────────────────────────────
  // Used to build chart data labels; re-evaluated when language changes.
  const monthNames = [
    t('workspace.chart.months.jan'),
    t('workspace.chart.months.feb'),
    t('workspace.chart.months.mar'),
    t('workspace.chart.months.apr'),
    t('workspace.chart.months.may'),
    t('workspace.chart.months.jun'),
    t('workspace.chart.months.jul'),
    t('workspace.chart.months.aug'),
    t('workspace.chart.months.sep'),
    t('workspace.chart.months.oct'),
    t('workspace.chart.months.nov'),
    t('workspace.chart.months.dec'),
  ];

  // ─── Notification toggle ───────────────────────────────────────────────────
  const handleToggleNotifications = (checked: boolean) => {
    setNotificationsEnabled(checked);
    localStorage.setItem('notifications-enabled', String(checked));
    window.dispatchEvent(new CustomEvent('notifications-toggle', { detail: { enabled: checked } }));
    toast.success(checked
      ? t('workspace.tasks.notifications_on')
      : t('workspace.tasks.notifications_off')
    );
  };

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);

      const today = new Date().toISOString().split('T')[0]
      const oneMonthLater = new Date()
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)
      const oneMonthLaterStr = oneMonthLater.toISOString().split('T')[0]

      const [factRes, vpRes, depRes, prodRes, cliRes, presRes] = await Promise.all([
        supabase.from('factures').select('*').eq('user_id', user.id),
        supabase.from('ventes_passagers').select('*').eq('user_id', user.id),
        supabase.from('depenses').select('*').eq('user_id', user.id),
        supabase.from('produits').select('*').eq('user_id', user.id),
        supabase.from('clients').select('*').eq('user_id', user.id),
        supabase.from('prescriptions').select('*, clients!inner(nom,genre)').eq('user_id', user.id),
      ]);

      const factures  = (factRes.data  || []);
      const vp        = (vpRes.data    || []);
      const depenses  = (depRes.data   || []);
      const produits  = (prodRes.data  || []);
      const clients   = (cliRes.data   || []);

      const allInvoices   = [...factures, ...vp];
      const validInvoices = allInvoices.filter((f: any) => f.statut !== 'annulée');
      const totalRevenue  = validInvoices.reduce((sum: number, f: any) => sum + Number(f.montant_ttc || 0), 0);

      const monthsToShow = selectedRange === '1m' ? 1 : selectedRange === '1y' ? 12 : 6;
      const chartDataCalc: any[] = [];

      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year  = d.getFullYear();

        const monthRevenue = [
          ...factures.filter((f: any) => new Date(f.date_emission).getMonth() === month && new Date(f.date_emission).getFullYear() === year),
          ...vp.filter((v: any) => new Date(v.date).getMonth() === month && new Date(v.date).getFullYear() === year),
        ].reduce((s: number, f: any) => s + Number(f.montant_ttc || 0), 0);

        const monthExpense = depenses.filter((dep: any) =>
          new Date(dep.date_depense).getMonth() === month && new Date(dep.date_depense).getFullYear() === year
        ).reduce((s: number, dep: any) => s + Number(dep.montant_ttc || 0), 0);

        chartDataCalc.push({
          name: monthNames[month],
          revenue: monthRevenue,
          expenses: monthExpense,
        });
      }

      const periodRevenue  = chartDataCalc.reduce((sum, m) => sum + m.revenue, 0);
      const revenueGrowth  = chartDataCalc.length >= 2
        ? ((chartDataCalc[chartDataCalc.length - 1].revenue - chartDataCalc[chartDataCalc.length - 2].revenue)
           / (chartDataCalc[chartDataCalc.length - 2].revenue || 1)) * 100
        : 0;

      const invoicedPrev = chartDataCalc.length >= 2 ? chartDataCalc[chartDataCalc.length - 2].revenue : 0;
      const invoicedCurr = chartDataCalc.length >= 1 ? chartDataCalc[chartDataCalc.length - 1].revenue : 0;

      setStats({
        invoiced: periodRevenue,
        pending: factures.filter((f: any) => f.statut === 'en_attente' || f.statut === 'reste_a_payer').length,
        clients: clients.length,
        products: produits.length,
        monthlyGrowth: revenueGrowth,
      });

      setChangeStats({
        invoicedChange: invoicedPrev > 0 ? ((invoicedCurr - invoicedPrev) / invoicedPrev) * 100 : 0,
        invoicedPositive: invoicedCurr >= invoicedPrev,
        clientsChange: 0,
        productsChange: 0,
      });

      setChartData(chartDataCalc);

      const invItems: InventoryItem[] = (produits || []).map((p: any) => {
        const info = getStockInfo(Number(p.stock_actuel) || 0, Number(p.stock_min) || 1);
        return {
          id: p.id,
          name: p.nom || p.designation || '',
          reference: p.reference || '',
          stockActuel: Number(p.stock_actuel) || 0,
          stockMin: Number(p.stock_min) || 1,
          unite: p.unite || 'pcs',
          ...info,
        };
      }).sort((a, b) => a.percentage - b.percentage).slice(0, 6);

      setInventoryItems(invItems);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentClients = clients.filter((c: any) => {
        const d = c.created_at || c.date_creation;
        return d && new Date(d) >= thirtyDaysAgo;
      });
      setNewClients(recentClients.length);

      const prescriptions = (presRes.data || [])
      const expiredOrdo = prescriptions.filter((p: any) => p.date_expiration && p.date_expiration < today)
      const dueOrdo = prescriptions.filter((p: any) => p.date_expiration && p.date_expiration >= today && p.date_expiration <= oneMonthLaterStr)
      setExpiredOrdonnances(expiredOrdo)
      setDueExpiredOrdonnances(dueOrdo)

      const expiredLun = clients.filter((c: any) => c.lunette_expiration_date && c.lunette_expiration_date < today)
      const dueLun = clients.filter((c: any) => c.lunette_expiration_date && c.lunette_expiration_date >= today && c.lunette_expiration_date <= oneMonthLaterStr)
      setExpiredLunettes(expiredLun)
      setDueExpiredLunettes(dueLun)

      // Price difference alerts
      const alerts: any[] = []
      const productMap = new Map(produits.map((p: any) => [p.id, p]))

      // Check facture lines vs product sell price
      for (const f of factures) {
        const { data: lignes } = await supabase
          .from('facture_lignes')
          .select('*')
          .eq('facture_id', f.id)
        if (lignes) {
          for (const l of lignes) {
            if (l.produit_id && productMap.has(l.produit_id)) {
              const prod = productMap.get(l.produit_id)
              const currentPrice = Number(prod.prix_vente_ht || 0)
              const docPrice = Number(l.prix_unitaire_ht || 0)
              if (currentPrice > 0 && docPrice > 0 && Math.abs(currentPrice - docPrice) > 0.01) {
                alerts.push({
                  type: 'facture',
                  docNum: f.numero,
                  docDate: f.date_emission,
                  produit: prod.designation || prod.nom || 'Produit',
                  currentPrice,
                  docPrice,
                  difference: docPrice - currentPrice,
                })
              }
            }
          }
        }
      }

      // Check VP lines vs product sell price
      for (const v of vp) {
        const { data: lignes } = await supabase
          .from('ventes_passagers_lignes')
          .select('*')
          .eq('vp_id', v.id)
        if (lignes) {
          for (const l of lignes) {
            if (l.produit_id && productMap.has(l.produit_id)) {
              const prod = productMap.get(l.produit_id)
              const currentPrice = Number(prod.prix_vente_ht || 0)
              const docPrice = Number(l.prix_unitaire_ht || 0)
              if (currentPrice > 0 && docPrice > 0 && Math.abs(currentPrice - docPrice) > 0.01) {
                alerts.push({
                  type: 'vp',
                  docNum: v.numero,
                  docDate: v.date,
                  produit: prod.designation || prod.nom || 'Produit',
                  currentPrice,
                  docPrice,
                  difference: docPrice - currentPrice,
                })
              }
            }
          }
        }
      }

      alerts.sort((a, b) => new Date(b.docDate).getTime() - new Date(a.docDate).getTime())
      setPriceAlerts(alerts.slice(0, 20))
    } catch (error) {
      console.error('Error fetching workspace data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [user, selectedRange, i18n.language]); // re-fetch when language changes to get translated month names

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('workspace-changes')
      .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedRange]);

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const { error } = await supabase.from('tasks').insert([{ title: newTask, completed: false, priority: 'medium' }]);
      if (error) throw error;
      const { data: tasksData } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      setTasks(tasksData || []);
      setNewTask('');
      toast.success(t('workspace.tasks.task_added'));
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(t('workspace.tasks.error_add'));
    }
  };

  const toggleTask = async (id: string | number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id);
      setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error(t('workspace.tasks.error_update'));
    }
  };

  const deleteTask = async (id: string | number) => {
    try {
      await supabase.from('tasks').delete().eq('id', id);
      setTasks(tasks.filter(t => t.id !== id));
      toast.info(t('workspace.tasks.task_deleted'));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('workspace.tasks.error_delete'));
    }
  };

  // ─── Derived metrics (i18n labels resolved here) ──────────────────────────
  // Sparkline datasets for the KPI cards (visual only — derived from existing data,
  // no new business content). Falls back to a gentle synthetic curve when empty.
  const sparkFrom = (vals: number[], fallback: number) => {
    const cleaned = vals.filter((v) => Number.isFinite(v));
    const base = cleaned.length >= 2 ? cleaned : [fallback * 0.55, fallback * 0.7, fallback * 0.62, fallback * 0.85, fallback * 0.9, fallback];
    return base.map((v, idx) => ({ i: idx, v }));
  };
  const revenueSpark = sparkFrom(chartData.map((d) => Number(d.revenue) || 0), Math.max(stats.invoiced, 1));
  const clientsSpark = sparkFrom([], Math.max(stats.clients, 1));
  const productsSpark = sparkFrom([], Math.max(stats.products, 1));
  const growthSpark = sparkFrom(chartData.map((d) => Number(d.revenue) || 0), Math.max(Math.abs(stats.monthlyGrowth), 1));

  const metrics = [
    {
      label: t('workspace.kpi.invoiced'),
      value: formatCurrency(stats.invoiced),
      icon: DollarSign,
      iconBg: 'bg-[#EEEDFB] text-[#6D5BF6] dark:bg-[#6D5BF6]/10 dark:text-[#A78BFA]',
      spark: revenueSpark,
      sparkColor: '#6D5BF6',
      change: {
        value: `${changeStats.invoicedChange >= 0 ? '+' : ''}${changeStats.invoicedChange.toFixed(1)}%`,
        positive: changeStats.invoicedPositive,
        label: t('workspace.kpi.invoiced_vs'),
      },
    },
    {
      label: t('workspace.kpi.clients'),
      value: String(stats.clients),
      icon: Users,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      spark: clientsSpark,
      sparkColor: '#10B981',
      change: {
        value: `+${newClients}`,
        positive: true,
        label: t('workspace.kpi.clients_new'),
      },
    },
    {
      label: t('workspace.kpi.products'),
      value: String(stats.products),
      icon: Package,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      spark: productsSpark,
      sparkColor: '#F59E0B',
      change: {
        value: `${inventoryItems.filter(i => i.status === 'critique' || i.status === 'rupture').length} ${t('workspace.kpi.products_alert')}`,
        positive: inventoryItems.filter(i => i.status === 'critique' || i.status === 'rupture').length === 0,
        label: t('workspace.kpi.products_critical'),
      },
    },
    {
      label: t('workspace.kpi.growth'),
      value: `${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth.toFixed(1)}%`,
      icon: Target,
      iconBg: stats.monthlyGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400',
      spark: growthSpark,
      sparkColor: stats.monthlyGrowth >= 0 ? '#10B981' : '#EF4444',
      change: {
        value: `${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth.toFixed(1)}%`,
        positive: stats.monthlyGrowth >= 0,
        label: t('workspace.kpi.growth_vs'),
      },
    },
  ];

  // ─── Resolved quick actions ───────────────────────────────────────────────
  const quickActions = quickActionDefs.map(({ key, icon, href, iconBg, iconColor }) => ({
    icon,
    href,
    iconBg,
    iconColor,
    label: t(`workspace.quick_actions.${key}`),
  }));

  // ─── Stock status label (via t) ────────────────────────────────────────────
  const stockStatusLabel = (status: StockStatus) => t(`workspace.stock_table.status_${status}`);

  // ─── Chart subtitle ────────────────────────────────────────────────────────
  const chartSubtitle =
    selectedRange === '1m' ? t('workspace.chart.subtitle_1m') :
    selectedRange === '1y' ? t('workspace.chart.subtitle_1y') :
    t('workspace.chart.subtitle_6m');

  // ─── Custom chart tooltip ─────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-[10px] border px-4 py-3 shadow-[0_8px_24px_-10px_rgba(28,25,60,0.25)]"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          // Tooltips should always be LTR-oriented for number readability
          dir="ltr"
        >
          <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm mt-1 first:mt-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {entry.name === 'revenue'
                  ? t('workspace.chart.tooltip_revenue')
                  : t('workspace.chart.tooltip_expenses')}
              </span>
              <span className="font-bold ms-auto" style={{ color: 'var(--foreground)' }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // ─── Custom chart legend (dot + label, top-right like the reference) ──────
  const ChartLegend = () => (
    <div className="flex items-center justify-end gap-4 pe-1">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6D5BF6' }} />
        <span className="text-xs text-muted-foreground">{t('workspace.chart.tooltip_revenue')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
        <span className="text-xs text-muted-foreground">{t('workspace.chart.tooltip_expenses')}</span>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-6 pb-8 animate-in fade-in duration-500"
      /*
       * RTL Note: `dir` is already set on <html> by DashboardLayout / App.tsx.
       * We set it here too so this component is self-contained and correct even
       * when rendered in isolation (tests, Storybook, etc.).
       */
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="kpi-card relative overflow-hidden p-5 min-h-[124px]"
          >
            {/* Sparkline anchored to the bottom-right (visual flourish) */}
            <div
              className="pointer-events-none absolute bottom-0 right-0 w-[55%] h-[58px] opacity-90"
              dir="ltr"
              aria-hidden="true"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metric.spark} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`kpiSpark-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metric.sparkColor} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={metric.sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={metric.sparkColor}
                    strokeWidth={2.5}
                    fill={`url(#kpiSpark-${i})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Label */}
            <p className="relative text-[13px] font-semibold text-card-foreground/90">
              {metric.label}
            </p>

            {/* Value + inline change pill */}
            <div className="relative mt-2 flex items-center gap-2 flex-wrap">
              {/*
               * RTL Note: numeric values should always render LTR so digits read
               * left-to-right regardless of page direction.
               */}
              <span className="text-[26px] leading-none font-bold text-card-foreground tracking-tight" dir="ltr">
                {metric.value}
              </span>
              {metric.change && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-bold",
                  metric.change.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )} dir="ltr">
                  {metric.change.positive
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {metric.change.value}
                </span>
              )}
            </div>

            {/* Subtext */}
            {metric.change && (
              <p className="relative mt-2 text-xs text-muted-foreground">
                {metric.change.label}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Main 12-col Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left / Start Column (7 cols) ─────────────────────────────────
         *  RTL Note: CSS Grid column flow reverses automatically with dir=rtl.
         *  `lg:col-span-7` will correctly appear on the RIGHT side in Arabic.
         */}
        <div className="lg:col-span-7 space-y-6">

          {/* Performance Chart */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              {/*
               * RTL Note: `flex-row` items auto-reverse in RTL via dir attribute.
               * ms-auto (margin-inline-start) keeps the Tabs at the logical end.
               */}
              <div>
                <CardTitle className="text-base font-bold text-card-foreground">
                  {t('workspace.chart.title')}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {chartSubtitle}
                </CardDescription>
              </div>
              <div className="ms-auto flex items-center gap-4">
                <div className="hidden sm:block">
                  <ChartLegend />
                </div>
                <Tabs value={selectedRange} onValueChange={setSelectedRange}>
                  <TabsList className="bg-[#F2F2FA] dark:bg-white/5 rounded-xl p-1">
                    <TabsTrigger value="1m" className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#4A3FCF] data-[state=active]:shadow-sm dark:data-[state=active]:bg-card font-semibold">
                      {t('workspace.chart.filter_1m')}
                    </TabsTrigger>
                    <TabsTrigger value="6m" className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#4A3FCF] data-[state=active]:shadow-sm dark:data-[state=active]:bg-card font-semibold">
                      {t('workspace.chart.filter_6m')}
                    </TabsTrigger>
                    <TabsTrigger value="1y" className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#4A3FCF] data-[state=active]:shadow-sm dark:data-[state=active]:bg-card font-semibold">
                      {t('workspace.chart.filter_1y')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className={cn("h-[300px] pt-4 transition-opacity duration-300", isLoading && "opacity-40")}>
              {/*
               * RTL Note: Recharts itself doesn't natively support RTL axis mirroring.
               * We keep the chart container dir=ltr so axes and data flow are correct.
               * The surrounding UI text already inherits RTL from the parent dir.
               */}
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="perfRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6D5BF6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#6D5BF6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="perfExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      dy={10}
                      padding={{ left: 12, right: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      dx={-4}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: '#6D5BF6', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone" dataKey="expenses" name="expenses"
                      stroke="#10B981" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#perfExpenseGrad)" dot={false}
                      activeDot={{ r: 5, fill: '#10B981', stroke: 'var(--card)', strokeWidth: 2.5 }}
                    />
                    <Area
                      type="monotone" dataKey="revenue" name="revenue"
                      stroke="#6D5BF6" strokeWidth={3}
                      fillOpacity={1} fill="url(#perfRevenueGrad)" dot={false}
                      activeDot={{ r: 6, fill: '#6D5BF6', stroke: 'var(--card)', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Priority Inventory Table */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-card-foreground">
                    {t('workspace.stock_table.title')}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t('workspace.stock_table.subtitle')}
                  </CardDescription>
                </div>
                {/*
                 * RTL Note: ms-auto pushes button to logical end (right in LTR, left in RTL).
                 * ChevronRight flip: in RTL arrow pointing ← means "forward"; Tailwind's
                 * `rtl:rotate-180` handles this transparently.
                 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 bg-transparent border border-[#EAEAF4] dark:border-white/20 text-[#6D5BF6] dark:text-white hover:bg-[#F2F2FA] dark:hover:bg-white/10 hover:border-[#D4CCFF] rounded-lg font-semibold transition-all duration-200 ms-auto"
                  onClick={() => window.location.href = '/produits'}
                >
                  {t('workspace.stock_table.view_all')}
                  <ChevronRight className="h-3 w-3 ms-1 rtl:rotate-180" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10 px-5">
                      {t('workspace.stock_table.col_product')}
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10">
                      {t('workspace.stock_table.col_reference')}
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10">
                      {t('workspace.stock_table.col_stock')}
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10 hidden md:table-cell">
                      {t('workspace.stock_table.col_level')}
                    </TableHead>
                    {/*
                     * RTL Note: `text-end` (logical) aligns to the correct edge
                     * in both LTR and RTL, unlike `text-right` which is physical.
                     */}
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-10 text-end pe-5">
                      {t('workspace.stock_table.col_status')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-card-foreground/60 text-sm">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30 text-card-foreground" />
                        {t('workspace.stock_table.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventoryItems.slice(0, 4).map((item) => {
                      const cfg = stockStyleConfig[item.status];
                      return (
                        <TableRow key={item.id} className="border-border hover:bg-[#F8F8FD] dark:hover:bg-white/5 transition-colors">
                          <TableCell className="py-4 px-5">
                            <p className="text-sm font-semibold text-card-foreground">{item.name}</p>
                            <p className="text-xs text-card-foreground/70 mt-0.5" dir="ltr">
                              {item.stockActuel} / {Math.max(item.stockMin * 3, 1)} {t('workspace.stock_table.unit')}
                            </p>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-xs text-card-foreground/70 font-mono" dir="ltr">
                              {item.reference || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2" dir="ltr">
                              <span className={cn(
                                "text-sm font-bold",
                                item.status === 'rupture' || item.status === 'critique' ? 'text-red-500' :
                                item.status === 'faible' ? 'text-amber-500' : 'text-card-foreground'
                              )}>
                                {item.stockActuel}
                              </span>
                              <span className="text-xs text-card-foreground/70">{item.unite}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 hidden md:table-cell">
                            <div className="w-28">
                              {/*
                               * RTL Note: Progress bar fill direction.
                               * We keep dir=ltr on this element so the bar always
                               * fills left-to-right visually (conventional for progress).
                               */}
                              <div className="h-2 rounded-full bg-[#EEEEF6] dark:bg-white/10 overflow-hidden" dir="ltr">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-500", cfg.barColor)}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-end pe-5">
                            <span className={cn(
                              "inline-block text-xs font-semibold px-2.5 py-1 rounded-full border",
                              cfg.badgeClass
                            )}>
                              {stockStatusLabel(item.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-elevated border-transparent dark:border-border p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-violet-500/10 text-violet-500 dark:text-violet-400 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.pending_invoices')}</p>
                <p className="text-xl font-bold text-card-foreground" dir="ltr">{stats.pending}</p>
              </div>
            </div>
            <div className="card-elevated border-transparent dark:border-border p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.new_clients')}</p>
                <p className="text-xl font-bold text-card-foreground" dir="ltr">{newClients}</p>
              </div>
            </div>
            <div className="card-elevated border-transparent dark:border-border p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('workspace.summary.stock_alerts')}</p>
                <p className="text-xl font-bold text-card-foreground" dir="ltr">
                  {inventoryItems.filter(i => i.status === 'critique' || i.status === 'rupture').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right / End Column (5 cols) ──────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Quick Actions */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-card-foreground">
                {t('workspace.quick_actions.section_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => window.location.href = action.href}
                  className="quick-tile flex flex-col items-center justify-center p-4"
                >
                  <div className={cn("p-3 rounded-2xl mb-3", action.iconBg)}>
                    <action.icon className={cn("w-5 h-5", action.iconColor)} strokeWidth={2} />
                  </div>
                  <span className="text-xs font-semibold text-foreground text-center">{action.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Expired Section */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <CardTitle className="text-base font-bold text-card-foreground">Expiré</CardTitle>
                <Badge className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ms-auto min-w-[20px] text-center">
                  {expiredOrdonnances.length + expiredLunettes.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[200px] overflow-y-auto">
              {expiredOrdonnances.length === 0 && expiredLunettes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/60 text-sm">Aucun élément expiré</div>
              ) : (
                <div className="divide-y divide-border">
                  {expiredOrdonnances.map((p: any, i: number) => (
                    <div key={`eo-${i}`} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="text-sm truncate">{p.clients?.nom || 'N/A'} — Ordonnance</span>
                      </div>
                      <span className="text-xs text-red-500 shrink-0 ms-2">{p.date_expiration}</span>
                    </div>
                  ))}
                  {expiredLunettes.map((c: any, i: number) => (
                    <div key={`el-${i}`} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="text-sm truncate">{c.nom || 'N/A'} — Lunette</span>
                      </div>
                      <span className="text-xs text-red-500 shrink-0 ms-2">{c.lunette_expiration_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Due Expired Section */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-amber-500" />
                </div>
                <CardTitle className="text-base font-bold text-card-foreground">Bientôt expiré</CardTitle>
                <Badge className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ms-auto min-w-[20px] text-center">
                  {dueExpiredOrdonnances.length + dueExpiredLunettes.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[200px] overflow-y-auto">
              {dueExpiredOrdonnances.length === 0 && dueExpiredLunettes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/60 text-sm">Aucun élément à expirer</div>
              ) : (
                <div className="divide-y divide-border">
                  {dueExpiredOrdonnances.map((p: any, i: number) => (
                    <div key={`do-${i}`} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-sm truncate">{p.clients?.nom || 'N/A'} — Ordonnance</span>
                      </div>
                      <span className="text-xs text-amber-600 shrink-0 ms-2">{p.date_expiration}</span>
                    </div>
                  ))}
                  {dueExpiredLunettes.map((c: any, i: number) => (
                    <div key={`dl-${i}`} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-sm truncate">{c.nom || 'N/A'} — Lunette</span>
                      </div>
                      <span className="text-xs text-amber-600 shrink-0 ms-2">{c.lunette_expiration_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price Alerts Section */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <CardTitle className="text-base font-bold text-card-foreground">Alertes de prix</CardTitle>
                <Badge className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ms-auto min-w-[20px] text-center">
                  {priceAlerts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[260px] overflow-y-auto">
              {priceAlerts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/60 text-sm">Aucune variation de prix</div>
              ) : (
                <div className="divide-y divide-border">
                  {priceAlerts.map((a: any, i: number) => (
                    <div key={`pa-${i}`} className="px-5 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          <span className="text-sm truncate font-medium">{a.produit}</span>
                        </div>
                        <span className={cn(
                          "text-xs font-semibold shrink-0 ms-2",
                          a.difference > 0 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {a.difference > 0 ? '+' : ''}{formatCurrency(a.difference)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{a.type === 'facture' ? 'Facture' : 'VP'} {a.docNum}</span>
                        <span className="text-[11px] text-muted-foreground">— Prix doc: {formatCurrency(a.docPrice)}</span>
                        <span className="text-[11px] text-muted-foreground">Prix actuel: {formatCurrency(a.currentPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Manager */}
          <Card className="card-elevated border-transparent dark:border-border overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-card-foreground">
                  {t('workspace.tasks.section_title')}
                </CardTitle>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {tasks.filter(t => !t.completed).length}
                </Badge>
              </div>
              {/*
               * RTL Note: Input and button use flex-row which mirrors in RTL.
               * The plus button appears on the LEFT in Arabic (logical end of input).
               */}
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder={t('workspace.tasks.input_placeholder')}
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  className="focus-visible:ring-emerald-500/30 h-10 text-sm rounded-xl bg-[#F8F8FD] dark:bg-transparent border-[#EAEAF4]"
                />
                <Button
                  size="icon"
                  onClick={addTask}
                  className="bg-emerald-600 hover:bg-emerald-700 shrink-0 h-10 w-10 rounded-xl shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[320px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {tasks.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground/60">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20 text-muted-foreground" />
                      <p className="text-sm">{t('workspace.tasks.empty_state')}</p>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                        className={cn(
                          "group flex items-center justify-between px-5 py-3 border-b border-border last:border-0",
                          task.completed ? "bg-muted" : ""
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={cn(
                              "h-5 w-5 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0",
                              task.completed
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-border"
                            )}
                          >
                            {task.completed && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                          <span className={cn(
                            "text-sm font-medium truncate transition-all",
                            task.completed ? "text-muted-foreground line-through" : "text-card-foreground"
                          )}>
                            {task.title}
                          </span>
                        </div>
                        {/*
                         * RTL Note: opacity-0 group-hover:opacity-100 with ms-auto
                         * ensures the delete button is always at the logical end.
                         */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ms-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 rounded-[4px]"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
            * Notification Toggle Card — RTL-aware layout
            *
            * Structure (works identically in LTR and RTL because every spacing
            * primitive used here is "logical"):
            *
            *   ┌──────────────────────────────────────────────────────────────┐
            *   │  [icon]  Title              ............................  [⏻] │   LTR
            *   │          Subtitle                                            │
            *   └──────────────────────────────────────────────────────────────┘
            *
            *   ┌──────────────────────────────────────────────────────────────┐
            *   │ [⏻]  ............................            Title  [icon]   │   RTL
            *   │                                            Subtitle          │
            *   └──────────────────────────────────────────────────────────────┘
            *
            * Key Tailwind primitives:
            *   - `flex` + `justify-between`  → naturally mirrors with dir=rtl
            *   - `gap-3` / `gap-4`           → direction-agnostic spacing (no `space-x-*` needed)
            *   - `text-start`                → logical text alignment (left in LTR, right in RTL)
            *   - `min-w-0` on text wrapper   → allows long Arabic words to truncate cleanly
            *   - NO `ml-*` / `mr-*` / `left-*` / `right-*` / `space-x-reverse`
            */}
          <div
            className={cn(
              "rounded-2xl border p-4 transition-colors duration-200",
              // Flex row — auto-reverses under dir=rtl. justify-between guarantees
              // the icon-group and the switch always sit at OPPOSITE edges of the card.
              "flex flex-row items-center justify-between gap-4",
              notificationsEnabled
                ? "bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-500/10 dark:to-emerald-500/5 border-emerald-200/60 dark:border-emerald-500/20 shadow-[0_8px_24px_-14px_rgba(16,185,129,0.3)]"
                : "bg-card border-[#EAEAF4] dark:border-border",
            )}
          >
            {/* ── Icon + Text group (logical start edge) ───────────────── */}
            <div className="flex flex-row items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-200",
                  notificationsEnabled ? "bg-emerald-500/15 dark:bg-emerald-500/10" : "bg-muted",
                )}
              >
                <Bell
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    notificationsEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                />
              </div>

              {/*
               * Text block:
               *   - `text-start` is the logical equivalent of `text-left` in LTR
               *     and `text-right` in RTL — flips automatically.
               *   - `min-w-0` lets the parent flex item shrink so the switch
               *     never gets pushed off-screen by a long Arabic label.
               */}
              <div className="flex flex-col text-start min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-200 leading-tight",
                    notificationsEnabled ? "text-card-foreground" : "text-muted-foreground",
                  )}
                >
                  {t('workspace.tasks.notifications_active')}
                </p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {t('workspace.tasks.notifications_subtitle')}
                </p>
              </div>
            </div>

            {/*
             * Switch — sits at the logical end edge thanks to `justify-between`.
             * `shrink-0` prevents Radix's flex sibling from squashing it.
             * No margin utilities needed; the parent's gap-4 + justify-between
             * handles spacing in both directions cleanly.
             *
             * Note: switch.tsx was updated to mirror the thumb transform under
             * `dir=rtl` so the toggle animation reads correctly in Arabic.
             */}
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleToggleNotifications}
              className={cn(
                "shrink-0",
                "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted",
                "data-[state=unchecked]:border-[#267E54] dark:data-[state=unchecked]:border-[#2ECC71]",
              )}
              thumbClassName="data-[state=unchecked]:bg-[#267E54] dark:data-[state=unchecked]:bg-[#2ECC71]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

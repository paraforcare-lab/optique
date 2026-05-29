import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrencyLocale, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, CreditCard, Activity, FileText, Users, Package,
  TrendingUp, ShieldCheck, ChevronRight, Receipt, Building2,
  HeartPulse, ClipboardList, Plus, ShoppingCart, AlertTriangle,
  Pill, PieChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { KPICard } from '@/components/ui/kpi-card'
import { useTranslation } from 'react-i18next'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  clientsCount: number
  facturesCount: number
  produitsCount: number
  fournisseursCount: number
  totalRevenue: number
  unpaidRevenue: number
  totalDepenses: number
  profit: number
  totalTvaCollectee: number
  totalTvaDeductible: number
  tvaNet: number
  ventesHT: number
  totalCOGS: number
  stockValueHT: number
  monthlyData: Array<{ name: string; revenue: number; expenses: number }>
  lowStockProduits: any[]
  recentFactures: any[]
  bonsCommandeCount: number
}

// ─── Month-index → i18n key map ───────────────────────────────────────────────
const MONTH_KEYS = [
  'jan','feb','mar','apr','may','jun',
  'jul','aug','sep','oct','nov','dec',
] as const

// ─── Locale → Intl BCP-47 tag ─────────────────────────────────────────────────
function toDateLocale(lang: string): string {
  if (lang.startsWith('ar')) return 'ar-MA'
  if (lang.startsWith('en')) return 'en-US'
  return 'fr-FR'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()

  const lang    = i18n.language ?? 'fr'
  const isRTL   = lang.startsWith('ar')
  const dateFmt = toDateLocale(lang)

  // Shorthand so we don't repeat `t('dashboard.X')` everywhere
  const td = (key: string) => t(`dashboard.${key}`)

  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // Locale-aware currency formatter (memoised to the current language)
  const fmt = (n: number | null | undefined) => formatCurrencyLocale(n, lang)

  useEffect(() => {
    if (!user?.id) {
      setStats(null)
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        const now          = new Date()
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

        const [factRes, vpRes, depRes, prodRes, cliRes, fourRes, recentRes, bcRes] =
          await Promise.all([
            supabase.from('factures').select('*').eq('user_id', user.id).gte('date_emission', sixMonthsAgo),
            supabase.from('ventes_passagers').select('*').eq('user_id', user.id).gte('date', sixMonthsAgo),
            supabase.from('depenses').select('*').eq('user_id', user.id).gte('date_depense', sixMonthsAgo),
            supabase.from('produits').select('*').eq('user_id', user.id),
            supabase.from('clients').select('*').eq('user_id', user.id),
            supabase.from('fournisseurs').select('*').eq('user_id', user.id),
            supabase.from('factures').select('*, clients(nom)').eq('user_id', user.id).order('date_emission', { ascending: false }).limit(5),
            supabase.from('bons_commande').select('*').eq('user_id', user.id),
          ])

        const factures         = factRes.data  ?? []
        const ventesPassagers  = vpRes.data    ?? []
        const depenses         = depRes.data   ?? []
        const produits         = prodRes.data  ?? []
        const clients          = cliRes.data   ?? []
        const fournisseurs     = fourRes.data  ?? []
        const recentFacturesRaw = recentRes.data ?? []
        const bonsCommande     = bcRes.data    ?? []

        const allFactures   = [...factures, ...ventesPassagers]
        const validFact     = allFactures.filter((f: any) => f.statut !== 'annulée')
        const payeesFact    = allFactures.filter((f: any) => f.statut === 'payée')
        const resteAPayerFact = allFactures.filter((f: any) => f.statut === 'reste_a_payer')
        const brouillonFact = allFactures.filter((f: any) => f.statut === 'brouillon')
        const bonsCommandeValides = bonsCommande.filter((b: any) =>
          ['confirmé', 'livré', 'livrée'].includes(b.statut),
        )

        const totalRevenue   = validFact.reduce((s, f: any) => s + Number(f.montant_ttc || 0), 0)
        const totalDepenses  = depenses.reduce((s, d: any) => s + Number(d.montant_ttc || 0), 0)
          + bonsCommandeValides.reduce((s, b: any) => s + Number(b.montant_ttc || 0), 0)
        const unpaidRevenue  = resteAPayerFact.reduce((s, f: any) => s + Number(f.reste_a_payer || 0), 0)

        const totalTvaCollectee  = validFact.reduce((s, f: any) => s + Number(f.montant_tva || 0), 0)
        const totalTvaDeductible = depenses.reduce((s, d: any) => s + Number(d.montant_tva || 0), 0)
          + bonsCommandeValides.reduce((s, b: any) => s + Number(b.montant_tva || 0), 0)
        const tvaNet = totalTvaCollectee - totalTvaDeductible

        const totalCOGS = allFactures.reduce((s, f: any) => s + Number(f.cogs || 0), 0)
          + bonsCommandeValides.reduce((s, b: any) => s + Number(b.montant_ht || 0), 0)
        const ventesHT  = validFact.reduce((s, f: any) => s + Number(f.montant_ht || 0), 0)
        const profit    = totalRevenue - totalDepenses

        // Build monthly chart data with translated month names
        const monthlyData: Stats['monthlyData'] = []
        for (let i = 5; i >= 0; i--) {
          const d     = new Date()
          d.setMonth(d.getMonth() - i)
          const month = d.getMonth()        // 0-based
          const year  = d.getFullYear()

          const monthRevenue = [
            ...factures.filter((f: any) =>
              new Date(f.date_emission).getMonth() === month &&
              new Date(f.date_emission).getFullYear() === year,
            ),
            ...ventesPassagers.filter((f: any) =>
              new Date(f.date).getMonth() === month &&
              new Date(f.date).getFullYear() === year,
            ),
          ].reduce((s, f: any) => s + Number(f.montant_ttc || 0), 0)

          const monthExpense = depenses
            .filter((dep: any) =>
              new Date(dep.date_depense).getMonth() === month &&
              new Date(dep.date_depense).getFullYear() === year,
            )
            .reduce((s, dep: any) => s + Number(dep.montant_ttc || 0), 0)

          // Translate month name from the locale dictionary
          const nameKey = MONTH_KEYS[month]
          monthlyData.push({
            name:     t(`dashboard.chart.months.${nameKey}`),
            revenue:  monthRevenue,
            expenses: monthExpense,
          })
        }

        const stockValueHT = produits.reduce((s, p: any) => {
          return s + (Number(p.stock_actuel || 0) * Number(p.prix_achat_ht || 0))
        }, 0)

        setStats({
          clientsCount:      clients.length,
          facturesCount:     payeesFact.length + resteAPayerFact.length + brouillonFact.length,
          produitsCount:     produits.length,
          fournisseursCount: fournisseurs.length,
          totalRevenue,
          unpaidRevenue,
          totalDepenses,
          profit,
          totalTvaCollectee,
          totalTvaDeductible,
          tvaNet,
          ventesHT,
          totalCOGS,
          stockValueHT,
          monthlyData,
          bonsCommandeCount: bonsCommande.filter((b: any) =>
            ['confirmé', 'livré'].includes(b.statut),
          ).length,
          lowStockProduits: produits
            .filter((p: any) => Number(p.stock_actuel) <= Number(p.stock_min))
            .slice(0, 5),
          recentFactures: recentFacturesRaw,
        })
      } catch (err) {
        console.error('Failed to fetch stats', err)
        setStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  // Re-fetch whenever the language changes so month labels update immediately
  }, [user?.id, lang])

  // ─── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-primary/20 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <HeartPulse className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold text-foreground">{td('loading.title')}</p>
            <p className="text-sm text-muted-foreground">{td('loading.subtitle')}</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Invoice status label ────────────────────────────────────────────────
  const invoiceStatusLabel = (statut: string) => {
    if (statut === 'payée')          return td('recent_invoices.status_paid')
    if (statut === 'reste_a_payer')  return td('recent_invoices.status_partial')
    return td('recent_invoices.status_pending')
  }

  // ─── Quick actions (labels from i18n) ────────────────────────────────────
  const quickActions = [
    { label: td('quick_actions.new_invoice'), icon: FileText,     bg: 'bg-primary/10',      color: 'text-primary',    link: '/factures'         },
    { label: td('quick_actions.quick_sale'),  icon: ShoppingCart, bg: 'bg-emerald-500/10',  color: 'text-emerald-400',link: '/ventes-passagers'  },
    { label: td('quick_actions.new_expense'), icon: CreditCard,   bg: 'bg-red-500/10',      color: 'text-red-400',    link: '/depenses'          },
    { label: td('quick_actions.add_client'),  icon: Users,        bg: 'bg-amber-500/10',    color: 'text-amber-400',  link: '/clients'           },
  ]

  // ─── Chart custom tooltip ────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      // Keep tooltip contents dir=ltr so numbers always read correctly
      <div
        className="rounded-[4px] border p-3 text-xs"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        dir="ltr"
      >
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground">
              {entry.dataKey === 'revenue'
                ? td('chart.tooltip_revenue')
                : td('chart.tooltip_expenses')}:
            </span>
            <span className="font-semibold">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-6"
      /*
       * RTL Note: `dir` is already set on <html> by App.tsx's RtlSynchronizer
       * and on the DashboardLayout wrapper. We set it here too so this page is
       * self-contained and correct in isolation (tests, Storybook).
       */
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      {/*
       * RTL: justify-between + flex automatically mirrors — title sits at the
       * logical start, stock mini-card at the logical end.
       */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{td('header.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{td('header.subtitle')}</p>
        </div>

        {/* Stock value mini-card — logical end (right in LTR, left in RTL) */}
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-start">
            <p className="text-xs text-muted-foreground">{td('header.stock_value_label')}</p>
            {/* dir=ltr keeps the number reading left→right even in Arabic */}
            <p className="text-lg font-bold text-foreground" dir="ltr">
              {fmt(stats?.stockValueHT ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Row 1: Financial KPIs ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title={td('kpi.revenue.title')}
          value={fmt(stats?.totalRevenue ?? 0)}
          subtitle={td('kpi.revenue.subtitle')}
          icon={DollarSign}
          iconContainerClass="dark:bg-emerald-500/10 dark:border dark:border-emerald-500/20 dark:text-emerald-400"
        />
        <KPICard
          title={td('kpi.receivables.title')}
          value={fmt(stats?.unpaidRevenue ?? 0)}
          subtitle={td('kpi.receivables.subtitle')}
          icon={CreditCard}
          iconContainerClass="dark:bg-blue-500/10 dark:border dark:border-blue-500/20 dark:text-blue-400"
        />
        <KPICard
          title={td('kpi.expenses.title')}
          value={fmt(stats?.totalDepenses ?? 0)}
          subtitle={td('kpi.expenses.subtitle')}
          icon={Activity}
          iconContainerClass="dark:bg-rose-500/10 dark:border dark:border-rose-500/20 dark:text-rose-400"
        />
        <KPICard
          title={td('kpi.profit.title')}
          value={fmt(stats?.profit ?? 0)}
          subtitle={td('kpi.profit.subtitle')}
          icon={ShieldCheck}
          iconContainerClass="dark:bg-rose-500/10 dark:border dark:border-rose-500/20 dark:text-rose-400"
        />
      </div>

      {/* ── KPI Row 2: Counter cards ──────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <KPICard
          title={td('kpi.purchase_orders.title')}
          value={String(stats?.bonsCommandeCount ?? 0)}
          subtitle={td('kpi.purchase_orders.subtitle')}
          icon={ClipboardList}
          iconContainerClass="dark:bg-emerald-500/10 dark:border dark:border-emerald-500/20 dark:text-emerald-400"
        />
        <KPICard
          title={td('kpi.clients.title')}
          value={String(stats?.clientsCount ?? 0)}
          subtitle={td('kpi.clients.subtitle')}
          icon={Users}
          iconContainerClass="dark:bg-blue-500/10 dark:border dark:border-blue-500/20 dark:text-blue-400"
        />
        <KPICard
          title={td('kpi.suppliers.title')}
          value={String(stats?.fournisseursCount ?? 0)}
          subtitle={td('kpi.suppliers.subtitle')}
          icon={Building2}
          iconContainerClass="dark:bg-indigo-500/10 dark:border dark:border-indigo-500/20 dark:text-indigo-400"
        />
        <KPICard
          title={td('kpi.products.title')}
          value={String(stats?.produitsCount ?? 0)}
          subtitle={td('kpi.products.subtitle')}
          icon={Package}
          iconContainerClass="dark:bg-amber-500/10 dark:border dark:border-amber-500/20 dark:text-amber-400"
        />
        <KPICard
          title={td('kpi.invoices.title')}
          value={String(stats?.facturesCount ?? 0)}
          subtitle={td('kpi.invoices.subtitle')}
          icon={FileText}
          iconContainerClass="dark:bg-emerald-500/10 dark:border dark:border-emerald-500/20 dark:text-emerald-400"
        />
      </div>

      {/* ── Main content row: Chart + Recent Invoices ─────────────────────── */}
      {/*
       * RTL: CSS grid column flow reverses under dir=rtl, so the chart
       * (lg:col-span-4) naturally sits on the RIGHT in Arabic — correct for
       * a right-to-left reading order where the primary visual comes first.
       */}
      <div className="grid gap-6 lg:grid-cols-7">

        {/* Cash-flow chart */}
        <Card className="lg:col-span-4 shadow-none rounded-[6px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-4 flex-wrap">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                {td('chart.title')}
              </CardTitle>
              <CardDescription>{td('chart.subtitle')}</CardDescription>
            </div>

            {/* Legend — ms-auto pushes it to the logical end */}
            <div className="flex items-center gap-4 text-xs ms-auto shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-primary to-primary/60 shrink-0" />
                <span className="text-muted-foreground font-medium">
                  {td('chart.legend_revenue')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 shrink-0" />
                <span className="text-muted-foreground font-medium">
                  {td('chart.legend_expenses')}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {/*
             * RTL + Recharts note:
             * Recharts renders a plain SVG and is NOT direction-aware. We wrap
             * the chart in a `dir="ltr"` container so:
             *   1. The X-axis reads left → right (chronological order preserved).
             *   2. The Y-axis stays on the LEFT side of the chart.
             *   3. SVG `x1/x2` gradient coordinates are not inverted.
             * The surrounding UI text (title, legend) inherits RTL from the
             * parent dir=rtl and mirrors correctly on its own.
             */}
            <div className="h-[320px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={stats?.monthlyData ?? []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="oklch(0.52 0.15 195)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="oklch(0.52 0.15 195)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="oklch(0.55 0.2 25)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="oklch(0.55 0.2 25)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'oklch(0.5 0.03 250)' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'oklch(0.5 0.03 250)' }}
                    // Keep Y-axis on the left side regardless of page direction
                    orientation="left"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={td('chart.tooltip_revenue')}
                    stroke="oklch(0.52 0.15 195)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name={td('chart.tooltip_expenses')}
                    stroke="oklch(0.55 0.2 25)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="lg:col-span-3 shadow-none rounded-[6px]">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary shrink-0" />
                {td('recent_invoices.title')}
              </CardTitle>
              <CardDescription>{td('recent_invoices.subtitle')}</CardDescription>
            </div>
            {/*
             * RTL: ms-auto pushes the button to the logical end.
             * ChevronRight gets rtl:rotate-180 so it points the correct way.
             */}
            <Button
              variant="ghost"
              size="sm"
              className="text-primary font-semibold hover:bg-primary/5 ms-auto shrink-0"
            >
              <Link to="/factures" className="flex items-center gap-1">
                {td('recent_invoices.view_all')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {stats?.recentFactures?.length ? (
                stats.recentFactures.map((facture) => (
                  <div
                    key={facture.id}
                    className="flex items-center gap-4 p-3 rounded-[6px] hover:bg-muted/50 transition-all duration-200 group cursor-pointer"
                  >
                    {/* Status icon */}
                    <div className={cn(
                      'h-11 w-11 rounded-[6px] flex items-center justify-center shrink-0',
                      facture.statut === 'payée'
                        ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 text-emerald-400'
                        : facture.statut === 'reste_a_payer'
                          ? 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 text-blue-400'
                          : 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-400',
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* Client name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-foreground text-start">
                        {facture.client?.nom ?? td('recent_invoices.walk_in_client')}
                      </p>
                      {/*
                       * RTL: invoice number and date are LTR artefacts
                       * (latin digits, ISO date). dir=ltr on this row ensures
                       * they don't get reversed by the parent RTL context.
                       */}
                      <p className="text-xs text-muted-foreground flex items-center gap-2" dir="ltr">
                        <span className="font-mono">{facture.numero}</span>
                        <span>•</span>
                        <span>
                          {new Date(facture.date_emission).toLocaleDateString(dateFmt)}
                        </span>
                      </p>
                    </div>

                    {/* Amount + badge — text-end = right in LTR, left in RTL */}
                    <div className="text-end shrink-0">
                      <p className="text-sm font-black text-foreground" dir="ltr">
                        {fmt(facture.montant_ttc)}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5 px-2 font-bold border-0',
                          facture.statut === 'payée'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : facture.statut === 'reste_a_payer'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400',
                        )}
                      >
                        {invoiceStatusLabel(facture.statut)}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-[8px] p-4 mb-3">
                    <FileText className="h-8 w-8 text-primary/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('recent_invoices.empty_title')}</p>
                  <Link
                    to="/factures"
                    className="mt-2 text-xs text-primary font-semibold hover:underline"
                  >
                    {td('recent_invoices.empty_cta')}
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Second row: Quick Actions + Stock Alerts ──────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Quick Actions */}
        <Card className="shadow-none rounded-[6px]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {td('quick_actions.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.link}
                  to={action.link}
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-[8px] border border-transparent',
                    'hover:border-border hover:bg-muted/30 transition-all duration-200 group',
                  )}
                >
                  <div className={cn('p-3 rounded-[6px]', action.bg)}>
                    <action.icon className={cn('h-6 w-6', action.color)} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground text-center group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="shadow-none rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {td('stock_alerts.title')}
            </CardTitle>
            {!!stats?.lowStockProduits?.length && (
              <Badge
                variant="destructive"
                className="dark:bg-amber-500/20 dark:text-amber-500 dark:border dark:border-amber-500/30 bg-amber-500 text-white"
              >
                {stats.lowStockProduits.length}{' '}
                {stats.lowStockProduits.length > 1
                  ? td('stock_alerts.product_other')
                  : td('stock_alerts.product_one')}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.lowStockProduits?.length ? (
                stats.lowStockProduits.slice(0, 4).map((produit) => (
                  <div
                    key={produit.id}
                    className="flex items-center justify-between p-3 rounded-sm dark:bg-white/5 dark:border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="dark:bg-amber-500/10 bg-card p-2 rounded-[4px] border dark:border-0 border-amber-500/20 shrink-0">
                        <Pill className="h-4 w-4 dark:text-amber-300 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{produit?.nom ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider" dir="ltr">
                          {td('stock_alerts.ref_label')} {produit.reference}
                        </p>
                      </div>
                    </div>
                    {/* Stock count — always LTR for unit + number */}
                    <div className="text-end" dir="ltr">
                      <p className="text-sm font-black text-amber-400">
                        {produit.stock_actuel} {produit.unite}
                      </p>
                      <p className="text-[10px] text-amber-400/60 font-semibold uppercase">
                        {td('stock_alerts.low_stock')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-[8px] p-4 mb-3">
                    <ShieldCheck className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">{td('stock_alerts.optimal_title')}</p>
                  <p className="text-xs text-muted-foreground">{td('stock_alerts.optimal_subtitle')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TVA Summary ───────────────────────────────────────────────────── */}
      <Card className="shadow-none rounded-[6px]">
        {/* Card header banner */}
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-primary/10 flex items-center gap-3">
          <div className="p-2 rounded-[6px] bg-primary/10 shrink-0">
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{td('tva.section_title')}</h3>
            <p className="text-xs text-muted-foreground">{td('tva.section_subtitle')}</p>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="grid gap-8 md:grid-cols-3">

            {/* TVA Collectée */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.collected')}
                </p>
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaCollectee ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              {/* Progress bar always reads left→right */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full w-[70%]" />
              </div>
            </div>

            {/* TVA Déductible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.deductible')}
                </p>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaDeductible ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full w-[45%]" />
              </div>
            </div>

            {/* Solde TVA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-start">
                  {td('tva.balance')}
                </p>
                <Badge className={cn(
                  'font-bold shrink-0',
                  (stats?.tvaNet ?? 0) > 0
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/10'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10',
                )}>
                  {(stats?.tvaNet ?? 0) > 0 ? td('tva.to_pay') : td('tva.credit')}
                </Badge>
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.tvaNet ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden" dir="ltr">
                {stats && Number(stats.totalTvaCollectee) > 0 && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (Math.abs(Number(stats.tvaNet)) / Number(stats.totalTvaCollectee)) * 100,
                        100,
                      )}%`,
                      backgroundColor: (stats?.tvaNet ?? 0) > 0 ? '#267E54' : '#0ea5e9',
                    }}
                  />
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrencyLocale, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, CreditCard, Activity, FileText, Users, Package,
  ShieldCheck, ChevronRight, Receipt, Building2,
  HeartPulse, ClipboardList, Plus, ShoppingCart, AlertTriangle,
  PieChart, CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { KPICard } from '@/components/ui/kpi-card'
import { ComingUpCalendar } from '@/components/dashboard/ComingUpCalendar'
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
  stockByCategory: Array<{ name: string; value: number }>
  stockByHealth: Array<{ key: string; name: string; value: number }>
  upcomingRdvs: Array<{ id: number; date_rdv: string; heure_rdv: string; client_nom: string; statut: string }>
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
  // Maximum number of upcoming appointments to display (UI only).
  const RDV_PER_PAGE = 4

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
        const todayStr     = now.toISOString().split('T')[0]

        const [factRes, vpRes, depRes, prodRes, cliRes, fourRes, recentRes, bcRes, rdvRes] =
          await Promise.all([
            supabase.from('factures').select('*').eq('user_id', user.id).gte('date_emission', sixMonthsAgo),
            supabase.from('ventes_passagers').select('*').eq('user_id', user.id).gte('date', sixMonthsAgo),
            supabase.from('depenses').select('*').eq('user_id', user.id).gte('date_depense', sixMonthsAgo),
            supabase.from('produits').select('*').eq('user_id', user.id),
            supabase.from('clients').select('*').eq('user_id', user.id),
            supabase.from('fournisseurs').select('*').eq('user_id', user.id),
            supabase.from('factures').select('*, clients(nom)').eq('user_id', user.id).order('date_emission', { ascending: false }).limit(5),
            supabase.from('bons_commande').select('*').eq('user_id', user.id),
            supabase.from('rendez_vous').select('*, clients(nom)').eq('user_id', user.id).gte('date_rdv', todayStr).order('date_rdv', { ascending: true }),
          ])

        const factures         = factRes.data  ?? []
        const ventesPassagers  = vpRes.data    ?? []
        const depenses         = depRes.data   ?? []
        const produits         = prodRes.data  ?? []
        const clients          = cliRes.data   ?? []
        const fournisseurs     = fourRes.data  ?? []
        const recentFacturesRaw = recentRes.data ?? []
        const bonsCommande     = bcRes.data    ?? []
        const rdvsRaw          = rdvRes.data   ?? []

        const allFactures   = [...factures, ...ventesPassagers]
        const validFact     = [
          ...factures.filter((f: any) => f.statut === 'payée' || f.statut === 'reste_a_payer'),
          ...ventesPassagers,
        ]
        const payeesFact    = allFactures.filter((f: any) => f.statut === 'payée')
        const resteAPayerFact = allFactures.filter((f: any) => f.statut === 'reste_a_payer')
        const brouillonFact = allFactures.filter((f: any) => f.statut === 'brouillon')
        const bonsCommandeValides = bonsCommande.filter((b: any) =>
          ['livré', 'livrée'].includes(b.statut),
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

        // ── Stock value broken down by product category (for the donut chart).
        // Purely derived from the existing `produits` dataset — no extra fetch.
        const categoryMap = new Map<string, number>()
        for (const p of produits as any[]) {
          const cat = (p.categorie && String(p.categorie).trim())
            ? String(p.categorie).trim()
            : t('dashboard.category_chart.uncategorized')
          const lineValue = Number(p.stock_actuel || 0) * Number(p.prix_achat_ht || 0)
          if (lineValue <= 0) continue
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + lineValue)
        }
        const stockByCategory = Array.from(categoryMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)

        // ── Products by stock-health bucket (important optique KPI: which items
        // need restocking). Derived from the existing `produits` dataset.
        const healthBuckets = { rupture: 0, critique: 0, faible: 0, sain: 0 }
        for (const p of produits as any[]) {
          const actuel = Number(p.stock_actuel || 0)
          const min    = Number(p.stock_min || 0)
          if (actuel <= 0)               healthBuckets.rupture++
          else if (actuel <= min)        healthBuckets.critique++
          else if (actuel <= min * 1.5)  healthBuckets.faible++
          else                           healthBuckets.sain++
        }
        const stockByHealth = (['rupture', 'critique', 'faible', 'sain'] as const)
          .map((key) => ({
            key,
            name: t(`dashboard.category_chart.health_${key}`),
            value: healthBuckets[key],
          }))
          .filter((b) => b.value > 0)

        // ── Upcoming appointments (already filtered to today+ and sorted asc).
        const upcomingRdvs = (rdvsRaw as any[]).map((r) => ({
          id: r.id,
          date_rdv: r.date_rdv,
          heure_rdv: r.heure_rdv,
          client_nom: r.clients?.nom ?? '',
          statut: r.statut,
        }))

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
          stockByCategory,
          stockByHealth,
          upcomingRdvs,
          bonsCommandeCount: bonsCommande.filter((b: any) =>
            ['livré', 'livrée'].includes(b.statut),
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

  // ─── Category donut palette (vibrant, app-tuned) ─────────────────────────
  const CATEGORY_COLORS = [
    '#6D5BF6', // indigo (brand)
    '#8B7CF8',
    '#A78BFA',
    '#3B82F6',
    '#06B6D4',
    '#10B981',
    '#34D399',
    '#F59E0B',
    '#F472B6',
    '#EF4444',
    '#F97316',
    '#A3E635',
  ]

  const categoryData = stats?.stockByCategory ?? []
  const categoryTotal = categoryData.reduce((s, c) => s + c.value, 0)

  // ─── Stock-health palette (by severity) ──────────────────────────────────
  const HEALTH_COLORS: Record<string, string> = {
    rupture:  '#EF4444', // red
    critique: '#F97316', // orange
    faible:   '#F59E0B', // amber
    sain:     '#6D5BF6', // indigo (brand)
  }
  const healthData = stats?.stockByHealth ?? []
  const healthTotal = healthData.reduce((s, h) => s + h.value, 0)

  // ─── Upcoming appointments — show a maximum of 4 (UI only) ────────────────
  const allRdvs = stats?.upcomingRdvs ?? []
  const pagedRdvs = allRdvs.slice(0, RDV_PER_PAGE)

  // ─── Donut tooltip (category — currency + share) ──────────────────────────
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const pct = categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 100) : 0
    return (
      <div
        className="rounded-[10px] border px-4 py-3 text-xs shadow-[0_8px_24px_-10px_rgba(28,25,60,0.25)]"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        dir="ltr"
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.payload.fill }} />
          <span className="font-semibold text-foreground">{item.name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-bold text-foreground">{fmt(item.value)}</span>
          <span className="text-muted-foreground">({pct}%)</span>
        </div>
      </div>
    )
  }

  // ─── Donut tooltip (health — product count + share) ───────────────────────
  const HealthTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const pct = healthTotal > 0 ? Math.round((item.value / healthTotal) * 100) : 0
    return (
      <div
        className="rounded-[10px] border px-4 py-3 text-xs shadow-[0_8px_24px_-10px_rgba(28,25,60,0.25)]"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        dir="ltr"
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.payload.fill }} />
          <span className="font-semibold text-foreground">{item.name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-bold text-foreground">{item.value}</span>
          <span className="text-muted-foreground">({pct}%)</span>
        </div>
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
          highlighted
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

        {/* Stock analysis — two small side-by-side donut cards */}
        <div className="lg:col-span-4 grid gap-6 sm:grid-cols-2">

          {/* Card A: Stock value by category */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex items-center justify-center shrink-0">
                  <PieChart className="h-4 w-4 text-[#6D5BF6] dark:text-[#A78BFA]" />
                </span>
                {td('category_chart.by_category_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {categoryData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[230px] text-center">
                  <div className="bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 rounded-2xl p-3 mb-3">
                    <Package className="h-7 w-7 text-[#6D5BF6]/60 dark:text-[#A78BFA]/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('category_chart.empty')}</p>
                </div>
              ) : (
                <>
                  <div className="relative h-[170px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={54}
                          outerRadius={80}
                          paddingAngle={2}
                          cornerRadius={6}
                          stroke="var(--card)"
                          strokeWidth={3}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {td('category_chart.center_label')}
                      </span>
                      <span className="text-sm font-bold text-foreground mt-0.5" dir="ltr">
                        {fmt(categoryTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {categoryData.slice(0, 4).map((cat, i) => {
                      const pct = categoryTotal > 0 ? Math.round((cat.value / categoryTotal) * 100) : 0
                      return (
                        <div key={cat.name} className="flex items-center gap-2.5 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                          <span className="text-sm text-foreground truncate flex-1 min-w-0 text-start">{cat.name}</span>
                          <span className="text-sm font-bold text-muted-foreground shrink-0" dir="ltr">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card B: Products by stock health */}
          <Card className="card-elevated border-transparent dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </span>
                {td('category_chart.by_health_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {healthData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[230px] text-center">
                  <div className="bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 rounded-2xl p-3 mb-3">
                    <Package className="h-7 w-7 text-[#6D5BF6]/60 dark:text-[#A78BFA]/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('category_chart.empty')}</p>
                </div>
              ) : (
                <>
                  <div className="relative h-[170px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={healthData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={54}
                          outerRadius={80}
                          paddingAngle={2}
                          cornerRadius={6}
                          stroke="var(--card)"
                          strokeWidth={3}
                        >
                          {healthData.map((h, i) => (
                            <Cell key={i} fill={HEALTH_COLORS[h.key] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<HealthTooltip />} />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {td('category_chart.center_label_products')}
                      </span>
                      <span className="text-lg font-bold text-foreground mt-0.5" dir="ltr">
                        {healthTotal}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {healthData.map((h) => {
                      const pct = healthTotal > 0 ? Math.round((h.value / healthTotal) * 100) : 0
                      return (
                        <div key={h.key} className="flex items-center gap-2.5 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: HEALTH_COLORS[h.key] }} />
                          <span className="text-sm text-foreground truncate flex-1 min-w-0 text-start">{h.name}</span>
                          <span className="text-sm font-bold text-muted-foreground shrink-0" dir="ltr">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card className="lg:col-span-3 card-elevated border-transparent dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-2xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex items-center justify-center shrink-0">
                  <Receipt className="h-[18px] w-[18px] text-[#6D5BF6] dark:text-[#A78BFA]" />
                </span>
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
              className="text-[#6D5BF6] dark:text-[#A78BFA] font-semibold hover:bg-[#EEEDFB] dark:hover:bg-[#6D5BF6]/10 rounded-lg ms-auto shrink-0"
            >
              <Link to="/factures" className="flex items-center gap-1">
                {td('recent_invoices.view_all')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
              {stats?.recentFactures?.length ? (
                stats.recentFactures.map((facture) => (
                  <div
                    key={facture.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F8F8FD] dark:hover:bg-white/5 transition-all duration-200 group cursor-pointer"
                  >
                    {/* Status icon */}
                    <div className={cn(
                      'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0',
                      facture.statut === 'payée'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : facture.statut === 'reste_a_payer'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
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
                  <div className="bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 rounded-2xl p-4 mb-3">
                    <FileText className="h-8 w-8 text-[#6D5BF6]/60 dark:text-[#A78BFA]/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('recent_invoices.empty_title')}</p>
                  <Link
                    to="/factures"
                    className="mt-2 text-xs text-[#6D5BF6] dark:text-[#A78BFA] font-semibold hover:underline"
                  >
                    {td('recent_invoices.empty_cta')}
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Coming Up: appointments calendar + upcoming list ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Calendar */}
        <Card className="lg:col-span-3 card-elevated border-transparent dark:border-border">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-bold flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-[#6D5BF6] dark:text-[#A78BFA]" />
              </span>
              {td('coming_up.title')}
            </CardTitle>
            <CardDescription className="text-xs">{td('coming_up.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <ComingUpCalendar rdvs={stats?.upcomingRdvs ?? []} />
          </CardContent>
        </Card>

        {/* Upcoming appointments list */}
        <Card className="lg:col-span-4 card-elevated border-transparent dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base font-bold flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4 text-[#6D5BF6] dark:text-[#A78BFA]" />
                </span>
                {td('coming_up.subtitle')}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#6D5BF6] dark:text-[#A78BFA] font-semibold hover:bg-[#EEEDFB] dark:hover:bg-[#6D5BF6]/10 rounded-lg ms-auto shrink-0 h-8"
            >
              <Link to="/rendez-vous" className="flex items-center gap-1">
                {td('recent_invoices.view_all')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-1">
              {allRdvs.length ? (
                pagedRdvs.map((rdv) => (
                  <div
                    key={rdv.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F8F8FD] dark:hover:bg-white/5 transition-colors duration-200"
                  >
                    {/* Date chip */}
                    <div className="h-10 w-10 rounded-xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex flex-col items-center justify-center shrink-0 leading-none" dir="ltr">
                      <span className="text-sm font-black text-[#4A3FCF] dark:text-[#A78BFA]">
                        {new Date(rdv.date_rdv).getDate()}
                      </span>
                      <span className="text-[8px] font-bold text-[#6D5BF6]/70 dark:text-[#A78BFA]/70 uppercase">
                        {new Date(rdv.date_rdv).toLocaleDateString(dateFmt, { month: 'short' })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-foreground text-start">
                        {rdv.client_nom || td('recent_invoices.walk_in_client')}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {new Date(rdv.date_rdv).toLocaleDateString(dateFmt)}
                        {rdv.heure_rdv ? ` • ${rdv.heure_rdv}` : ''}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-2 font-bold border-0 bg-[#6D5BF6]/10 text-[#4A3FCF] dark:text-[#A78BFA] shrink-0"
                    >
                      {t(`rendez_vous.statut_${rdv.statut}`)}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 rounded-2xl p-3 mb-3">
                    <CalendarDays className="h-7 w-7 text-[#6D5BF6]/60 dark:text-[#A78BFA]/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">{td('coming_up.none')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Second row: Quick Actions + Stock Alerts ──────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Quick Actions */}
        <Card className="card-elevated border-transparent dark:border-border">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-2xl bg-[#EEEDFB] dark:bg-[#6D5BF6]/10 flex items-center justify-center shrink-0">
                <Plus className="h-[18px] w-[18px] text-[#6D5BF6] dark:text-[#A78BFA]" />
              </span>
              {td('quick_actions.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.link}
                  to={action.link}
                  className="quick-tile flex flex-col items-center gap-3 p-4 group"
                >
                  <div className={cn('p-3 rounded-2xl', action.bg)}>
                    <action.icon className={cn('h-6 w-6', action.color)} strokeWidth={2} />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground text-center group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="card-elevated border-transparent dark:border-border !rounded-[10px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-[18px] w-[18px] text-red-600 dark:text-red-400" />
              </span>
              {td('stock_alerts.title')}
            </CardTitle>
            {!!stats?.lowStockProduits?.length && (
              <Badge
                variant="destructive"
                className="rounded-md border-0 font-bold bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
              >
                {t('dashboard.stock_alerts.items_count', { count: stats.lowStockProduits.length })}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.lowStockProduits?.length ? (
                stats.lowStockProduits.slice(0, 4).map((produit) => {
                  const stockMin = Number(produit.stock_min) || 0
                  const stockActuel = Number(produit.stock_actuel) || 0
                  // Fill ratio vs. the minimum threshold (visual only).
                  const pct = stockMin > 0
                    ? Math.max(6, Math.min(100, Math.round((stockActuel / stockMin) * 100)))
                    : 6
                  return (
                    <div
                      key={produit.id}
                      className="rounded-lg bg-card dark:bg-card border border-red-200/70 dark:border-red-500/20 p-4 transition-colors duration-200 hover:border-red-400/60"
                    >
                      {/* Top row: name + stock count */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-foreground text-start truncate">
                          {produit?.nom ?? '—'}
                        </p>
                        <span
                          className="text-lg font-black shrink-0 text-red-500 dark:text-red-400"
                          dir="ltr"
                        >
                          {produit.stock_actuel}
                        </span>
                      </div>

                      {/* Second row: category + Min */}
                      <div className="flex items-center justify-between gap-3 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate text-start">
                          {produit.categorie || td('stock_alerts.low_stock')}
                        </p>
                        <p className="text-[11px] font-medium text-red-600 dark:text-red-400 shrink-0 bg-red-100 dark:bg-red-500/10 px-2 py-0.5 rounded-md" dir="ltr">
                          {td('stock_alerts.min_label')}: {produit.stock_min}
                        </p>
                      </div>

                      {/* Gradient progress bar (always fills left→right) */}
                      <div className="mt-3 h-2 w-full rounded-md bg-red-100/80 dark:bg-white/10 overflow-hidden" dir="ltr">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-emerald-500/10 rounded-lg p-4 mb-3">
                    <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{td('stock_alerts.optimal_title')}</p>
                  <p className="text-xs text-muted-foreground">{td('stock_alerts.optimal_subtitle')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TVA Summary ───────────────────────────────────────────────────── */}
      <Card className="card-elevated border-transparent dark:border-border p-0 overflow-hidden !rounded-[10px]">
        {/* Card header banner */}
        <div className="bg-gradient-to-r from-[#EEEDFB] via-[#F2F2FA] to-[#EEEDFB] dark:from-[#6D5BF6]/10 dark:via-[#6D5BF6]/5 dark:to-[#6D5BF6]/10 px-6 py-4 border-b border-[#EAEAF4] dark:border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#6D5BF6]/15 dark:bg-[#6D5BF6]/10 shrink-0">
            <PieChart className="h-5 w-5 text-[#6D5BF6] dark:text-[#A78BFA]" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{td('tva.section_title')}</h3>
            <p className="text-xs text-muted-foreground">{td('tva.section_subtitle')}</p>
          </div>
        </div>

        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-3">

            {/* TVA Collectée */}
            <div className="rounded-lg border border-[#EAEAF4] dark:border-white/10 bg-card p-4 space-y-3 transition-colors duration-200 hover:border-[#6D5BF6]/35">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-start">
                  {td('tva.collected')}
                </p>
                <div className="h-2.5 w-2.5 rounded-full bg-[#6D5BF6] shrink-0 ring-4 ring-[#6D5BF6]/15" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaCollectee ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              {/* Progress bar always reads left→right */}
              <div className="h-2 w-full bg-[#EEEEF6] dark:bg-white/10 rounded-md overflow-hidden" dir="ltr">
                <div className="h-full bg-gradient-to-r from-[#6D5BF6] to-[#A78BFA] rounded-md w-[70%]" />
              </div>
            </div>

            {/* TVA Déductible */}
            <div className="rounded-lg border border-[#EAEAF4] dark:border-white/10 bg-card p-4 space-y-3 transition-colors duration-200 hover:border-[#8B7CF8]/35">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-start">
                  {td('tva.deductible')}
                </p>
                <div className="h-2.5 w-2.5 rounded-full bg-[#A78BFA] shrink-0 ring-4 ring-[#A78BFA]/15" />
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.totalTvaDeductible ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-[#EEEEF6] dark:bg-white/10 rounded-md overflow-hidden" dir="ltr">
                <div className="h-full bg-gradient-to-r from-[#A78BFA] to-[#C4B5FD] rounded-md w-[45%]" />
              </div>
            </div>

            {/* Solde TVA */}
            <div className="rounded-lg border border-[#EAEAF4] dark:border-white/10 bg-card p-4 space-y-3 transition-colors duration-200 hover:border-[#6D5BF6]/35">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-start">
                  {td('tva.balance')}
                </p>
                <Badge className={cn(
                  'font-bold shrink-0 rounded-md border-0',
                  (stats?.tvaNet ?? 0) > 0
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/10 dark:text-red-400'
                    : 'bg-[#6D5BF6]/10 text-[#4A3FCF] hover:bg-[#6D5BF6]/10 dark:text-[#A78BFA]',
                )}>
                  {(stats?.tvaNet ?? 0) > 0 ? td('tva.to_pay') : td('tva.credit')}
                </Badge>
              </div>
              <p className="text-2xl font-black text-foreground" dir="ltr">
                {Number(stats?.tvaNet ?? 0).toFixed(2)}{' '}
                <span className="text-sm font-medium text-muted-foreground">{td('tva.currency_short')}</span>
              </p>
              <div className="h-2 w-full bg-[#EEEEF6] dark:bg-white/10 rounded-md overflow-hidden" dir="ltr">
                {stats && Number(stats.totalTvaCollectee) > 0 && (
                  <div
                    className="h-full rounded-md transition-all"
                    style={{
                      width: `${Math.min(
                        (Math.abs(Number(stats.tvaNet)) / Number(stats.totalTvaCollectee)) * 100,
                        100,
                      )}%`,
                      backgroundColor: (stats?.tvaNet ?? 0) > 0 ? '#6D5BF6' : '#3B82F6',
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

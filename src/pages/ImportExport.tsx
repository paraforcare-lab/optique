import React, { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileJson,
  Trash2,
  ShieldAlert,
  Search,
  History,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'

export function ImportExport() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language?.startsWith('ar')

  // Shorthand so JSX stays clean
  const ie = (key: string) => t(`import_export.${key}`)

  const [isExporting, setIsExporting]               = useState(false)
  const [isImporting, setIsImporting]               = useState(false)
  const [isLinking, setIsLinking]                   = useState(false)
  const [linkingMessage, setLinkingMessage]         = useState('')
  const [isComptableExporting, setIsComptableExporting] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen]   = useState(false)
  const [isResetting, setIsResetting]               = useState(false)
  const [resetEmail, setResetEmail]                 = useState('')
  const [resetPassword, setResetPassword]           = useState('')

  // ─── Stock History state ──────────────────────────────────────────────────
  const [produits, setProduits]                     = useState<any[]>([])
  const [stockHistory, setStockHistory]             = useState<any[]>([])
  const [selectedProduitId, setSelectedProduitId]   = useState<number | ''>('')
  const [produitSearch, setProduitSearch]           = useState('')
  const [isLoadingHistory, setIsLoadingHistory]     = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('produits')
      .select('id, designation, nom, reference')
      .eq('user_id', user.id)
      .order('designation', { ascending: true })
      .then(({ data }) => setProduits(data || []))
  }, [user?.id])

  const fetchStockHistory = async (produitId: number) => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`/api/stock-history?produit_id=${produitId}&limit=200`)
      if (res.ok) {
        const data = await res.json()
        setStockHistory(data || [])
      } else {
        setStockHistory([])
      }
    } catch {
      setStockHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (selectedProduitId) {
      fetchStockHistory(Number(selectedProduitId))
    } else {
      setStockHistory([])
    }
  }, [selectedProduitId])

  const filteredProduits = produitSearch
    ? produits.filter(p =>
        `${p.designation || ''} ${p.nom || ''} ${p.reference || ''}`
          .toLowerCase().includes(produitSearch.toLowerCase())
      )
    : produits

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      achat: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      vente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      annulation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      ajustement: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      initial: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    }
    return colors[type] || 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  }

  // ─── Unsaved-params guard ─────────────────────────────────────────────────
  const STORAGE_KEY = 'sf_params_modified'
  function checkParamsModified(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) !== null
  }

  function warnUnsaved() {
    toast.warning(ie('export.toast_unsaved_title'), {
      description: ie('export.toast_unsaved_body'),
    })
  }

  // ─── Reset database ───────────────────────────────────────────────────────
  const handleResetDatabase = async () => {
    if (!resetEmail || !resetPassword) {
      toast.error(ie('reset.toast_error_creds'))
      return
    }
    setIsResetting(true)
    try {
      const response = await fetch('/api/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, password: resetPassword }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || ie('reset.toast_error'))
      }
      toast.success(ie('reset.toast_success'))
      setIsResetDialogOpen(false)
      setResetEmail('')
      setResetPassword('')
      window.location.reload()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message)
    } finally {
      setIsResetting(false)
    }
  }

  // ─── Full backup export ───────────────────────────────────────────────────
  const handleFullBackupExport = async () => {
    if (checkParamsModified()) { warnUnsaved(); return }
    setIsExporting(true)
    try {
      const response = await fetch('/api/backup/data')
      if (!response.ok) throw new Error(ie('export.toast_error'))
      const data = await response.json()

      const workbook = XLSX.utils.book_new()
      Object.keys(data).forEach(tableName => {
        const worksheet = XLSX.utils.json_to_sheet(data[tableName])
        XLSX.utils.book_append_sheet(workbook, worksheet, tableName.substring(0, 31))
      })
      XLSX.writeFile(workbook, `OptiGestion_Backup_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(ie('export.toast_success'))
    } catch (error) {
      console.error(error)
      toast.error(ie('export.toast_error'))
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Full backup import ───────────────────────────────────────────────────
  const handleFullBackupImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const backupData: any = {}
          workbook.SheetNames.forEach(sheetName => {
            backupData[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
          })

          if (!user?.id) {
            toast.error(ie('import.toast_relogin'))
            setIsImporting(false)
            return
          }

          setIsLinking(true)
          setLinkingMessage(ie('linking.in_progress'))
          setIsImporting(false)

          const response = await fetch('/api/backup/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...backupData, user_id: user?.id }),
          })

          setLinkingMessage(ie('linking.linking_entities'))

          if (!response.ok) throw new Error(ie('import.toast_error'))
          const result = await response.json()

          setIsLinking(false)

          const successCounts = Object.entries(result.results || {})
            .filter(([_, r]: [string, any]) => r.success)
            .map(([table, r]: [string, any]) => `${table}: ${r.count} ligne(s)`)
            .join(', ')

          const errorTables = Object.entries(result.results || {})
            .filter(([_, r]: [string, any]) => !r.success)
            .map(([table, r]: [string, any]) => `${table}: ${r.error}`)
            .join(', ')

          if (errorTables) {
            toast.warning(ie('import.toast_partial'), {
              description: `Imported: ${successCounts}. Errors: ${errorTables}`,
            })
          } else {
            toast.success(ie('import.toast_success'), {
              description: successCounts || t('shared.empty.no_results'),
            })
          }
        } catch (error) {
          console.error(error)
          toast.error(ie('import.toast_error_read'))
        } finally {
          setIsImporting(false)
          event.target.value = ''
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error(error)
      toast.error(ie('import.toast_error'))
      setIsImporting(false)
    }
  }

  // ─── Accounting export ────────────────────────────────────────────────────
  const handleComptableExport = async () => {
    if (checkParamsModified()) { warnUnsaved(); return }
    setIsComptableExporting(true)
    try {
      const response = await fetch('/api/backup/data')
      if (!response.ok) throw new Error(ie('comptable.toast_error'))
      const data = await response.json()

      const workbook = XLSX.utils.book_new()

      // Sheet labels use the current locale's column names
      const salesData = data.factures.map((f: any) => ({
        [t('shared.table.number')]:     f.numero,
        [t('shared.table.date')]:       f.date,
        [t('shared.table.client')]:     data.clients.find((c: any) => c.id === f.client_id)?.nom || '-',
        'Montant HT':                   f.montant_ht,
        'Montant TVA':                  f.montant_tva,
        'Montant TTC':                  f.montant_ttc,
        [t('shared.table.status')]:     f.statut,
        'Reste à payer':                f.reste_a_payer,
      }))
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), 'Ventes')

      const purchasesData = data.bons_commande.map((bc: any) => ({
        [t('shared.table.number')]:   bc.numero,
        [t('shared.table.date')]:     bc.date,
        [t('shared.table.supplier')]: data.fournisseurs.find((f: any) => f.id === bc.fournisseur_id)?.nom || '-',
        'Montant HT':                 bc.montant_ht,
        'Montant TVA':                bc.montant_tva,
        'Montant TTC':                bc.montant_ttc,
        [t('shared.table.status')]:   bc.statut,
      }))
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchasesData), 'Achats')

      const expensesData = data.depenses.map((d: any) => ({
        [t('shared.table.reference')]: d.reference,
        [t('shared.table.date')]:       d.date_depense,
        [t('depenses.col_category')]:   d.categorie,
        [t('shared.table.description')]:d.description,
        'Montant HT':                   d.montant_ht,
        'Montant TVA':                  d.montant_tva,
        'Montant TTC':                  d.montant_ttc,
      }))
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expensesData), 'Dépenses')

      const tvaFactures       = salesData.reduce((sum: number, s: any) => sum + (s['Montant TVA'] || 0), 0)
      const tvaAvoirs         = (data.avoirs || []).reduce((sum: number, a: any) => sum + (a.montant_tva || 0), 0)
      const tvaVP             = (data.ventes_passagers || []).reduce((sum: number, vp: any) => sum + (vp.montant_tva || 0), 0)
      const totalTvaCollectee = tvaFactures - tvaAvoirs + tvaVP
      const tvaBC             = purchasesData.reduce((sum: number, p: any) => sum + (p['Montant TVA'] || 0), 0)
      const tvaDepenses       = expensesData.reduce((sum: number, ex: any) => sum + (ex['Montant TVA'] || 0), 0)
      const totalTvaDeductible = tvaBC + tvaDepenses

      const tvaData = [
        { Type: 'TVA Collectée (Factures)',       Montant: tvaFactures },
        { Type: 'TVA Collectée (Avoirs)',          Montant: -tvaAvoirs },
        { Type: 'TVA Collectée (Ventes Passagers)',Montant: tvaVP },
        { Type: 'TOTAL TVA COLLECTÉE',             Montant: totalTvaCollectee },
        { Type: '',                                Montant: '' },
        { Type: 'TVA Déductible (Achats)',         Montant: tvaBC },
        { Type: 'TVA Déductible (Dépenses)',       Montant: tvaDepenses },
        { Type: 'TOTAL TVA DÉDUCTIBLE',            Montant: totalTvaDeductible },
        { Type: '',                                Montant: '' },
        { Type: 'TVA NETTE À PAYER / CRÉDIT',      Montant: totalTvaCollectee - totalTvaDeductible },
      ]
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tvaData), 'TVA')

      XLSX.writeFile(workbook, `OptiGestion_Export_Comptable_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(ie('comptable.toast_success'))
    } catch (error) {
      console.error(error)
      toast.error(ie('comptable.toast_error'))
    } finally {
      setIsComptableExporting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Linking progress dialog ──────────────────────────────────────── */}
      <Dialog open={isLinking} onOpenChange={setIsLinking}>
        <DialogContent className="sm:max-w-md dark:bg-[#0b1222] dark:border-white/5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#267E54]" />
              {ie('linking.dialog_title')}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {linkingMessage || ie('linking.dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 border-4 border-[#267E54]/30 border-t-[#267E54] rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {ie('linking.wait_hint')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 md:space-y-8"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {ie('page_title')}
          </h1>
          <p className="text-muted-foreground dark:text-slate-400">
            {ie('page_subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 p-4 md:p-6 rounded-xl md:rounded-2xl space-y-4 md:space-y-6 shadow-none">
          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 rounded-xl md:rounded-2xl dark:bg-slate-800/50">
              <TabsTrigger value="export"      className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">{ie('tabs.export')}</TabsTrigger>
              <TabsTrigger value="import"      className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">{ie('tabs.import')}</TabsTrigger>
              <TabsTrigger value="comptable"   className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">{ie('tabs.comptable')}</TabsTrigger>
              <TabsTrigger value="histourique" className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">{ie('tabs.histourique')}</TabsTrigger>
              <TabsTrigger value="reset"       className="text-red-500 dark:text-red-400 data-[state=active]:dark:bg-slate-700">{ie('tabs.reset')}</TabsTrigger>
            </TabsList>

            {/* ── EXPORT TAB ─────────────────────────────────────────── */}
            <TabsContent value="export" className="mt-6 md:mt-8">
              <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Download className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    {ie('export.card_title')}
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    {ie('export.card_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Info banner */}
                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                        {ie('export.info_title')}
                      </p>
                      <p className="text-blue-800 dark:text-blue-400 text-sm">
                        {ie('export.info_body')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center py-4 sm:py-8 gap-4">
                    <Button
                      size="lg"
                      onClick={handleFullBackupExport}
                      disabled={isExporting}
                      className="bg-[#267E54] hover:bg-[#1e6643] w-full sm:max-w-xs rounded-xl shadow-none dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          {ie('export.btn_exporting')}
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="me-2 h-5 w-5" />
                          {ie('export.btn_export')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── IMPORT TAB ─────────────────────────────────────────── */}
            <TabsContent value="import" className="mt-6 md:mt-8">
              <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <Upload className="h-5 w-5 text-orange-500 dark:text-orange-400 shrink-0" />
                    {ie('import.card_title')}
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    {ie('import.card_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Warning banner */}
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-300 text-sm">
                        {ie('import.warning_title')}
                      </p>
                      <p className="text-red-800 dark:text-red-400 text-sm">
                        {ie('import.warning_body')}
                      </p>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 space-y-4 dark:bg-slate-900/50">
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-full">
                      <FileJson className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {ie('import.dropzone_label')}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {ie('import.dropzone_format')}
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFullBackupImport}
                      disabled={isImporting}
                      className="hidden"
                      id="backup-upload"
                    />
                    <Button
                      variant="outline"
                      disabled={isImporting}
                      onClick={() => document.getElementById('backup-upload')?.click()}
                      className="rounded-xl shadow-none dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-600"
                    >
                      <span className="cursor-pointer flex items-center">
                        {isImporting ? (
                          <>
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                            {ie('import.btn_importing')}
                          </>
                        ) : (
                          <>
                            <Upload className="me-2 h-4 w-4" />
                            {ie('import.btn_select')}
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── COMPTABLE TAB ───────────────────────────────────────── */}
            <TabsContent value="comptable" className="mt-6 md:mt-8">
              <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <FileSpreadsheet className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />
                    {ie('comptable.card_title')}
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    {ie('comptable.card_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Feature grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      { title: ie('comptable.feature_sales'),    sub: ie('comptable.feature_sales_sub') },
                      { title: ie('comptable.feature_expenses'),  sub: ie('comptable.feature_expenses_sub') },
                      { title: ie('comptable.feature_vat'),       sub: ie('comptable.feature_vat_sub') },
                      { title: ie('comptable.feature_payments'),  sub: ie('comptable.feature_payments_sub') },
                    ] as { title: string; sub: string }[]).map(({ title, sub }) => (
                      <div
                        key={title}
                        className="flex items-start gap-3 p-4 border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#0b1222]"
                      >
                        <div className="bg-green-100 dark:bg-slate-800/50 p-2 rounded-full shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center py-4 sm:py-8 gap-4">
                    <Button
                      size="lg"
                      onClick={handleComptableExport}
                      disabled={isComptableExporting}
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:max-w-xs rounded-xl shadow-none dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
                    >
                      {isComptableExporting ? (
                        <>
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          {ie('comptable.btn_generating')}
                        </>
                      ) : (
                        <>
                          <Download className="me-2 h-5 w-5" />
                          {ie('comptable.btn_generate')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── STOCK HISTORY TAB ──────────────────────────────────── */}
            <TabsContent value="histourique" className="mt-6 md:mt-8">
              <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-white">
                    <History className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />
                    {ie('histourique.card_title')}
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    {ie('histourique.card_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Product search / select */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={ie('histourique.search_placeholder')}
                      value={produitSearch}
                      onChange={(e) => setProduitSearch(e.target.value)}
                      className="pl-9 dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    <button
                      onClick={() => setSelectedProduitId('')}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        selectedProduitId === ''
                          ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {ie('histourique.all_products')}
                    </button>
                    {filteredProduits.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduitId(p.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          selectedProduitId === p.id
                            ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                            : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p.designation || p.nom || p.reference || `#${p.id}`}
                      </button>
                    ))}
                  </div>

                  {/* History table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                          <TableHead className="dark:text-slate-300">{ie('histourique.col_date')}</TableHead>
                          <TableHead className="dark:text-slate-300">{ie('histourique.col_type')}</TableHead>
                          <TableHead className="dark:text-slate-300">{ie('histourique.col_document')}</TableHead>
                          <TableHead className="text-right dark:text-slate-300">{ie('histourique.col_quantite')}</TableHead>
                          <TableHead className="text-right dark:text-slate-300">{ie('histourique.col_ancien')}</TableHead>
                          <TableHead className="text-right dark:text-slate-300">{ie('histourique.col_nouveau')}</TableHead>
                          <TableHead className="dark:text-slate-300">{ie('histourique.col_notes')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingHistory ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                            </TableCell>
                          </TableRow>
                        ) : stockHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {ie('histourique.empty')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          stockHistory.map((h: any) => (
                            <TableRow key={h.id} className="dark:border-slate-700">
                              <TableCell className="text-xs whitespace-nowrap dark:text-slate-300">
                                {formatDate(h.createdAt || h.created_at)}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${typeBadge(h.type)}`}>
                                  {ie(`histourique.type_${h.type}`)}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs dark:text-slate-300">
                                {h.sourceDocumentRef || h.source_document_ref || '-'}
                                {h.sourceDocumentId || h.source_document_id ? ` (#${h.sourceDocumentId || h.source_document_id})` : ''}
                              </TableCell>
                              <TableCell className={`text-right text-xs font-mono font-medium ${
                                Number(h.quantite) > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : Number(h.quantite) < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'dark:text-slate-300'
                              }`}>
                                {Number(h.quantite) > 0 ? '+' : ''}{Number(h.quantite)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono dark:text-slate-300">
                                {Number(h.ancienStock || h.ancien_stock)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono dark:text-slate-300">
                                {Number(h.nouveauStock || h.nouveau_stock)}
                              </TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate dark:text-slate-400">
                                {h.notes || '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── RESET TAB ──────────────────────────────────────────── */}
            <TabsContent value="reset" className="mt-6 md:mt-8">
              <Card className="bg-white dark:bg-[#0b1222] border-red-200 dark:border-red-500/20 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Trash2 className="h-5 w-5 shrink-0" />
                    {ie('reset.card_title')}
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    {ie('reset.card_subtitle')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Danger banner */}
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-lg flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-300 text-sm">
                        {ie('reset.danger_title')}
                      </p>
                      <p className="text-red-800 dark:text-red-400 text-sm">
                        {ie('reset.danger_body')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center py-4 sm:py-8 gap-4">
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={() => setIsResetDialogOpen(true)}
                      className="w-full sm:max-w-xs rounded-xl shadow-none"
                    >
                      <Trash2 className="me-2 h-5 w-5" />
                      {ie('reset.btn_open_dialog')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Reset confirmation dialog ──────────────────────────────── */}
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-[425px] dark:bg-[#0b1222] dark:border-white/5">
            <DialogHeader>
              <DialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                {ie('reset.dialog_title')}
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400">
                {ie('reset.dialog_desc')}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-email" className="dark:text-slate-300 text-start">
                  {ie('reset.label_email')}
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={ie('reset.placeholder_email')}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
                  /*
                   * RTL: email addresses are always LTR artefacts (latin script).
                   * Pinning dir=ltr keeps the cursor and placeholder readable.
                   */
                  dir="ltr"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reset-password" className="dark:text-slate-300 text-start">
                  {ie('reset.label_password')}
                </Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
                  dir="ltr"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(false)}
                disabled={isResetting}
                className="rounded-xl shadow-none dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-600"
              >
                {ie('reset.btn_cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetDatabase}
                disabled={isResetting}
                className="rounded-xl shadow-none"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {ie('reset.btn_resetting')}
                  </>
                ) : (
                  ie('reset.btn_confirm')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

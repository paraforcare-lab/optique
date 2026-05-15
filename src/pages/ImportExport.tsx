import React, { useState } from 'react'
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  FileJson,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function ImportExport() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkingMessage, setLinkingMessage] = useState('');
  const [isComptableExporting, setIsComptableExporting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const handleResetDatabase = async () => {
    if (!resetEmail || !resetPassword) {
      toast.error('Veuillez saisir votre email et mot de passe');
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, password: resetPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la réinitialisation');
      }

      toast.success('Base de données réinitialisée avec succès');
      setIsResetDialogOpen(false);
      setResetEmail('');
      setResetPassword('');
      // Optionally redirect or refresh
      window.location.reload();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const STORAGE_KEY = 'sf_params_modified';

  function checkParamsModified(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  const handleFullBackupExport = async () => {
    if (checkParamsModified()) {
      toast.warning(
        'Modifications non enregistrées',
        { description: 'Veuillez enregistrer vos paramètres avant d\'exporter.' }
      );
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch('/api/backup/data');
      if (!response.ok) throw new Error('Erreur lors de la récupération des données');
      const data = await response.json();

      const workbook = XLSX.utils.book_new();

      // Add each table as a sheet
      Object.keys(data).forEach(tableName => {
        const worksheet = XLSX.utils.json_to_sheet(data[tableName]);
        XLSX.utils.book_append_sheet(workbook, worksheet, tableName.substring(0, 31)); // Sheet name max 31 chars
      });

      XLSX.writeFile(workbook, `SmartFacture_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Sauvegarde complète exportée avec succès');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'exportation de la sauvegarde');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFullBackupImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const backupData: any = {};
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            backupData[sheetName] = XLSX.utils.sheet_to_json(worksheet);
          });

          // Send to backend
          if (!user?.id) {
            toast.error('Veuillez vous reconnecter avant d\'importer');
            setIsImporting(false);
            return;
          }
          
          console.log('Importing with user:', user.id);
          
          // Show linking progress popup while waiting for response
          setIsLinking(true);
          setLinkingMessage('Importation en cours...');
          setIsImporting(false);
          
          const response = await fetch('/api/backup/import', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...backupData, user_id: user?.id }),
          });
          
          setLinkingMessage('Liaison des clients et fournisseurs...');

          if (!response.ok) throw new Error('Erreur lors de l\'importation');
          const result = await response.json();
          
          setIsLinking(false);
          
          // Build success message from results
          const successCounts = Object.entries(result.results || {})
            .filter(([_, r]: [string, any]) => r.success)
            .map(([table, r]: [string, any]) => `${table}: ${r.count} ligne(s)`)
            .join(', ');
          
          const errorTables = Object.entries(result.results || {})
            .filter(([_, r]: [string, any]) => !r.success)
            .map(([table, r]: [string, any]) => `${table}: ${r.error}`)
            .join(', ');
          
          if (errorTables) {
            toast.warning('Import partiel', { description: `Importé: ${successCounts}. Erreurs: ${errorTables}` });
          } else {
            toast.success('Sauvegarde restaurée avec succès', { description: successCounts || 'Aucune donnée importée' });
          }
          console.log('Import results:', result.results);
        } catch (error) {
          console.error(error);
          toast.error('Erreur lors de la lecture ou de l\'importation du fichier');
        } finally {
          setIsImporting(false);
          // Clear input
          event.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'importation');
      setIsImporting(false);
    }
  };

  const handleComptableExport = async () => {
    if (checkParamsModified()) {
      toast.warning(
        'Modifications non enregistrées',
        { description: 'Veuillez enregistrer vos paramètres avant d\'exporter.' }
      );
      return;
    }
    setIsComptableExporting(true);
    try {
      const response = await fetch('/api/backup/data');
      if (!response.ok) throw new Error('Erreur lors de la récupération des données');
      const data = await response.json();

      const workbook = XLSX.utils.book_new();

      // 1. Ventes (Factures)
      const salesData = data.factures.map((f: any) => ({
        'Numéro': f.numero,
        'Date': f.date,
        'Client': data.clients.find((c: any) => c.id === f.client_id)?.nom || 'Client inconnu',
        'Montant HT': f.montant_ht,
        'Montant TVA': f.montant_tva,
        'Montant TTC': f.montant_ttc,
        'Statut': f.statut,
        'Reste à payer': f.reste_a_payer
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), 'Ventes');

      // 2. Achats (Bons de Commande)
      const purchasesData = data.bons_commande.map((bc: any) => ({
        'Numéro': bc.numero,
        'Date': bc.date,
        'Fournisseur': data.fournisseurs.find((f: any) => f.id === bc.fournisseur_id)?.nom || 'Fournisseur inconnu',
        'Montant HT': bc.montant_ht,
        'Montant TVA': bc.montant_tva,
        'Montant TTC': bc.montant_ttc,
        'Statut': bc.statut
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchasesData), 'Achats');

      // 3. Dépenses
      const expensesData = data.depenses.map((d: any) => ({
        'Référence': d.reference,
        'Date': d.date_depense,
        'Catégorie': d.categorie,
        'Description': d.description,
        'Montant HT': d.montant_ht,
        'Montant TVA': d.montant_tva,
        'Montant TTC': d.montant_ttc
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expensesData), 'Dépenses');

      // 4. TVA (Collected & Deductible)
      const tvaFactures = salesData.reduce((sum: number, s: any) => sum + (s['Montant TVA'] || 0), 0);
      const tvaAvoirs = (data.avoirs || []).reduce((sum: number, a: any) => sum + (a.montant_tva || 0), 0);
      const tvaVP = (data.ventes_passagers || []).reduce((sum: number, vp: any) => sum + (vp.montant_tva || 0), 0);
      const totalTvaCollectee = tvaFactures - tvaAvoirs + tvaVP;

      const tvaBC = purchasesData.reduce((sum: number, p: any) => sum + (p['Montant TVA'] || 0), 0);
      const tvaDepenses = expensesData.reduce((sum: number, e: any) => sum + (e['Montant TVA'] || 0), 0);
      const totalTvaDeductible = tvaBC + tvaDepenses;

      const tvaData = [
        { 'Type': 'TVA Collectée (Factures)', 'Montant': tvaFactures },
        { 'Type': 'TVA Collectée (Avoirs)', 'Montant': -tvaAvoirs },
        { 'Type': 'TVA Collectée (Ventes Passagers)', 'Montant': tvaVP },
        { 'Type': 'TOTAL TVA COLLECTÉE', 'Montant': totalTvaCollectee },
        { 'Type': '', 'Montant': '' },
        { 'Type': 'TVA Déductible (Achats)', 'Montant': tvaBC },
        { 'Type': 'TVA Déductible (Dépenses)', 'Montant': tvaDepenses },
        { 'Type': 'TOTAL TVA DÉDUCTIBLE', 'Montant': totalTvaDeductible },
        { 'Type': '', 'Montant': '' },
        { 'Type': 'FORMULE', 'Montant': 'TVA à payer = TVA collectée - TVA déductible' },
        { 'Type': 'TVA NETTE À PAYER / CRÉDIT', 'Montant': totalTvaCollectee - totalTvaDeductible }
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(tvaData), 'TVA');

      XLSX.writeFile(workbook, `SmartFacture_Export_Comptable_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export comptable généré avec succès');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération de l\'export comptable');
    } finally {
      setIsComptableExporting(false);
    }
  };

  return (
    <>
      {/* Linking Progress Dialog */}
      <Dialog open={isLinking} onOpenChange={setIsLinking}>
        <DialogContent className="sm:max-w-md dark:bg-[#0b1222] dark:border-white/5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#267E54]" />
              Liaison en cours
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {linkingMessage || 'Veuillez patienter pendant que nous lions les clients et fournisseurs...'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 border-4 border-[#267E54]/30 border-t-[#267E54] rounded-full animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Cette opération peut prendre quelques secondes...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Import / Export</h1>
        <p className="text-muted-foreground dark:text-slate-400">
          Gérez vos sauvegardes et exportez vos données pour votre comptabilité.
        </p>
      </div>

      <div className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 p-4 md:p-6 rounded-xl md:rounded-2xl space-y-4 md:space-y-6 shadow-none">
          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 rounded-xl md:rounded-2xl dark:bg-slate-800/50">
              <TabsTrigger value="export" className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">Export</TabsTrigger>
              <TabsTrigger value="import" className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">Import</TabsTrigger>
              <TabsTrigger value="comptable" className="dark:text-slate-300 data-[state=active]:dark:text-white data-[state=active]:dark:bg-slate-700">Comptable</TabsTrigger>
              <TabsTrigger value="reset" className="text-red-500 dark:text-red-400 data-[state=active]:dark:bg-slate-700">Reset</TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="mt-6 md:mt-8">
          <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Download className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                Sauvegarde Complète
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Téléchargez l'intégralité de vos données (produits, factures, clients, etc.) dans un seul fichier Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Recommandation</p>
                  <p className="text-blue-800 dark:text-blue-400 text-sm">Nous vous conseillons d'exporter une sauvegarde complète au moins une fois par semaine pour sécuriser vos données.</p>
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exportation en cours...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-5 w-5" />
                      Exporter en Excel (.xlsx)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-6 md:mt-8">
          <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <Upload className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                Restaurer une Sauvegarde
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Importez un fichier Excel précédemment exporté pour restaurer vos données.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-300 text-sm">Attention</p>
                  <p className="text-red-800 dark:text-red-400 text-sm">L'importation peut écraser ou modifier vos données actuelles. Assurez-vous d'avoir une sauvegarde récente avant de procéder.</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 space-y-4 dark:bg-slate-900/50">
                <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-full">
                  <FileJson className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Glissez votre fichier ici ou cliquez pour parcourir</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Format accepté: .xlsx uniquement</p>
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importation en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Sélectionner un fichier
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comptable" className="mt-6 md:mt-8">
          <Card className="bg-white dark:bg-[#0b1222] border-slate-200 dark:border-white/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <FileSpreadsheet className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                Export pour Comptabilité
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Générez un fichier Excel structuré par onglets pour faciliter le travail de votre comptable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#0b1222]">
                  <div className="bg-green-100 dark:bg-slate-800/50 p-2 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Ventes & Achats</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Historique complet des factures et bons de commande.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#0b1222]">
                  <div className="bg-green-100 dark:bg-slate-800/50 p-2 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Dépenses</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Détail des charges et frais de fonctionnement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#0b1222]">
                  <div className="bg-green-100 dark:bg-slate-800/50 p-2 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Analyse TVA</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Calcul automatique de la TVA collectée et déductible.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-[#0b1222]">
                  <div className="bg-green-100 dark:bg-slate-800/50 p-2 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Paiements</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Suivi des règlements et des impayés.</p>
                  </div>
                </div>
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-5 w-5" />
                      Générer l'Export Comptable
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reset" className="mt-6 md:mt-8">
          <Card className="bg-white dark:bg-[#0b1222] border-red-200 dark:border-red-500/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
                Réinitialisation Totale
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Supprimez définitivement toutes les données de l'application. Cette action est irréversible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-lg flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-300 text-sm">Zone de Danger</p>
                  <p className="text-red-800 dark:text-red-400 text-sm">
                    En cliquant sur le bouton ci-dessous, vous supprimerez tous les clients, produits, factures, et historiques. 
                    Assurez-vous d'avoir exporté une sauvegarde avant de continuer.
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
                  <Trash2 className="mr-2 h-5 w-5" />
                  Réinitialiser toutes les données
                </Button>
              </div>
            </CardContent>
</Card>
          </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-[425px] dark:bg-[#0b1222] dark:border-white/5">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Confirmation de sécurité
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Cette action est extrêmement dangereuse. Pour confirmer la suppression de TOUTES les données, veuillez saisir vos identifiants de connexion.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="dark:text-slate-300">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="votre@email.com" 
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="dark:text-slate-300">Mot de passe</Label>
              <Input 
                id="password" 
                type="password" 
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="dark:bg-slate-800/50 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={isResetting} className="rounded-xl shadow-none dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-600">
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleResetDatabase}
              disabled={isResetting}
              className="rounded-xl shadow-none"
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Réinitialisation...
                </>
              ) : (
                "Confirmer la suppression totale"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
</Dialog>
    </div>
    </>
  );
}

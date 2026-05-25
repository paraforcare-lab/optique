import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { updateStockAndNotify, ensureLowStockNotifications } from '@/lib/notifications'
import { generateDocumentNumber } from '@/lib/numbering'

interface BCFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function BonCommandeForm({ initialData, onSuccess }: BCFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [parametres, setParametres] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prescriptionSelectKey, setPrescriptionSelectKey] = useState(0);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [verreProductId, setVerreProductId] = useState('');
  const [verrePrixHt, setVerrePrixHt] = useState(0);
  const [verreTva, setVerreTva] = useState(20);
  const [verreDesignation, setVerreDesignation] = useState('');

  const ligneSchema = z.object({
    produitId: z.string().optional(),
    reference: z.string().optional(),
    designation: z.string().min(1, t('shared.validation.designation_required')),
    quantite: z.number().min(0.01, t('shared.validation.qty_min')),
    prixUnitaireHt: z.number().min(0, t('shared.validation.price_positive')),
    tva: z.number().min(0, t('shared.validation.vat_positive')),
    prescriptionId: z.string().optional(),
  });

  const bcSchema = z.object({
    type: z.string().optional(),
    fournisseurId: z.string().optional(),
    clientId: z.string().optional(),
    dateEmission: z.string().min(1, t('shared.validation.emission_date_required')),
    dateLivraisonPrevue: z.string().optional(),
    statut: z.string().optional(),
    modePaiement: z.string().optional(),
    notes: z.string().optional(),
    lignes: z.array(ligneSchema).min(0).optional(),
  }).superRefine((data, ctx) => {
    if (data.type === 'verre') {
      if (!data.clientId || data.clientId === '' || data.clientId === 'none') {
        ctx.addIssue({ code: 'custom', path: ['clientId'], message: 'Le client est requis' });
      }
    }
  });

  type BCFormValues = z.infer<typeof bcSchema>;

  const form = useForm<BCFormValues>({
    resolver: zodResolver(bcSchema),
    defaultValues: {
      type: initialData?.type || 'simple',
      fournisseurId: initialData?.fournisseurId || '',
      clientId: initialData?.clientId || '',
      dateEmission: initialData?.dateEmission || new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: initialData?.dateLivraisonPrevue || '',
      statut: initialData?.statut || 'brouillon',
      modePaiement: initialData?.modePaiement || 'Virement',
      notes: initialData?.notes || '',
      lignes: initialData?.lignes?.length > 0
        ? initialData.lignes.map((l: any) => ({
            produitId: l.produitId?.toString() || '',
            reference: l.reference || '',
            designation: l.designation || '',
            quantite: Number(l.quantite || 1),
            prixUnitaireHt: Number(l.prixUnitaireHt || 0),
            tva: Number(l.tva || 20),
            prescriptionId: l.prescriptionId?.toString() || '',
          }))
        : [{ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lignes',
  });

  const bcType = form.watch('type');
  const clientId = form.watch('clientId');
  const verreProducts = produits.filter((p) => p.type_produit === 'verre');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      const doQuery = async (query: any) => {
        try { return (await query)?.data || null; }
        catch { return null; }
      };
      const [fournisseurs, produits, clients, parametres] = await Promise.all([
        doQuery(supabase.from('fournisseurs').select('*').eq('user_id', user.id).order('nom')),
        doQuery(supabase.from('produits').select('*').eq('user_id', user.id).order('designation')),
        doQuery(supabase.from('clients').select('*').eq('user_id', user.id).order('nom')),
        doQuery(supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)),
      ]);
      setFournisseurs(fournisseurs || []);
      setProduits(produits || []);
      setClients(clients || []);
      setParametres(parametres?.[0] || null);
    };
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (initialData?.id && !form.formState.isDirty) {
      form.reset({
        type: initialData.type || 'simple',
        fournisseurId: initialData.fournisseurId?.toString() || '',
        clientId: initialData.clientId?.toString() || '',
        dateEmission: initialData.dateCommande ? new Date(initialData.dateCommande).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        dateLivraisonPrevue: initialData.dateLivraisonPrevue ? new Date(initialData.dateLivraisonPrevue).toISOString().split('T')[0] : '',
        statut: initialData.statut || 'brouillon',
        modePaiement: initialData.modePaiement || 'Virement',
        notes: initialData.notes || '',
        lignes: initialData.lignes?.map((l: any) => ({
          produitId: l.produitId?.toString() || '',
          reference: l.reference || '',
          designation: l.designation || '',
          quantite: Number(l.quantite || 0),
          prixUnitaireHt: Number(l.prixUnitaireHt || 0),
          tva: Number(l.tva || 20),
          prescriptionId: l.prescriptionId?.toString() || '',
        })) || [],
      });
    }
  }, [initialData, form]);

  useEffect(() => {
    if (bcType === 'verre' && clientId) {
      const fetchPrescriptions = async () => {
        const { data } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('client_id', parseInt(clientId))
          .eq('statut', 'active')
          .order('date_ordonnance', { ascending: false });
        setPrescriptions(data || []);
      };
      fetchPrescriptions();
    } else {
      setPrescriptions([]);
    }
  }, [bcType, clientId]);

  const watchLignes = form.watch('lignes');

  const totals = bcType === 'verre'
    ? (() => {
        const ht = verrePrixHt;
        const tva = ht * (verreTva / 100);
        return { ht, tva, ttc: ht + tva };
      })()
    : watchLignes.reduce(
        (acc, ligne) => {
          const montantHt = (ligne.quantite || 0) * (ligne.prixUnitaireHt || 0);
          const montantTva = montantHt * ((ligne.tva || 0) / 100);
          return {
            ht: acc.ht + montantHt,
            tva: acc.tva + montantTva,
            ttc: acc.ttc + montantHt + montantTva,
          };
        },
        { ht: 0, tva: 0, ttc: 0 }
      );

  const handlePrescriptionSelect = (prescriptionId: string) => {
    const prescr = prescriptions.find((p) => p.id.toString() === prescriptionId);
    if (!prescr) return;
    if (bcType === 'verre') {
      setSelectedPrescription(prescr);
      const odStr = `OD: ${prescr.od_sph_vl ?? '-'}${prescr.od_cyl_vl ? ` (${prescr.od_cyl_vl})` : ''}`;
      const ogStr = `OG: ${prescr.og_sph_vl ?? '-'}${prescr.og_cyl_vl ? ` (${prescr.og_cyl_vl})` : ''}`;
      setVerreDesignation(`Verre ${prescr.verre_type || ''} — ${odStr} / ${ogStr}`);
    } else {
      const odStr = `OD: ${prescr.od_sph_vl ?? '-'}${prescr.od_cyl_vl ? ` (${prescr.od_cyl_vl})` : ''}`;
      const ogStr = `OG: ${prescr.og_sph_vl ?? '-'}${prescr.og_cyl_vl ? ` (${prescr.og_cyl_vl})` : ''}`;
      const designation = `Verre ${prescr.verre_type || ''} — ${odStr} / ${ogStr}`;
      append({
        produitId: '',
        reference: `ORD-${prescriptionId}`,
        designation,
        quantite: 1,
        prixUnitaireHt: 0,
        tva: 20,
        prescriptionId,
      });
    }
  };

  const handleProduitSelect = (index: number, produitId: string) => {
    const produit = produits.find((p) => p.id.toString() === produitId);
    if (produit) {
      form.setValue(`lignes.${index}.produitId`, produit.id.toString());
      form.setValue(`lignes.${index}.reference`, produit.reference || '');
      form.setValue(`lignes.${index}.designation`, produit.designation || produit.nom || '');
      form.setValue(`lignes.${index}.prixUnitaireHt`, Number(produit.prix_achat_ht || produit.prixAchatHt || 0));
      form.setValue(`lignes.${index}.tva`, Number(produit.taux_tva || produit.tva || 20));
    }
  };

  const handleVerreProductSelect = (productId: string) => {
    setVerreProductId(productId);
    const produit = verreProducts.find((p) => p.id.toString() === productId);
    if (produit) {
      setVerrePrixHt(Number(produit.prix_achat_ht || produit.prixAchatHt || 0));
      setVerreTva(Number(produit.taux_tva || produit.tva || 20));
    }
  };

  const selectedClient = clients.find((c) => c.id.toString() === clientId);

  const onSubmit = async (data: BCFormValues) => {
    setIsLoading(true);
    try {
      if (data.type === 'verre' && !selectedPrescription) {
        toast.error('Veuillez sélectionner une ordonnance');
        setIsLoading(false);
        return;
      }
      if (data.type === 'verre' && !data.clientId) {
        toast.error('Veuillez sélectionner un client');
        setIsLoading(false);
        return;
      }
      if (data.type === 'verre' && !verreProductId) {
        toast.error('Veuillez sélectionner un produit verre');
        setIsLoading(false);
        return;
      }
      let bonId = initialData?.id;
      let numero;

      if (!bonId) {
        numero = await generateDocumentNumber('bon_commande', user!.id);
      }

      const fournisseurId = data.fournisseurId && data.fournisseurId !== 'none' && data.fournisseurId !== ''
        ? parseInt(data.fournisseurId)
        : null;

      const parsedClientId = data.clientId && data.clientId !== 'none' && data.clientId !== ''
        ? parseInt(data.clientId)
        : null;

      const payload: any = {
        type: data.type || 'simple',
        date_commande: new Date(data.dateEmission).toISOString(),
        date_livraison_prevue: data.dateLivraisonPrevue ? new Date(data.dateLivraisonPrevue).toISOString() : null,
        statut: data.statut || 'brouillon',
        montant_ht: Number(totals.ht),
        montant_tva: Number(totals.tva),
        montant_ttc: Number(totals.ttc),
        numero: numero || initialData?.numero,
      };

      if (fournisseurId) payload.fournisseur_id = fournisseurId;
      if (parsedClientId) payload.client_id = parsedClientId;

      if (!bonId) {
        const { data: newBon, error } = await supabase.from('bons_commande').insert([{ ...payload, user_id: user?.id }]).select().single();
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        bonId = newBon.id;
      } else {
        const { error } = await supabase.from('bons_commande').update(payload).eq('id', bonId);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        await supabase.from('bon_commande_lignes').delete().eq('bon_commande_id', bonId);
      }

      const lignesPayload = data.type === 'verre' && selectedPrescription
        ? [{
            bon_commande_id: bonId,
            produit_id: verreProductId ? parseInt(verreProductId) : null,
            prescription_id: selectedPrescription.id,
            designation: verreDesignation || `Verre — Ordonnance #${selectedPrescription.id}`,
            quantite: 1,
            prix_unitaire_ht: Number(verrePrixHt || 0),
            tva: Number(verreTva || 20),
            montant_ht: Number(verrePrixHt || 0),
            montant_ttc: Number(verrePrixHt || 0) * (1 + Number(verreTva || 20) / 100),
            ordre: 0,
          }]
        : (data.lignes || []).map((ligne, index) => {
            const mht = Number(ligne.quantite || 0) * Number(ligne.prixUnitaireHt || 0);
            const mtva = mht * (Number(ligne.tva || 0) / 100);
            const mttc = mht + mtva;
            const produitId = ligne.produitId && ligne.produitId !== 'none' && ligne.produitId !== ''
              ? parseInt(ligne.produitId)
              : null;
            const prescrId = ligne.prescriptionId && ligne.prescriptionId !== 'none' && ligne.prescriptionId !== ''
              ? parseInt(ligne.prescriptionId)
              : null;
            return {
              bon_commande_id: bonId,
              produit_id: produitId,
              prescription_id: prescrId,
              designation: ligne.designation || '',
              quantite: Number(ligne.quantite || 0),
              prix_unitaire_ht: Number(ligne.prixUnitaireHt || 0),
              tva: Number(ligne.tva || 20),
              montant_ht: mht,
              montant_ttc: mttc,
              ordre: index,
            };
          });

      if (lignesPayload.length > 0) {
        const { error: lignesError } = await supabase.from('bon_commande_lignes').insert(lignesPayload);
        if (lignesError) {
          console.error('Lignes insert error:', lignesError);
          throw lignesError;
        }

        const activeStatuses = ['livré', 'livrée'];
        if (activeStatuses.includes(data.statut)) {
          for (const ligne of lignesPayload) {
            if (ligne.produit_id) {
              await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite));
            }
          }
        }
      }

      toast.success(initialData ? 'Bon de commande modifié' : 'Bon de commande créé');
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error?.message || error?.details || t('shared.toast.save_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Type selector */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">Type de commande</Label>
            <Select
              value={form.watch('type') || 'simple'}
              onValueChange={(val) => {
                form.setValue('type', val);
                if (val === 'verre') {
                  form.setValue('lignes', []);
                  setSelectedPrescription(null);
                  setVerreProductId('');
                  setVerrePrixHt(0);
                  setVerreTva(20);
                  setVerreDesignation('');
                } else {
                  form.setValue('clientId', '');
                  if (form.getValues('lignes')?.length === 0) {
                    form.setValue('lignes', [{ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 }]);
                  }
                }
              }}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                <SelectValue placeholder="Type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple Commande</SelectItem>
                <SelectItem value="verre">Verre Commande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.supplier_label')}</Label>
            <Select
              value={form.watch('fournisseurId') || ''}
              onValueChange={(val) => form.setValue('fournisseurId', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                <SelectValue placeholder={t('shared.form.select_supplier')} />
              </SelectTrigger>
              <SelectContent>
                {fournisseurs.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.nomSociete || f.nom || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bcType === 'verre' ? (
            <>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold dark:text-slate-300">Client</Label>
                <Select
                  value={form.watch('clientId') || ''}
                  onValueChange={(val) => {
                    form.setValue('clientId', val);
                    setSelectedPrescription(null);
                    setVerreProductId('');
                    setVerrePrixHt(0);
                    setVerreDesignation('');
                  }}
                >
                  <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClient && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold dark:text-slate-300">CINE</Label>
                  <Input value={selectedClient.cine || '-'} disabled className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white" />
                </div>
              )}
              {selectedClient?.couverture_sociale && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold dark:text-slate-300">Couverture</Label>
                  <Input value={`${(selectedClient.couverture_sociale || '').toUpperCase()} ${selectedClient.couverture_sociale_detail ? `(${selectedClient.couverture_sociale_detail})` : ''}`} disabled className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white" />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.emission_date')}</Label>
                <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateEmission')} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.planned_delivery')}</Label>
                <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateLivraisonPrevue')} />
              </div>
            </>
          )}
        </div>
        {bcType === 'verre' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.emission_date')}</Label>
              <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateEmission')} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.planned_delivery')}</Label>
              <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateLivraisonPrevue')} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.status_label')}</Label>
              <Select
                value={form.watch('statut') || 'brouillon'}
                onValueChange={(val) => form.setValue('statut', val)}
              >
                <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                  <SelectValue placeholder={t('shared.form.select_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">{t('shared.status.draft')}</SelectItem>
                  <SelectItem value="confirmé">{t('shared.status.confirmed')}</SelectItem>
                  <SelectItem value="livré">{t('shared.status.delivered')}</SelectItem>
                  <SelectItem value="annulé">{t('shared.status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {bcType === 'simple' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.status_label')}</Label>
              <Select
                value={form.watch('statut') || 'brouillon'}
                onValueChange={(val) => form.setValue('statut', val)}
              >
                <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                  <SelectValue placeholder={t('shared.form.select_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">{t('shared.status.draft')}</SelectItem>
                  <SelectItem value="confirmé">{t('shared.status.confirmed')}</SelectItem>
                  <SelectItem value="livré">{t('shared.status.delivered')}</SelectItem>
                  <SelectItem value="annulé">{t('shared.status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Lignes section */}
      {bcType === 'verre' ? (
        <>
          {/* Prescription selector for Verre */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Ordonnance</h3>
              <div className="flex gap-2">
                {clientId && (
                  <Select
                    key={prescriptionSelectKey}
                    onValueChange={(val) => {
                      handlePrescriptionSelect(val);
                      setPrescriptionSelectKey((k) => k + 1);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 w-64">
                      <SelectValue placeholder="Ajouter une ordonnance..." />
                    </SelectTrigger>
                    <SelectContent>
                      {prescriptions.length === 0 && (
                        <SelectItem value="__none" disabled>Aucune ordonnance active</SelectItem>
                      )}
                      {prescriptions.map((p) => {
                        const odStr = `OD: ${p.od_sph_vl ?? '-'}${p.od_cyl_vl ? ` (${p.od_cyl_vl})` : ''}`;
                        const ogStr = `OG: ${p.og_sph_vl ?? '-'}${p.og_cyl_vl ? ` (${p.og_cyl_vl})` : ''}`;
                        return (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.date_ordonnance} — {odStr} / {ogStr} — {p.verre_type || '-'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Prescription details */}
            {selectedPrescription ? (
              <div className="rounded-[6px] border border-sky-200 bg-sky-50/30 dark:border-sky-500/20 dark:bg-sky-950/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-sky-100 dark:border-sky-500/10">
                  <p className="font-semibold text-sky-800 dark:text-sky-300">
                    Ordonnance du {selectedPrescription.date_ordonnance} — {selectedPrescription.verre_type || 'Standard'}
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                    <div className="col-span-2 md:col-span-4 font-semibold text-slate-600 dark:text-slate-400 border-b pb-1 mb-1">Réfraction VL</div>
                    <div className="text-slate-500">OD Sph: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_sph_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OD Cyl: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_cyl_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OD Axe: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_axe_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OD Add: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_add_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OG Sph: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_sph_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OG Cyl: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_cyl_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OG Axe: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_axe_vl ?? '-'}</span></div>
                    <div className="text-slate-500">OG Add: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_add_vl ?? '-'}</span></div>
                    {selectedPrescription.od_sph_vp != null && (
                      <>
                        <div className="col-span-2 md:col-span-4 font-semibold text-slate-600 dark:text-slate-400 border-b pb-1 mb-1 mt-2">Réfraction VP</div>
                        <div className="text-slate-500">OD Sph: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_sph_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OD Cyl: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_cyl_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OD Axe: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_axe_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OD Add: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.od_add_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OG Sph: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_sph_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OG Cyl: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_cyl_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OG Axe: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_axe_vp ?? '-'}</span></div>
                        <div className="text-slate-500">OG Add: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.og_add_vp ?? '-'}</span></div>
                      </>
                    )}
                    {(selectedPrescription.dp_binoculaire || selectedPrescription.dp_od || selectedPrescription.dp_og) && (
                      <>
                        <div className="col-span-2 md:col-span-4 font-semibold text-slate-600 dark:text-slate-400 border-b pb-1 mb-1 mt-2">DP & Hauteurs</div>
                        <div className="text-slate-500">DP binoculaire: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.dp_binoculaire ?? '-'}</span></div>
                        <div className="text-slate-500">DP OD: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.dp_od ?? '-'}</span></div>
                        <div className="text-slate-500">DP OG: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.dp_og ?? '-'}</span></div>
                        <div className="text-slate-500">Haut. OD: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.hauteur_od ?? '-'}</span></div>
                        <div className="text-slate-500">Haut. OG: <span className="font-mono font-semibold text-slate-800 dark:text-white">{selectedPrescription.hauteur_og ?? '-'}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                Sélectionnez une ordonnance pour afficher les détails
              </div>
            )}
          </div>

          {/* Pricing for Verre */}
          {selectedPrescription && (
            <div className="rounded-[6px] border border-amber-200 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-950/10 p-4">
              <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-4">Produit &amp; Prix</h4>
              {verreProducts.length === 0 ? (
                <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                  Aucun produit de type verre trouvé. Veuillez d'abord{' '}
                  <a href="/produits" className="text-amber-600 underline hover:text-amber-700">ajouter un produit verre</a>.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold dark:text-slate-300">Produit verre</Label>
                    <Select
                      value={verreProductId}
                      onValueChange={handleVerreProductSelect}
                    >
                      <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10">
                        <SelectValue placeholder="Sélectionner un produit verre..." />
                      </SelectTrigger>
                      <SelectContent>
                        {verreProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.designation || p.nom || 'Verre'} — {(p.reference || p.ref || '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-semibold dark:text-slate-300">Prix unitaire HT</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={verrePrixHt}
                        onChange={(e) => setVerrePrixHt(Number(e.target.value) || 0)}
                        className="h-11 bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-semibold dark:text-slate-300">TVA (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={verreTva}
                        onChange={(e) => setVerreTva(Number(e.target.value) || 0)}
                        className="h-11 bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-semibold dark:text-slate-300">Prix TTC</Label>
                      <div className="h-11 flex items-center px-3 bg-white border border-slate-300 rounded-lg dark:bg-slate-950/50 dark:border-white/10 dark:text-white font-bold text-lg">
                        {formatCurrency(verrePrixHt * (1 + verreTva / 100))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('shared.form.lines_section')}</h3>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/10"
                onClick={() =>
                  append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('shared.form.add_line')}
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
                <tr>
                  <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('shared.table.product')}</th>
                  <th className="p-3 text-start font-semibold text-slate-600 dark:text-slate-400">{t('shared.form.description_label')}</th>
                  <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.qty_label')}</th>
                  <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.price_ht_label')}</th>
                  <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">{t('shared.form.vat_pct_label')}</th>
                  <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">{t('shared.form.subtotal_ht')}</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {fields.map((field, index) => {
                  const ligne = watchLignes[index];
                  const totalHt = (ligne?.quantite || 0) * (ligne?.prixUnitaireHt || 0);

                  return (
                    <tr key={field.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-white/[0.03]">
                      <td className="p-2">
                        <Select
                          value={form.watch(`lignes.${index}.produitId`) || ''}
                          onValueChange={(val) => handleProduitSelect(index, val)}
                        >
                          <SelectTrigger className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10">
                            <SelectValue placeholder={t('shared.form.choose_product')} />
                          </SelectTrigger>
                          <SelectContent>
                            {produits.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.designation || p.nom || '-'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                          {...form.register(`lignes.${index}.designation`)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                          {...form.register(`lignes.${index}.quantite`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                          {...form.register(`lignes.${index}.prixUnitaireHt`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-9 text-right bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
                          {...form.register(`lignes.${index}.tva`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-700 align-middle dark:text-white">
                        {formatCurrency(totalHt)}
                      </td>
                      <td className="p-2 text-center align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-rose-500/70 dark:hover:text-rose-500 dark:hover:bg-white/5"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">{t('shared.form.notes')}</Label>
            <Textarea
              {...form.register('notes')}
              placeholder={t('bons_commande.form_notes_ph')}
              className="min-h-[100px] bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
            />
          </div>
        </div>

        <div className="w-full md:w-80">
          <div className="bg-slate-50 p-6 rounded-[6px] border border-slate-200 space-y-4 dark:bg-slate-900/60 dark:border-white/10">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.subtotal_ht')}</span>
              <span className="font-bold text-slate-800 dark:text-white" dir="ltr">{formatCurrency(totals.ht)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">{t('shared.form.total_vat')}</span>
              <span className="font-bold text-slate-800 dark:text-white" dir="ltr">{formatCurrency(totals.tva)}</span>
            </div>
            <div className="h-px bg-slate-200 my-2 dark:bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold text-lg dark:text-white">{t('shared.form.total_ttc')}</span>
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400" dir="ltr">{formatCurrency(totals.ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/5">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          {t('shared.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none dark:rounded-sm">
          {isLoading ? t('shared.actions.saving') : t('shared.actions.save')}
        </Button>
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react'
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

const ligneSchema = z.object({
  produitId: z.string().optional(),
  reference: z.string().optional(),
  designation: z.string().min(1, 'La désignation est requise'),
  quantite: z.number().min(0.01, 'La quantité doit être supérieure à 0'),
  prixUnitaireHt: z.number().min(0, 'Le prix doit être positif').optional(),
  tva: z.number().min(0, 'La TVA doit être positive').optional(),
});

const blSchema = z.object({
  fournisseurId: z.string().optional(),
  dateEmission: z.string().min(1, 'La date d\'émission est requise'),
  statut: z.string().optional(),
  modePaiement: z.string().optional(),
  notes: z.string().optional(),
  lignes: z.array(ligneSchema).min(1, 'Au moins une ligne est requise'),
});

type BLFormValues = z.infer<typeof blSchema>;

interface BLFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function BonLivraisonForm({ initialData, onSuccess }: BLFormProps) {
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [parametres, setParametres] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<BLFormValues>({
    resolver: zodResolver(blSchema),
    defaultValues: {
      fournisseurId: '',
      dateEmission: new Date().toISOString().split('T')[0],
      statut: 'en_attente',
      modePaiement: 'Virement',
      notes: '',
      lignes: [
        {
          designation: '',
          quantite: 1,
          prixUnitaireHt: 0,
          tva: 20,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lignes',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      try {
        const [{ data: fournisseursData }, { data: produitsData }, { data: parametresData }] = await Promise.all([
          supabase.from('fournisseurs').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('produits').select('*').eq('user_id', user.id).order('designation'),
          supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)
        ]);
        
        setFournisseurs(fournisseursData || []);
        setProduits(produitsData || []);
        setParametres(parametresData?.[0] || null);

        if (initialData?.id) {
          form.reset({
            ...initialData,
            fournisseurId: initialData.fournisseurId?.toString() || '',
            dateEmission: initialData.dateCommande || initialData.dateLivraisonPrevue || new Date().toISOString().split('T')[0],
            lignes: initialData.lignes?.map((l: any) => ({
              ...l,
              produitId: l.produitId?.toString() || '',
              prixUnitaireHt: Number(l.prixUnitaireHt || 0),
              quantite: Number(l.quantite || 0),
              tva: Number(l.tva || 20),
              montantHt: Number(l.montantHt || 0),
              montantTtc: Number(l.montantTtc || 0)
            })) || []
          });
        } else {
          form.reset({
            fournisseurId: '',
            dateEmission: new Date().toISOString().split('T')[0],
            statut: 'en_attente',
            modePaiement: 'Virement',
            notes: parametresData?.[0]?.pied_page_defaut || '',
            lignes: [
              {
                designation: '',
                quantite: 1,
                prixUnitaireHt: 0,
                tva: 20,
              },
            ],
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erreur lors du chargement des données');
      }
    };
    fetchData();
  }, [initialData?.id]);

  const watchLignes = form.watch('lignes');

  const totals = watchLignes.reduce(
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

  const onSubmit = async (data: BLFormValues) => {
    setIsLoading(true);
    try {
      let bonId = initialData?.id;
      let numero;

      if (!bonId) {
        const year = new Date().getFullYear();
        const { count } = await supabase.from('bons_livraison').select('*', { count: 'exact', head: true });
        const randomNum = String((count || 0) + 1).padStart(4, '0');
        numero = `BL-${year}-${randomNum}`;
      }

      const fournisseurId = data.fournisseurId && data.fournisseurId !== 'none' && data.fournisseurId !== '' 
        ? parseInt(data.fournisseurId) 
        : null;

      const payload: any = {
        date_livraison: new Date(data.dateEmission).toISOString(),
        statut: data.statut || 'en_attente',
        montant_ht: Number(totals.ht),
        montant_tva: Number(totals.tva),
        montant_ttc: Number(totals.ttc),
        notes: data.notes || '',
        numero: numero || initialData?.numero,
      };

      if (fournisseurId) {
        payload.fournisseur_id = fournisseurId;
      }

      if (!bonId) {
        const { data: newBon, error } = await supabase.from('bons_livraison').insert([{ ...payload, user_id: user?.id }]).select().single();
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        bonId = newBon.id;
      } else {
        const { error } = await supabase.from('bons_livraison').update(payload).eq('id', bonId);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        await supabase.from('bon_livraison_lignes').delete().eq('bon_livraison_id', bonId);
      }

      const lignesPayload = data.lignes.map((ligne, index) => {
        const mht = Number(ligne.quantite || 0) * Number(ligne.prixUnitaireHt || 0);
        const mtva = mht * (Number(ligne.tva || 0) / 100);
        const mttc = mht + mtva;
        const produitId = ligne.produitId && ligne.produitId !== 'none' && ligne.produitId !== '' 
          ? parseInt(ligne.produitId) 
          : null;
        return {
          bon_livraison_id: bonId,
          produit_id: produitId,
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
        const { error: lignesError } = await supabase.from('bon_livraison_lignes').insert(lignesPayload);
        if (lignesError) {
          console.error('Lignes insert error:', lignesError);
          throw lignesError;
        }

        // Update stock if status is livré/livrée
        const activeStatuses = ['livré', 'livrée'];
        if (activeStatuses.includes(data.statut)) {
          const changedIds: (number | string)[] = [];
          for (const ligne of lignesPayload) {
            if (ligne.produit_id) {
              await updateStockAndNotify(user?.id, ligne.produit_id, Number(ligne.quantite));
              changedIds.push(ligne.produit_id);
            }
          }
          await ensureLowStockNotifications(user?.id, changedIds);
        }
      }

      toast.success(initialData ? 'Bon de livraison modifié' : 'Bon de livraison créé');
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error?.message || error?.details || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProduitSelect = (index: number, produitId: string) => {
    const produit = produits.find((p) => p.id.toString() === produitId);
    if (produit) {
      form.setValue(`lignes.${index}.produitId`, produit.id.toString());
      form.setValue(`lignes.${index}.reference`, produit.reference || '');
      form.setValue(`lignes.${index}.designation`, produit.designation || produit.nom || '');
      form.setValue(`lignes.${index}.quantite`, 1);
      form.setValue(`lignes.${index}.prixUnitaireHt`, Number(produit.prix_achat_ht || produit.prixAchatHt || 0));
      form.setValue(`lignes.${index}.tva`, Number(produit.taux_tva || produit.tva || 20));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">Fournisseur *</Label>
            <Select
              value={form.watch('fournisseurId') || ""}
              onValueChange={(val) => form.setValue('fournisseurId', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                <SelectValue placeholder="Sélectionner un fournisseur" />
              </SelectTrigger>
              <SelectContent>
                {fournisseurs.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.nomSociete || f.nom || '-'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.fournisseurId && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.fournisseurId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">Date d'émission *</Label>
            <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...form.register('dateEmission')} />
            {form.formState.errors.dateEmission && (
              <p className="text-xs text-red-500 font-medium">{form.formState.errors.dateEmission.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">Statut *</Label>
            <Select
              value={form.watch('statut') || ""}
              onValueChange={(val) => form.setValue('statut', val)}
            >
              <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="livré">Livré</SelectItem>
                <SelectItem value="annulé">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Lignes de livraison</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10"
            onClick={() =>
              append({ designation: '', quantite: 1, prixUnitaireHt: 0, tva: 20 })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="border border-slate-200 rounded-[6px] overflow-hidden dark:border-white/10 dark:rounded-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Produit</th>
                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-400">Désignation *</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">Qté *</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">Prix HT</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-24">TVA %</th>
                <th className="p-3 text-right font-semibold text-slate-600 dark:text-slate-400 w-32">Total HT</th>
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
                        value={form.watch(`lignes.${index}.produitId`) || ""}
                        onValueChange={(val) => handleProduitSelect(index, val)}
                      >
                        <SelectTrigger className="h-9 bg-white border-slate-200 dark:bg-slate-950/50 dark:border-white/10 [&_.lucide-chevron-down]:dark:text-slate-500">
                          <SelectValue placeholder="Choisir..." />
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

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold dark:text-slate-300">Notes</Label>
            <Textarea 
              {...form.register('notes')} 
              placeholder="Notes pour le client ou le transporteur..." 
              className="min-h-[100px] bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white"
            />
          </div>
        </div>

        <div className="w-full md:w-80">
          <div className="bg-slate-50 p-6 rounded-[6px] border border-slate-200 space-y-4 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">Total HT</span>
              <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(totals.ht)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium dark:text-slate-400">Total TVA</span>
              <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(totals.tva)}</span>
            </div>
            <div className="h-px bg-slate-200 my-2 dark:bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold text-lg dark:text-white">Total TTC</span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(totals.ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/5">
        <Button type="button" variant="ghost" onClick={() => onSuccess()} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none dark:rounded-sm">
          {isLoading ? 'Enregistrement...' : 'Enregistrer le bon de livraison'}
        </Button>
      </div>
    </form>
  );
}

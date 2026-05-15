import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
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

const depenseSchema = z.object({
  reference: z.string().optional(),
  categorie: z.string().min(1, 'La catégorie est requise'),
  description: z.string().min(1, 'La description est requise'),
  montantHt: z.coerce.number().min(0, 'Le montant doit être positif'),
  tva: z.coerce.number().min(0).max(100),
  dateDepense: z.string().min(1, 'La date est requise'),
  modePaiement: z.string().min(1, 'Le mode de paiement est requis'),
  fournisseurId: z.string().optional(),
  notes: z.string().optional(),
});

type DepenseFormValues = z.infer<typeof depenseSchema>;

interface DepenseFormProps {
  initialData?: any;
  onSuccess: () => void;
}

export function DepenseForm({ initialData, onSuccess }: DepenseFormProps) {
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [parametres, setParametres] = useState<any>(null);

  const form = useForm<DepenseFormValues>({
    resolver: zodResolver(depenseSchema) as any,
    defaultValues: {
      reference: '',
      categorie: 'fournitures',
      description: '',
      montantHt: 0,
      tva: 20,
      dateDepense: new Date().toISOString().split('T')[0],
      modePaiement: 'Virement',
      fournisseurId: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      try {
        const [{ data: fournisseursData }, { data: parametresData }] = await Promise.all([
          supabase.from('fournisseurs').select('*').eq('user_id', user.id).order('nom'),
          supabase.from('parametres').select('*').eq('user_id', user.id).limit(1)
        ]);
        
        setFournisseurs(fournisseursData || []);
        setParametres(parametresData?.[0] || null);
        
        if (initialData?.id) {
          form.reset({
            ...initialData,
            reference: initialData.reference || initialData.ref || '',
            fournisseurId: initialData.fournisseurId?.toString() || 'none',
            dateDepense: initialData.dateDepense || new Date().toISOString().split('T')[0],
            montantHt: Number(initialData.montantHt || 0),
            tva: Number(initialData.tva || 20),
          });
        } else {
          form.reset({
            reference: '',
            categorie: 'fournitures',
            description: '',
            montantHt: 0,
            tva: 20,
            dateDepense: new Date().toISOString().split('T')[0],
            modePaiement: 'Virement',
            fournisseurId: '',
            notes: parametresData?.[0]?.pied_page_defaut || '',
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setFournisseurs([]);
      }
    };
    fetchData();
  }, [initialData?.id]);

  const onSubmit = async (data: DepenseFormValues) => {
    try {
      const montantHt = Number(data.montantHt);
      const tva = Number(data.tva);
      const montantTva = montantHt * (tva / 100);
      const montantTtc = montantHt + montantTva;

      let reference = data.reference?.trim();
      if (!reference && !initialData?.id) {
        const year = new Date().getFullYear();
        const { count } = await supabase.from('depenses').select('*', { count: 'exact', head: true });
        const num = String((count || 0) + 1).padStart(4, '0');
        reference = `DEP-${year}-${num}`;
      }

      const payload: any = {
        reference: reference,
        categorie: data.categorie,
        description: data.description,
        montant_ht: Number(montantHt),
        montant_tva: Number(montantTva),
        montant_ttc: Number(montantTtc),
        tva: Number(tva),
        date_depense: new Date(data.dateDepense).toISOString(),
        mode_paiement: data.modePaiement,
        notes: data.notes || '',
      };

      if (data.fournisseurId && data.fournisseurId !== 'none') {
        payload.fournisseur_id = Number(data.fournisseurId);
      }

      if (initialData?.id) {
        const { error } = await supabase.from('depenses').update(payload).eq('id', initialData.id);
        if (error) throw error;
        toast.success('Dépense modifiée');
      } else {
        const { error } = await supabase.from('depenses').insert([{ ...payload, user_id: user?.id }]);
        if (error) throw error;
        toast.success('Dépense ajoutée');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 dark:bg-slate-900/60 dark:border-white/10 dark:rounded-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="categorie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Catégorie *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fournitures">Fournitures</SelectItem>
                      <SelectItem value="loyer">Loyer</SelectItem>
                      <SelectItem value="salaires">Salaires</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateDepense"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Date de la dépense *</FormLabel>
                  <FormControl>
                    <Input type="date" className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white dark:[color-scheme:dark]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Référence</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-généré si vide" className="bg-white border-slate-300 font-mono dark:bg-slate-950/50 dark:border-white/10 dark:text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Description *</FormLabel>
                <FormControl>
                  <Input placeholder="Achat de matériel, loyer bureau..." className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="montantHt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Montant HT (DH) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="bg-white border-slate-300 font-mono dark:bg-slate-950/50 dark:border-white/10 dark:text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">TVA (%) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="bg-white border-slate-300 font-mono dark:bg-slate-950/50 dark:border-white/10 dark:text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col justify-end pb-2">
                <div className="bg-slate-100 p-2 rounded border border-slate-200 text-right dark:bg-slate-900/60 dark:border-white/10">
                  <span className="text-xs text-slate-500 block uppercase font-bold dark:text-slate-400">Total TTC estimé</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white">
                    {formatCurrency(Number(form.watch('montantHt') || 0) * (1 + Number(form.watch('tva') || 0) / 100))}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="modePaiement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Mode de paiement *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                          <SelectValue placeholder="Sélectionner un mode" />
                        </SelectTrigger>
                      </FormControl>
                        <SelectContent>
                        <SelectItem value="Espèces">Espèces</SelectItem>
                        <SelectItem value="Chèque">Chèque</SelectItem>
                        <SelectItem value="Virement">Virement</SelectItem>
                        <SelectItem value="Carte">Carte bancaire</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fournisseurId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Fournisseur (Optionnel)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-950/50 dark:border-white/10 dark:text-white [&_.lucide-chevron-down]:dark:text-slate-500">
                          <SelectValue placeholder="Sélectionner un fournisseur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {fournisseurs.map((f) => (
                          <SelectItem key={f.id} value={f.id?.toString() || ''}>
                            {f.nomSociete || f.nom || `Fournisseur ${f.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
                <FormLabel className="text-slate-700 font-semibold dark:text-slate-300">Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Informations complémentaires, n° de facture fournisseur..." 
                  className="bg-white border-slate-300 min-h-[80px] dark:bg-slate-950/50 dark:border-white/10 dark:text-white" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

          <div className="flex justify-end items-center space-x-4 pt-6 border-t dark:border-white/5">
          <Button type="button" variant="ghost" onClick={onSuccess} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Annuler
          </Button>
          <Button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none dark:rounded-sm">
            {initialData ? 'Mettre à jour la dépense' : 'Enregistrer la dépense'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { ImageUpload } from '@/components/ui/ImageUpload'

interface ProduitFormProps {
  initialData?: any;
  onSuccess?: () => void;
}

export function ProduitForm({ initialData, onSuccess }: ProduitFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const produitSchema = z.object({
    reference: z.string().optional(),
    nom: z.string().min(2, { message: t('shared.validation.product_name_required') }),
    description: z.string().optional(),
    marque: z.string().optional(),
    barcode: z.string().optional(),
    prixVenteHt: z.coerce.number().min(0),
    prixAchatHt: z.coerce.number().min(0),
    tauxTva: z.coerce.number().min(0).max(100),
    stockActuel: z.coerce.number().int(),
    stockMin: z.coerce.number().int().optional(),
    unite: z.string().optional(),
    imageUrl: z.string().optional(),
    typeProduit: z.enum(['monture', 'verre', 'lentille', 'solution', 'accessoire']).optional(),
    montureTaille: z.string().optional(),
    montureCouleur: z.string().optional(),
    montureMatiere: z.string().optional(),
    montureForme: z.string().optional(),
    montureGenre: z.enum(['homme', 'femme', 'enfant', 'mixte']).optional(),
    montureLargeurNb: z.coerce.number().optional(),
    montureHauteurNb: z.coerce.number().optional(),
    monturePonteNb: z.coerce.number().optional(),
    verreType: z.enum(['unifocal', 'bifocal', 'progressif', 'travail']).optional(),
    verreIndice: z.coerce.number().optional(),
    verreTraitement: z.string().optional(),
    verreCouleur: z.string().optional(),
    lentilleType: z.enum(['journaliere', 'bimensuelle', 'mensuelle', 'trimestrielle', 'annuelle']).optional(),
    lentilleCourbeBase: z.coerce.number().optional(),
    lentilleDiametre: z.coerce.number().optional(),
    solutionVolumeMl: z.coerce.number().int().optional(),
    solutionType: z.enum(['multifonction', 'peroxyde', 'saline', 'nettoyant']).optional(),
    fournisseurRef: z.string().optional(),
    emplacement: z.string().optional(),
    datePeremption: z.string().optional(),
    lot: z.string().optional(),
    garantieMois: z.coerce.number().int().optional(),
  });

  type ProduitFormValues = z.infer<typeof produitSchema>;

  const form = useForm<ProduitFormValues>({
    resolver: zodResolver(produitSchema) as any,
    defaultValues: {
      reference: initialData?.reference || '',
      nom: initialData?.nom || '',
      marque: initialData?.marque || '',
      barcode: initialData?.barcode || '',
      description: initialData?.description || '',
      prixVenteHt: initialData?.prixVenteHt || 0,
      prixAchatHt: initialData?.prixAchatHt || 0,
      tauxTva: initialData?.tauxTva || initialData?.tva || 20,
      stockActuel: initialData?.stockActuel || 0,
      stockMin: initialData?.stockMin || 5,
      unite: initialData?.unite || 'unité',
      imageUrl: initialData?.imageUrl || initialData?.image_url || '',
      typeProduit: initialData?.typeProduit || initialData?.type_produit || 'monture',
      montureTaille: initialData?.montureTaille || initialData?.monture_taille || '',
      montureCouleur: initialData?.montureCouleur || initialData?.monture_couleur || '',
      montureMatiere: initialData?.montureMatiere || initialData?.monture_matiere || '',
      montureForme: initialData?.montureForme || initialData?.monture_forme || '',
      montureGenre: initialData?.montureGenre || initialData?.monture_genre || undefined,
      montureLargeurNb: initialData?.montureLargeurNb ?? initialData?.monture_largeur_nb ?? undefined,
      montureHauteurNb: initialData?.montureHauteurNb ?? initialData?.monture_hauteur_nb ?? undefined,
      monturePonteNb: initialData?.monturePonteNb ?? initialData?.monture_ponte_nb ?? undefined,
      verreType: initialData?.verreType || initialData?.verre_type || undefined,
      verreIndice: initialData?.verreIndice ?? initialData?.verre_indice ?? undefined,
      verreTraitement: initialData?.verreTraitement || initialData?.verre_traitement || '',
      verreCouleur: initialData?.verreCouleur || initialData?.verre_couleur || '',
      lentilleType: initialData?.lentilleType || initialData?.lentille_type || undefined,
      lentilleCourbeBase: initialData?.lentilleCourbeBase ?? initialData?.lentille_courbe_base ?? undefined,
      lentilleDiametre: initialData?.lentilleDiametre ?? initialData?.lentille_diametre ?? undefined,
      solutionVolumeMl: initialData?.solutionVolumeMl ?? initialData?.solution_volume_ml ?? undefined,
      solutionType: initialData?.solutionType || initialData?.solution_type || undefined,
      fournisseurRef: initialData?.fournisseurRef || initialData?.fournisseur_ref || '',
      emplacement: initialData?.emplacement || '',
      datePeremption: initialData?.datePeremption || initialData?.date_peremption || '',
      lot: initialData?.lot || '',
      garantieMois: initialData?.garantieMois ?? initialData?.garantie_mois ?? 24,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  async function onSubmit(data: ProduitFormValues) {
    try {
      const prixVenteHT = Number(data.prixVenteHt) || 0;
      const prixAchatHT = Number(data.prixAchatHt) || 0;
      const tauxTVA = Number(data.tauxTva) || 20;
      const prixVenteTTC = prixVenteHT * (1 + tauxTVA / 100);
      const prixAchatTTC = prixAchatHT * (1 + tauxTVA / 100);
      const stockActuel = Number(data.stockActuel) || 0;
      const stockMin = Number(data.stockMin) || 5;

       const payload = {
         reference: data.reference?.trim() || null,
         nom: data.nom?.trim() || null,
         designation: data.nom?.trim() || null,
         marque: data.marque?.trim() || null,
         barcode: data.barcode?.trim() || null,
         description: data.description?.trim() || null,
         prix_vente_ht: prixVenteHT,
         prix_vente_ttc: prixVenteTTC,
         prix_achat_ht: prixAchatHT,
         prix_achat_ttc: prixAchatTTC,
         taux_tva: tauxTVA,
         stock_actuel: stockActuel,
         stock_min: stockMin,
         unite: data.unite?.trim() || 'unité',
         image_url: data.imageUrl || null,
         type_produit: data.typeProduit || 'monture',
         monture_taille: data.montureTaille?.trim() || null,
         monture_couleur: data.montureCouleur?.trim() || null,
         monture_matiere: data.montureMatiere?.trim() || null,
         monture_forme: data.montureForme?.trim() || null,
         monture_genre: data.montureGenre || null,
         monture_largeur_nb: data.montureLargeurNb || null,
         monture_hauteur_nb: data.montureHauteurNb || null,
         monture_ponte_nb: data.monturePonteNb || null,
         verre_type: data.verreType || null,
         verre_indice: data.verreIndice || null,
         verre_traitement: data.verreTraitement?.trim() || null,
         verre_couleur: data.verreCouleur?.trim() || null,
         lentille_type: data.lentilleType || null,
         lentille_courbe_base: data.lentilleCourbeBase || null,
         lentille_diametre: data.lentilleDiametre || null,
         solution_volume_ml: data.solutionVolumeMl || null,
         solution_type: data.solutionType || null,
         fournisseur_ref: data.fournisseurRef?.trim() || null,
         emplacement: data.emplacement?.trim() || null,
         date_peremption: data.datePeremption || null,
         lot: data.lot?.trim() || null,
         garantie_mois: data.garantieMois || 24,
       };

      let result;
      if (initialData?.id) {
        result = await supabase.from('produits').update(payload).eq('id', initialData.id).select();
      } else {
        result = await supabase.from('produits').insert([{ ...payload, user_id: user?.id }]).select();
      }

      if (result.error) {
        console.error('Supabase error:', result.error);
        throw new Error(result.error.message);
      }

      toast.success('Produit enregistré avec succès');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || t('shared.toast.save_error'));
      console.error(error);
    }
  }

   return (
     <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-1 space-y-4">
             <FormField
               control={form.control}
               name="imageUrl"
               render={({ field }) => (
                 <FormItem>
                   <FormControl>
                     <ImageUpload
                       value={field.value || undefined}
                       onChange={field.onChange}
                       label={t('shared.form.image_label')}
                     />
                   </FormControl>
                   <FormMessage />
                 </FormItem>
               )}
             />
           </div>
           <div className="md:col-span-2 space-y-4">
         <div className="grid grid-cols-2 gap-4">
           <FormField
             control={form.control}
             name="reference"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>{t('shared.form.ref')}</FormLabel>
                 <FormControl>
                    <Input placeholder={t('shared.form.product_ref_ph')} {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />

           <FormField
             control={form.control}
             name="barcode"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>{t('shared.form.barcode')}</FormLabel>
                 <FormControl>
                   <Input placeholder="6111234567890" {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />
         </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.product_name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('shared.form.product_name_ph')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="marque"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.brand')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('shared.form.brand_ph')} {...field} />
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
              <FormLabel>{t('shared.form.description_label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('shared.form.description_ph')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="prixAchatHt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.buy_price_ht')}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prixVenteHt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.sale_price_ht')}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tauxTva"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.vat_pct')}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="stockActuel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.stock_current')}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stockMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.stock_min')}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

         <FormField
             control={form.control}
             name="unite"
             render={({ field }) => (
               <FormItem>
                 <FormLabel>{t('shared.form.unit')}</FormLabel>
                 <FormControl>
                   <Input placeholder={t('shared.form.unit_ph')} {...field} />
                 </FormControl>
                 <FormMessage />
               </FormItem>
             )}
           />
          </div>

          {/* Type de produit optique */}
          <FormField
            control={form.control}
            name="typeProduit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('produits.form.type_produit')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-10 rounded-[4px] border-border/50 dark:bg-[#0F172A] dark:border-white/10">
                      <SelectValue placeholder={t('produits.form.type_produit_ph')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                    <SelectItem value="monture">{t('produits.form.type_monture')}</SelectItem>
                    <SelectItem value="verre">{t('produits.form.type_verre')}</SelectItem>
                    <SelectItem value="lentille">{t('produits.form.type_lentille')}</SelectItem>
                    <SelectItem value="solution">{t('produits.form.type_solution')}</SelectItem>
                    <SelectItem value="accessoire">{t('produits.form.type_accessoire')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Champs spécifiques Monture */}
          {form.watch('typeProduit') === 'monture' && (
            <div className="space-y-4 p-4 rounded-[6px] border border-amber-200/50 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/5">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t('produits.form.section_monture')}</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="montureTaille" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_taille')}</FormLabel>
                    <FormControl><Input placeholder="52-18-140" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="montureCouleur" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_couleur')}</FormLabel>
                    <FormControl><Input placeholder={t('produits.form.ph_color')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="montureMatiere" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_matiere')}</FormLabel>
                    <FormControl><Input placeholder={t('produits.form.ph_matiere')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="montureForme" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_forme')}</FormLabel>
                    <FormControl><Input placeholder={t('produits.form.ph_forme')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="montureGenre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('produits.form.monture_genre')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-[4px] dark:bg-[#0F172A] dark:border-white/10">
                          <SelectValue placeholder={t('shared.form.select_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                        <SelectItem value="homme">{t('produits.form.genre_homme')}</SelectItem>
                        <SelectItem value="femme">{t('produits.form.genre_femme')}</SelectItem>
                        <SelectItem value="enfant">{t('produits.form.genre_enfant')}</SelectItem>
                        <SelectItem value="mixte">{t('produits.form.genre_mixte')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="montureLargeurNb" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_largeur')}</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="mm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="montureHauteurNb" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_hauteur')}</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="mm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="monturePonteNb" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.monture_ponte')}</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="mm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
          )}

          {/* Champs spécifiques Verre */}
          {form.watch('typeProduit') === 'verre' && (
            <div className="space-y-4 p-4 rounded-[6px] border border-blue-200/50 bg-blue-50/30 dark:border-blue-500/20 dark:bg-blue-500/5">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{t('produits.form.section_verre')}</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="verreType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('produits.form.verre_type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-[4px] dark:bg-[#0F172A] dark:border-white/10">
                          <SelectValue placeholder={t('shared.form.select_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                        <SelectItem value="unifocal">{t('produits.form.verre_unifocal')}</SelectItem>
                        <SelectItem value="bifocal">{t('produits.form.verre_bifocal')}</SelectItem>
                        <SelectItem value="progressif">{t('produits.form.verre_progressif')}</SelectItem>
                        <SelectItem value="travail">{t('produits.form.verre_travail')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="verreTraitement" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.verre_traitement')}</FormLabel>
                    <FormControl><Input placeholder={t('produits.form.ph_traitement')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="verreIndice" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.verre_indice')}</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="1.50" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="verreCouleur" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.verre_couleur')}</FormLabel>
                    <FormControl><Input placeholder={t('produits.form.ph_color')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
          )}

          {/* Champs spécifiques Lentille */}
          {form.watch('typeProduit') === 'lentille' && (
            <div className="space-y-4 p-4 rounded-[6px] border border-purple-200/50 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">{t('produits.form.section_lentille')}</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="lentilleType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('produits.form.lentille_type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-[4px] dark:bg-[#0F172A] dark:border-white/10">
                          <SelectValue placeholder={t('shared.form.select_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                        <SelectItem value="journaliere">{t('produits.form.lentille_journaliere')}</SelectItem>
                        <SelectItem value="bimensuelle">{t('produits.form.lentille_bimensuelle')}</SelectItem>
                        <SelectItem value="mensuelle">{t('produits.form.lentille_mensuelle')}</SelectItem>
                        <SelectItem value="trimestrielle">{t('produits.form.lentille_trimestrielle')}</SelectItem>
                        <SelectItem value="annuelle">{t('produits.form.lentille_annuelle')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lentilleCourbeBase" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.lentille_courbe_base')}</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="8.4" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lentilleDiametre" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.lentille_diametre')}</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="14.2" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
          )}

          {/* Champs spécifiques Solution */}
          {form.watch('typeProduit') === 'solution' && (
            <div className="space-y-4 p-4 rounded-[6px] border border-cyan-200/50 bg-cyan-50/30 dark:border-cyan-500/20 dark:bg-cyan-500/5">
              <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{t('produits.form.section_solution')}</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="solutionType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('produits.form.solution_type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-[4px] dark:bg-[#0F172A] dark:border-white/10">
                          <SelectValue placeholder={t('shared.form.select_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                        <SelectItem value="multifonction">{t('produits.form.solution_multifonction')}</SelectItem>
                        <SelectItem value="peroxyde">{t('produits.form.solution_peroxyde')}</SelectItem>
                        <SelectItem value="saline">{t('produits.form.solution_saline')}</SelectItem>
                        <SelectItem value="nettoyant">{t('produits.form.solution_nettoyant')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="solutionVolumeMl" render={({ field }) => (
                  <FormItem><FormLabel>{t('produits.form.solution_volume')}</FormLabel>
                    <FormControl><Input type="number" placeholder="ml" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
          )}

          {/* Champs communs traçabilité */}
          <div className="space-y-4 p-4 rounded-[6px] border border-slate-200/50 bg-slate-50/30 dark:border-slate-500/20 dark:bg-slate-500/5">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">{t('produits.form.section_tracabilite')}</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fournisseurRef" render={({ field }) => (
                <FormItem><FormLabel>{t('produits.form.fournisseur_ref')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="emplacement" render={({ field }) => (
                <FormItem><FormLabel>{t('produits.form.emplacement')}</FormLabel>
                  <FormControl><Input placeholder="Rack A, Étagère 3" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lot" render={({ field }) => (
                <FormItem><FormLabel>{t('produits.form.lot')}</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="datePeremption" render={({ field }) => (
                <FormItem><FormLabel>{t('produits.form.date_peremption')}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="garantieMois" render={({ field }) => (
                <FormItem><FormLabel>{t('produits.form.garantie_mois')}</FormLabel>
                  <FormControl><Input type="number" placeholder="24" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </div>
            </div>
          </div>

         <div className="flex justify-end pt-6 border-t mt-6">
           <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none">
             {t('shared.actions.save')}
           </Button>
         </div>
       </form>
     </Form>
   );
 }

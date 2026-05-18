import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ProductSelector } from '@/components/ui/ProductSelector'

interface OrdreTravailFormProps {
  initialData?: any
  onSuccess?: () => void
}

const STATUTS = ['brouillon', 'envoye_labo', 'reçu_labo', 'montage', 'controle', 'termine', 'annule'] as const

export function OrdreTravailForm({ initialData, onSuccess }: OrdreTravailFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()


  const ordreSchema = z.object({
    clientId: z.coerce.number({ required_error: t('shared.validation.client_required') }),
    prescriptionId: z.coerce.number().optional(),
    dateSouhaitee: z.string().optional(),
    montureId: z.number().optional(),
    verreId: z.number().optional(),
    verreType: z.string().optional(),
    verreIndice: z.coerce.number().optional(),
    verreTraitement: z.string().optional(),
    verreCouleur: z.string().optional(),
    verreDesignation: z.string().optional(),
    laboNom: z.string().optional(),
    laboContact: z.string().optional(),
    laboPrix: z.coerce.number().optional(),
    instructionsLabo: z.string().optional(),
    typeDetourage: z.string().optional(),
    centrageNotes: z.string().optional(),
    biseauType: z.string().optional(),
    prixVenteHt: z.coerce.number().optional(),
    tauxTva: z.coerce.number().optional(),
    statut: z.enum(STATUTS).optional(),
  })

  type FormValues = z.infer<typeof ordreSchema>

  const form = useForm<FormValues>({
    resolver: zodResolver(ordreSchema) as any,
    defaultValues: {
      clientId: initialData?.clientId || initialData?.client_id || undefined,
      prescriptionId: initialData?.prescriptionId || initialData?.prescription_id || undefined,
      dateSouhaitee: initialData?.dateSouhaitee || initialData?.date_souhaitee || '',
      montureId: initialData?.montureId || initialData?.produit_monture_id || undefined,
      verreId: initialData?.verreId || initialData?.produit_verre_id || undefined,
      verreType: initialData?.verreType || initialData?.verre_type || '',
      verreIndice: initialData?.verreIndice ?? initialData?.verre_indice ?? undefined,
      verreTraitement: initialData?.verreTraitement || initialData?.verre_traitement || '',
      verreCouleur: initialData?.verreCouleur || initialData?.verre_couleur || '',
      verreDesignation: initialData?.verreDesignation || initialData?.verre_designation || '',
      laboNom: initialData?.laboNom || initialData?.labo_nom || '',
      laboContact: initialData?.laboContact || initialData?.labo_contact || '',
      laboPrix: initialData?.laboPrix ?? initialData?.labo_prix ?? 0,
      instructionsLabo: initialData?.instructionsLabo || initialData?.instructions_labo || '',
      typeDetourage: initialData?.typeDetourage || initialData?.type_detourage || '',
      centrageNotes: initialData?.centrageNotes || initialData?.centrage_notes || '',
      biseauType: initialData?.biseauType || initialData?.biseau_type || '',
      prixVenteHt: initialData?.prixVenteHt ?? initialData?.prix_vente_ht ?? 0,
      tauxTva: initialData?.tauxTva ?? initialData?.taux_tva ?? 20,
      statut: initialData?.statut || 'brouillon',
    },
  })

  useEffect(() => {
    const fetchClients = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('nom');
      setClients(data || []);
    };
    fetchClients();
  }, [user?.id]);

  useEffect(() => {
    if (initialData) {
      const mapped = {
        clientId: initialData.client_id,
        prescriptionId: initialData.prescription_id,
        dateSouhaitee: initialData.date_souhaitee || '',
        montureId: initialData.produit_monture_id,
        verreId: initialData.produit_verre_id,
        verreType: initialData.verre_type || '',
        verreIndice: initialData.verre_indice,
        verreTraitement: initialData.verre_traitement || '',
        verreCouleur: initialData.verre_couleur || '',
        verreDesignation: initialData.verre_designation || '',
        laboNom: initialData.labo_nom || '',
        laboContact: initialData.labo_contact || '',
        laboPrix: initialData.labo_prix || 0,
        instructionsLabo: initialData.instructions_labo || '',
        typeDetourage: initialData.type_detourage || '',
        centrageNotes: initialData.centrage_notes || '',
        biseauType: initialData.biseau_type || '',
        prixVenteHt: initialData.prix_vente_ht || 0,
        tauxTva: initialData.taux_tva || 20,
        statut: initialData.statut || 'brouillon',
      }
      form.reset(mapped)
    }
  }, [initialData, form])

  async function onSubmit(data: FormValues) {
    try {
      const payload = {
        user_id: user?.id,
        client_id: data.clientId,
        prescription_id: data.prescriptionId || null,
        date_souhaitee: data.dateSouhaitee || null,
        produit_monture_id: data.montureId || null,
        produit_verre_id: data.verreId || null,
        verre_type: data.verreType || null,
        verre_indice: data.verreIndice || null,
        verre_traitement: data.verreTraitement || null,
        verre_couleur: data.verreCouleur || null,
        verre_designation: data.verreDesignation || null,
        labo_nom: data.laboNom || null,
        labo_contact: data.laboContact || null,
        labo_prix: data.laboPrix || 0,
        instructions_labo: data.instructionsLabo || null,
        type_detourage: data.typeDetourage || null,
        centrage_notes: data.centrageNotes || null,
        biseau_type: data.biseauType || null,
        prix_vente_ht: data.prixVenteHt || 0,
        taux_tva: data.tauxTva || 20,
        statut: data.statut || 'brouillon',
      }

      if (initialData?.id) {
        const { error } = await supabase.from('ordres_travail').update(payload).eq('id', initialData.id)
        if (error) throw error
      } else {
        const { data: orderData, error } = await supabase
          .from('ordres_travail')
          .insert([{ ...payload, numero_ordre: `OT-${Date.now()}` }])
          .select()
        if (error) throw error
      }

      toast.success(t('ordres_travail.toast_saved'))
      if (onSuccess) onSuccess()
    } catch (error: any) {
      toast.error(error.message || t('shared.toast.save_error'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Client & Prescription */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('shared.form.client_label')}</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() || ''}>
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10">
                      <SelectValue placeholder={t('shared.form.select_client')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateSouhaitee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('ordres_travail.form.date_souhaitee')}</FormLabel>
                <FormControl>
                  <Input type="date" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Produits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-[6px] border border-amber-200/50 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 md:col-span-2">{t('ordres_travail.form.section_produits')}</p>
          <FormField control={form.control} name="montureId" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ordres_travail.form.monture')}</FormLabel>
              <FormControl>
                <ProductSelector
                  value={field.value}
                  onChange={field.onChange}
                  typeFilter="monture"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="verreDesignation" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ordres_travail.form.verre_designation')}</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Essilor Stellify 1.67" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Configuration verre */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-[6px] border border-blue-200/50 bg-blue-50/30 dark:border-blue-500/20 dark:bg-blue-500/5">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 md:col-span-4">{t('ordres_travail.form.section_config_verre')}</p>
          <FormField control={form.control} name="verreType" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('ordres_travail.form.verre_type')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10">
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
          <FormField control={form.control} name="verreIndice" render={({ field }) => (
            <FormItem><FormLabel>{t('produits.form.verre_indice')}</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="1.50" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="verreTraitement" render={({ field }) => (
            <FormItem><FormLabel>{t('produits.form.verre_traitement')}</FormLabel>
              <FormControl><Input placeholder={t('produits.form.ph_traitement')} className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="verreCouleur" render={({ field }) => (
            <FormItem><FormLabel>{t('produits.form.verre_couleur')}</FormLabel>
              <FormControl><Input placeholder={t('produits.form.ph_color')} className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        {/* Laboratoire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-[6px] border border-slate-200/50 bg-slate-50/30 dark:border-slate-500/20 dark:bg-slate-500/5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-400 md:col-span-2">{t('ordres_travail.form.section_labo')}</p>
          <FormField control={form.control} name="laboNom" render={({ field }) => (
            <FormItem><FormLabel>{t('ordres_travail.form.labo_nom')}</FormLabel>
              <FormControl><Input placeholder="Laboratoire Verrier" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="laboPrix" render={({ field }) => (
            <FormItem><FormLabel>{t('ordres_travail.form.labo_prix')}</FormLabel>
              <FormControl><Input type="number" step="0.01" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="instructionsLabo" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>{t('ordres_travail.form.instructions_labo')}</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Instructions de montage, centrage, etc." className="rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Prix & statut */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField control={form.control} name="prixVenteHt" render={({ field }) => (
            <FormItem><FormLabel>{t('shared.form.sale_price_ht')}</FormLabel>
              <FormControl><Input type="number" step="0.01" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="tauxTva" render={({ field }) => (
            <FormItem><FormLabel>{t('shared.form.vat_pct')}</FormLabel>
              <FormControl><Input type="number" step="0.1" className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="statut" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('shared.table.status')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl dark:bg-slate-950/50 dark:border-white/10">
                    <SelectValue placeholder={t('shared.form.select_status')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="dark:bg-slate-900 dark:border-white/10">
                  {STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>{t(`ordres_travail.statut_${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex justify-end pt-6 border-t border-border/50 dark:border-white/10">
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 h-10 rounded-[4px] shadow-none">
            {t('shared.actions.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

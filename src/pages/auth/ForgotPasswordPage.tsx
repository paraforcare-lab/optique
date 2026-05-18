import React, { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, ArrowRight, ArrowLeft, Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout, AuthHero } from './AuthLayout'

/**
 * Step 1 of the password-reset workflow.
 *
 * Collects the user's email and asks Supabase to send a recovery email
 * containing a magic link. The link's `redirectTo` points at the
 * /reset-password route on the current origin, so the flow works in dev,
 * preview and production without any environment configuration.
 *
 * For security, we never reveal whether an account actually exists for
 * the supplied email — the toast on success uses neutral wording
 * ("if an account exists, an email has been sent").
 */
export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  // Already signed in? Don't show the recovery flow.
  if (user) return <Navigate to="/" replace />

  const isRtl = i18n.language?.startsWith('ar')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        // Supabase rate-limits this endpoint; surface its real message so
        // the user understands what's happening (e.g. "try again later").
        toast.error(error.message || t('auth.forgot_toast_error'))
        return
      }
      toast.success(t('auth.forgot_toast_success'))
      navigate(`/check-email?email=${encodeURIComponent(email.trim())}`)
    } catch {
      toast.error(t('auth.forgot_toast_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHero
        icon={<KeyRound className="h-7 w-7 text-white" strokeWidth={2} />}
        title={t('auth.forgot_title')}
        subtitle={t('auth.forgot_subtitle')}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-slate-500">
            {t('auth.email_label')}
          </Label>
          <div className="relative">
            <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              placeholder={t('auth.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-11 ps-11 bg-slate-50 border-slate-200 rounded-[4px] focus:bg-white focus:border-emerald-500 focus:ring-0 shadow-none text-sm text-slate-900 placeholder:text-slate-400 caret-emerald-500 transition-colors"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[4px] shadow-[0_4px_14px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('auth.forgot_submitting')}
            </>
          ) : (
            <>
              {t('auth.forgot_submit')}
              <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
        >
          <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
          {t('auth.forgot_back_to_login')}
        </Link>
      </div>
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MailCheck, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { AuthLayout, AuthHero } from './AuthLayout'

/**
 * Step 2 of the password-reset workflow.
 *
 * Confirmation screen shown after the user submits their email on
 * /forgot-password. We pass the email through the URL query so this page
 * can:
 *   1. Display "we sent a link to <email>" with the user's email visible,
 *      reassuring them they typed it correctly.
 *   2. Resend the email without making the user re-type it.
 *
 * If a user lands here directly without an `email` query param (e.g. via
 * a stale bookmark), we send them back to /forgot-password so they can
 * start over.
 */
export function CheckEmailPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const email = params.get('email') || ''
  const [resending, setResending] = useState(false)

  if (user) return <Navigate to="/" replace />
  if (!email) return <Navigate to="/forgot-password" replace />

  const isRtl = i18n.language?.startsWith('ar')

  const handleResend = async () => {
    setResending(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error(error.message || t('auth.forgot_toast_error'))
        return
      }
      toast.success(t('auth.check_email_resent'))
    } catch {
      toast.error(t('auth.forgot_toast_error'))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHero
        icon={<MailCheck className="h-7 w-7 text-white" strokeWidth={2} />}
        title={t('auth.check_email_title')}
        subtitle={t('auth.check_email_subtitle', { email })}
      />

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 mb-6">
        <p className="text-xs text-slate-600 leading-relaxed text-center">
          {t('auth.check_email_hint')}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleResend}
        disabled={resending}
        className="w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-[4px] shadow-none text-sm transition-all"
      >
        {resending ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {t('auth.check_email_resending')}
          </>
        ) : (
          <>
            <RefreshCw className="me-2 h-4 w-4" />
            {t('auth.check_email_resend')}
          </>
        )}
      </Button>

      <p className="text-[11px] text-slate-400 text-center mt-4">
        {t('auth.check_email_no_email')}
      </p>

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

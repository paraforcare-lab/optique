import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout, AuthHero } from './AuthLayout'

/**
 * Step 3 of the password-reset workflow.
 *
 * Reached via the magic link in the recovery email. Supabase auto-parses
 * the URL hash (`#access_token=...&type=recovery`) when the supabase-js
 * client loads, then fires a `PASSWORD_RECOVERY` auth state-change event.
 * That event signals "this session is in recovery mode and is allowed to
 * call `auth.updateUser({ password })`" — we gate the form on it.
 *
 * Edge cases handled:
 *   - Stale / fake / expired link → no PASSWORD_RECOVERY event fires within
 *     the timeout window → we show an "invalid link" state with a link
 *     back to /forgot-password.
 *   - Already-signed-in user opens the link → still works; Supabase treats
 *     the recovery token as an additional auth state that allows password
 *     update.
 */
export function ResetPasswordPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  // `ready` is null while we wait for the PASSWORD_RECOVERY auth event,
  // true if we got it (form is allowed), false if we timed out / no event.
  const [ready, setReady] = useState<boolean | null>(null)

  const isRtl = i18n.language?.startsWith('ar')

  useEffect(() => {
    // Subscribe FIRST so we don't miss the event if it fires before we mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Fall back to "invalid link" after a short delay if nothing fires.
    // 1.5 s is plenty for supabase-js to parse the URL hash on cold load.
    const timer = window.setTimeout(() => {
      setReady(prev => (prev === null ? false : prev))
    }, 1500)

    // Also check the current session as a safety net: if Supabase already
    // restored a recovery session (e.g. fast remount), we can proceed.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.hash.includes('type=recovery')) {
        setReady(true)
      }
    })

    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error(t('auth.reset_password_too_short'))
      return
    }
    if (password !== confirm) {
      toast.error(t('auth.reset_password_mismatch'))
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error(error.message || t('auth.reset_toast_error'))
        return
      }
      // Sign the user out so they have to log in with the new password —
      // makes the security intent obvious and matches user expectation.
      await supabase.auth.signOut()
      toast.success(t('auth.reset_toast_success'))
      navigate('/login', { replace: true })
    } catch {
      toast.error(t('auth.reset_toast_error'))
    } finally {
      setLoading(false)
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (ready === null) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <p className="text-sm text-slate-500">{t('auth.reset_submitting')}</p>
        </div>
      </AuthLayout>
    )
  }

  // ── Invalid / expired link state ─────────────────────────────────────────
  if (ready === false) {
    return (
      <AuthLayout>
        <AuthHero
          icon={<ShieldAlert className="h-7 w-7 text-white" strokeWidth={2} />}
          title={t('auth.reset_invalid_link')}
          subtitle={t('auth.reset_invalid_link_hint')}
        />
        <Link
          to="/forgot-password"
          className="w-full inline-flex items-center justify-center h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[4px] shadow-[0_4px_14px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
        >
          {t('auth.forgot_submit')}
          <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
        </Link>
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

  // ── Happy path: show the form ────────────────────────────────────────────
  return (
    <AuthLayout>
      <AuthHero
        icon={<Lock className="h-7 w-7 text-white" strokeWidth={2} />}
        title={t('auth.reset_title')}
        subtitle={t('auth.reset_subtitle')}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-slate-500">
            {t('auth.reset_new_password')}
          </Label>
          <div className="relative">
            <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              dir="ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-11 ps-11 pe-11 bg-slate-50 border-slate-200 rounded-[4px] focus:bg-white focus:border-emerald-500 focus:ring-0 shadow-none text-sm text-slate-900 placeholder:text-slate-400 caret-emerald-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={t('auth.reset_new_password')}
              className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-medium text-slate-500">
            {t('auth.reset_confirm_password')}
          </Label>
          <div className="relative">
            <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              dir="ltr"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              className="h-11 ps-11 pe-11 bg-slate-50 border-slate-200 rounded-[4px] focus:bg-white focus:border-emerald-500 focus:ring-0 shadow-none text-sm text-slate-900 placeholder:text-slate-400 caret-emerald-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={t('auth.reset_confirm_password')}
              className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
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
              {t('auth.reset_submitting')}
            </>
          ) : (
            <>
              {t('auth.reset_submit')}
              <ArrowRight className={`ms-2 h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

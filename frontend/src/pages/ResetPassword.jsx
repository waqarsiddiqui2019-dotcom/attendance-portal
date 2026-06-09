import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, XCircle, Lock, AlertTriangle } from 'lucide-react'
import { verifyResetToken, resetPasswordToken } from '../api/index.js'

function strength(pw) {
  if (!pw || pw.length < 8) return { level: 'weak', label: 'Weak', color: 'bg-rose-500', width: '33%', textColor: 'text-rose-500' }
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const hasNumber  = /\d/.test(pw)
  if (hasSpecial || hasNumber) return { level: 'strong', label: 'Strong', color: 'bg-emerald-500', width: '100%', textColor: 'text-emerald-600' }
  return { level: 'fair', label: 'Fair', color: 'bg-amber-400', width: '66%', textColor: 'text-amber-600' }
}

export default function ResetPassword() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [verifying, setVerifying]   = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [userEmail, setUserEmail]   = useState('')
  const [userName, setUserName]     = useState('')

  const [newPassword, setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)
  const [countdown, setCountdown]         = useState(3)

  useEffect(() => {
    if (!token) { setVerifying(false); return }
    verifyResetToken(token)
      .then(res => {
        if (res.data.valid) {
          setTokenValid(true)
          setUserEmail(res.data.email || '')
          setUserName(res.data.name || '')
        }
      })
      .catch(() => {})
      .finally(() => setVerifying(false))
  }, [token])

  useEffect(() => {
    if (!success) return
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(iv); navigate('/login'); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [success, navigate])

  const pw = strength(newPassword)
  const match = confirmPassword && newPassword === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try {
      await resetPasswordToken(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cardClass = "min-h-screen flex items-center justify-center bg-gray-50 p-4"
  const card = "bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md"

  if (verifying) {
    return (
      <div className={cardClass}>
        <div className={card + " text-center"}>
          <div className="w-10 h-10 border-3 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
          <p className="text-slate-500 text-sm">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className={cardClass}>
        <div className={card + " text-center"}>
          <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Expired or Invalid</h2>
          <p className="text-sm text-slate-500 mb-6">This reset link has expired or has already been used. Please request a new one.</p>
          <Link to="/login"
            className="inline-block w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm text-center transition">
            Request New Reset Link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={cardClass}>
        <div className={card + " text-center"}>
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Password Reset!</h2>
          <p className="text-sm text-slate-500 mb-6">Your password has been reset successfully. You can now log in with your new password.</p>
          <div className="bg-emerald-50 rounded-xl py-3 px-4 text-sm text-emerald-700 font-medium">
            Redirecting to login in {countdown}...
          </div>
          <Link to="/login" className="mt-4 text-sm text-primary hover:underline block">Go to login now</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <div className={card}>
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-xl px-5 py-2.5 shadow-sm border border-slate-200">
            <img src="/DD_Logo_.png" alt="Define Digital" className="h-9 w-auto" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">Set New Password</h2>
        <p className="text-sm text-slate-500 text-center mb-6">For: <span className="font-medium text-slate-700">{userEmail}</span></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Strength indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${pw.color}`} style={{ width: pw.width }} />
                </div>
                <p className={`text-xs font-medium mt-1 ${pw.textColor}`}>{pw.label}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition ${
                  confirmPassword && !match ? 'border-rose-300' : 'border-slate-200'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && !match && (
              <p className="text-xs text-rose-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting || !newPassword || !confirmPassword}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition mt-2">
            {submitting ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Resetting...</> : 'Reset Password'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          <Link to="/login" className="text-primary font-medium hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  )
}

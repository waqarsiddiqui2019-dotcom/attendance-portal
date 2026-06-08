import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import { analyzeError } from '../utils/errorAnalyzer.js'
import { ErrorCard } from '../utils/showError.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)   // smart analyzed error
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoginError(null)
    if (!email || !password) {
      setLoginError({
        severity: 'warning', icon: '✏️',
        title: 'Fields Required',
        reason: 'Please fill in your email and password before signing in.',
        steps: ['Enter your email address', 'Enter your password', 'Then click Sign In'],
        actionLabel: null, actionType: null,
      })
      return
    }
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.name}! ✅`)
      if (['owner','co_owner','admin'].includes(user.role)) navigate('/owner/dashboard')
      else if (user.role === 'trainer')                    navigate('/trainer/dashboard')
      else                                                 navigate('/student/dashboard')
    } catch (err) {
      setLoginError(analyzeError(err, { page: '/login', action: 'login' }))
    } finally {
      setLoading(false)
    }
  }

  const features = [
    'Track attendance across all batches in real-time',
    'Generate detailed reports & export to PDF / Excel',
    'Visual calendar view for full attendance history',
  ]

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2272B9 60%, #1A5C99 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-28 -left-28 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -right-36 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-64 h-64 bg-[#F5A623]/10 rounded-full pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="bg-white rounded-2xl px-8 py-5 inline-flex items-center mb-12 shadow-lg">
            <img
              src="/DD_Logo_.png"
              alt="Define Digital"
              className="h-16 w-auto"
            />
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Attendance Portal
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10">
            Manage your batches, track student attendance, and generate
            reports — all in one place.
          </p>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#F5A623]/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-[#F5A623]" />
                </div>
                <p className="text-blue-100 text-sm leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="border-t border-white/20 pt-6 flex items-center gap-3">
            <img
              src="/DD_Logo_.png"
              alt="Define Digital"
              className="h-6 w-auto opacity-70"
            />
            <p className="text-blue-300 text-xs">
              &copy; {new Date().getFullYear()} Define Digital. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="bg-white rounded-2xl px-6 py-3 shadow-sm border border-slate-200">
              <img src="/DD_Logo_.png" alt="Define Digital" className="h-10 w-auto" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">
                Welcome Back
              </h2>
              <p className="text-slate-500 text-sm">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@definedigital.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white placeholder:text-slate-400 transition"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white placeholder:text-slate-400 transition"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/30 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Smart error card — shows inline below submit button */}
            {loginError && (
              <div className="mt-4">
                <ErrorCard analyzed={loginError} />
              </div>
            )}

            <p className="text-center text-sm text-slate-500 mt-5">
              New trainer?{' '}
              <Link to="/trainer-signup" className="text-primary font-semibold hover:text-primary-dark transition">
                Request Access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

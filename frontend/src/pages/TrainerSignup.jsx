import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, User, Mail, Lock, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { trainerSignup } from '../api/index.js'

export default function TrainerSignup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.confirm) {
      toast.error('Please fill in all fields'); return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters'); return
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match'); return
    }
    setLoading(true)
    try {
      await trainerSignup({ name: form.name, email: form.email, password: form.password })
      setSubmitted(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2272B9 60%, #1A5C99 100%)' }}
      >
        <div className="absolute -top-28 -left-28 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -right-36 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-64 h-64 bg-[#F5A623]/10 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="bg-white rounded-2xl px-8 py-5 inline-flex items-center mb-12 shadow-lg">
            <img src="/DD_Logo_.png" alt="Define Digital" className="h-16 w-auto" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Join Our Team</h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10">
            Sign up as a trainer and start managing batches and attendance once your account is approved.
          </p>
          <div className="space-y-4">
            {[
              'Fill in your details below',
              'Your request goes to the owner for review',
              'Once approved, you can log in and start working',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#F5A623] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#1B3A6B] text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-blue-100 text-sm leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/20 pt-6 flex items-center gap-3">
          <img src="/DD_Logo_.png" alt="Define Digital" className="h-6 w-auto opacity-70" />
          <p className="text-blue-300 text-xs">&copy; {new Date().getFullYear()} Define Digital. All rights reserved.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="bg-white rounded-2xl px-6 py-3 shadow-sm border border-slate-200">
              <img src="/DD_Logo_.png" alt="Define Digital" className="h-10 w-auto" />
            </div>
          </div>

          {submitted ? (
            /* ── Success state ── */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Request Submitted!</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Your trainer account request has been submitted. An owner will review and approve it shortly.
                You will be able to log in once your account is approved.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">What happens next?</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  The Define Digital owner will see your request in their dashboard and either approve or reject it.
                  Only approved trainers can log in.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-block w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm text-center transition"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            /* ── Signup form ── */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">Trainer Sign Up</h2>
                <p className="text-slate-500 text-sm">Create your trainer account — approval required</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="name" value={form.name} onChange={handleChange}
                      placeholder="Your full name"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email" name="email" value={form.email} onChange={handleChange}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'} name="password"
                      value={form.password} onChange={handleChange}
                      placeholder="Min. 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password" name="confirm" value={form.confirm} onChange={handleChange}
                      placeholder="Repeat your password"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-sm shadow-primary/30 mt-2"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting...</>
                  ) : 'Submit Registration'}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                Already approved?{' '}
                <Link to="/login" className="text-primary font-medium hover:text-primary-dark transition">
                  Sign in here
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

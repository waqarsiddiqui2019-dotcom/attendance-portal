// showError — single function all components call to display a smart, styled error.

import React from 'react'
import toast from 'react-hot-toast'
import { analyzeError, SEVERITY_STYLES } from './errorAnalyzer.js'

// ── Smart error toast component ───────────────────────────────────────────────
function SmartErrorToast({ analyzed, onDismiss, onRetry }) {
  const s = SEVERITY_STYLES[analyzed?.severity] || SEVERITY_STYLES.error

  const handleAction = () => {
    onDismiss()
    const t = analyzed.actionType
    if (t === 'retry' && onRetry)    onRetry()
    else if (t === 'reload')         window.location.reload()
    else if (t === 'login')          window.location.href = '/login'
    else if (t === 'back')           window.history.back()
  }

  return (
    <div className={`w-[340px] rounded-xl border shadow-xl overflow-hidden ${s.border} ${s.bg}`}
         style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{analyzed.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`font-bold text-sm ${s.title}`}>{analyzed.title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{analyzed.reason}</p>
        </div>
        <button onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5 p-0.5 transition rounded"
          aria-label="Dismiss">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Steps */}
      {analyzed.steps?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">What to do</p>
          <ol className="space-y-1.5">
            {analyzed.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-px ${s.badge}`}>
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer buttons */}
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 border-t ${s.border}`}>
        <button onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 transition font-medium">
          Dismiss
        </button>
        {analyzed.actionLabel && (
          <button onClick={handleAction}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
              analyzed.severity === 'warning'
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : analyzed.severity === 'error'
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-[#1B3A6B] hover:bg-[#163058] text-white'
            }`}>
            {analyzed.actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ── TRANSPARENT_CONTAINER_STYLE — overrides the Toaster's dark wrapper ────────
const TRANSPARENT = {
  background: 'transparent',
  boxShadow: 'none',
  padding: 0,
  maxWidth: '360px',
}

// ── Main export ───────────────────────────────────────────────────────────────
export function showError(error, context = {}, onRetry = null) {
  // Use pre-analyzed if interceptor already attached one, otherwise analyze now
  const analyzed = error?.analyzed ?? analyzeError(error, context)

  toast.custom(
    (t) => (
      <SmartErrorToast
        analyzed={analyzed}
        onDismiss={() => toast.dismiss(t.id)}
        onRetry={onRetry}
      />
    ),
    {
      // Override the Toaster container so our own card styling shows correctly
      style: TRANSPARENT,
      duration: analyzed.severity === 'warning' ? 6000 : Infinity,
      position: 'top-right',
    }
  )
}

// ── Show a pre-built analysis directly ────────────────────────────────────────
export function showAnalyzed(analyzed, onRetry = null) {
  toast.custom(
    (t) => (
      <SmartErrorToast
        analyzed={analyzed}
        onDismiss={() => toast.dismiss(t.id)}
        onRetry={onRetry}
      />
    ),
    {
      style: TRANSPARENT,
      duration: analyzed.severity === 'warning' ? 6000 : Infinity,
      position: 'top-right',
    }
  )
}

// ── Inline error inside a form ────────────────────────────────────────────────
export function InlineError({ message, className = '' }) {
  if (!message) return null
  return (
    <p className={`text-xs text-rose-600 mt-1 flex items-center gap-1 ${className}`}>
      <span className="font-bold">⚠</span> {message}
    </p>
  )
}

// ── Card-style error for page-level display ───────────────────────────────────
export function ErrorCard({ analyzed, onRetry, className = '' }) {
  if (!analyzed) return null
  const s = SEVERITY_STYLES[analyzed.severity] || SEVERITY_STYLES.error

  const handleAction = () => {
    if (analyzed.actionType === 'retry' && onRetry) onRetry()
    else if (analyzed.actionType === 'reload')       window.location.reload()
    else if (analyzed.actionType === 'login')        window.location.href = '/login'
    else if (analyzed.actionType === 'back')         window.history.back()
  }

  return (
    <div className={`rounded-2xl border p-5 ${s.border} ${s.bg} ${className}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl flex-shrink-0">{analyzed.icon}</span>
        <div>
          <p className={`font-bold text-base ${s.title}`}>{analyzed.title}</p>
          <p className="text-sm text-slate-600 mt-0.5">{analyzed.reason}</p>
        </div>
      </div>
      {analyzed.steps?.length > 0 && (
        <ol className="space-y-1.5 mb-4 ml-8">
          {analyzed.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${s.badge}`}>{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {analyzed.actionLabel && (
        <button onClick={handleAction}
          className={`text-sm font-semibold px-5 py-2 rounded-xl transition ${
            analyzed.severity === 'warning'
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-rose-500 hover:bg-rose-600 text-white'
          }`}>
          {analyzed.actionLabel}
        </button>
      )}
    </div>
  )
}

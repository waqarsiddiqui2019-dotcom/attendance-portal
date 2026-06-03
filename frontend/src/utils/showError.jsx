// showError — the single function all components call to display smart errors.
// Renders a rich toast via react-hot-toast with title, reason, steps, and action button.

import React from 'react'
import toast from 'react-hot-toast'
import { analyzeError, SEVERITY_STYLES } from './errorAnalyzer.js'

// ── Smart error toast component ───────────────────────────────────────────────
function SmartErrorToast({ analyzed, onDismiss, onRetry, onAction }) {
  const s = SEVERITY_STYLES[analyzed.severity] || SEVERITY_STYLES.error

  const handleAction = () => {
    if (analyzed.actionType === 'retry' && onRetry) { onDismiss(); onRetry() }
    else if (analyzed.actionType === 'reload') { onDismiss(); window.location.reload() }
    else if (analyzed.actionType === 'login') { onDismiss(); window.location.href = '/login' }
    else if (analyzed.actionType === 'back') { onDismiss(); window.history.back() }
    else if (analyzed.actionType === 'fix' && onAction) { onDismiss(); onAction() }
    else onDismiss()
  }

  return (
    <div className={`w-[360px] rounded-2xl border shadow-lg ${s.border} ${s.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-lg leading-none mt-0.5 flex-shrink-0">{analyzed.icon}</span>
          <div className="min-w-0">
            <p className={`font-bold text-sm leading-snug ${s.title}`}>{analyzed.title}</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-snug">{analyzed.reason}</p>
          </div>
        </div>
        <button onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5 transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Steps */}
      {analyzed.steps?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">What to do:</p>
          <ol className="space-y-1">
            {analyzed.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${s.badge}`}>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action buttons */}
      {(analyzed.actionLabel || true) && (
        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-t ${s.border}`}>
          <button onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600 transition font-medium">
            Dismiss
          </button>
          {analyzed.actionLabel && (
            <button onClick={handleAction}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition ${
                analyzed.severity === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-rose-500 hover:bg-rose-600 text-white'
              }`}>
              {analyzed.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export: show a smart error from an Error/AxiosError object ──────────
export function showError(error, context = {}, onRetry = null) {
  const analyzed = error?.analyzed ?? analyzeError(error, context)
  const id = toast.custom(
    (t) => (
      <SmartErrorToast
        analyzed={analyzed}
        onDismiss={() => toast.dismiss(t.id)}
        onRetry={onRetry}
      />
    ),
    {
      duration: analyzed.severity === 'warning' ? 6000 : Infinity,
      id: `smart-error-${Date.now()}`,
    }
  )
  return id
}

// ── Show a pre-analyzed object directly ──────────────────────────────────────
export function showAnalyzed(analyzed, onRetry = null) {
  const id = toast.custom(
    (t) => (
      <SmartErrorToast
        analyzed={analyzed}
        onDismiss={() => toast.dismiss(t.id)}
        onRetry={onRetry}
      />
    ),
    {
      duration: analyzed.severity === 'warning' ? 6000 : Infinity,
      id: `smart-error-${Date.now()}`,
    }
  )
  return id
}

// ── Inline error display (for use inside forms) ───────────────────────────────
export function InlineError({ message, className = '' }) {
  if (!message) return null
  return (
    <p className={`text-xs text-rose-600 mt-1 flex items-center gap-1 ${className}`}>
      <span className="font-bold">⚠</span> {message}
    </p>
  )
}

// ── Smart error card (for page-level errors, not toasts) ─────────────────────
export function ErrorCard({ analyzed, onRetry, className = '' }) {
  if (!analyzed) return null
  const s = SEVERITY_STYLES[analyzed.severity] || SEVERITY_STYLES.error

  const handleAction = () => {
    if (analyzed.actionType === 'retry' && onRetry) onRetry()
    else if (analyzed.actionType === 'reload') window.location.reload()
    else if (analyzed.actionType === 'login') window.location.href = '/login'
    else if (analyzed.actionType === 'back') window.history.back()
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

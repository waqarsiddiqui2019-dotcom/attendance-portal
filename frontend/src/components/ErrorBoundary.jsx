import React from 'react'

// ── Crash screen ──────────────────────────────────────────────────────────────
function CrashScreen({ error, onReset }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
        {/* Logo */}
        <div className="mb-6">
          <img src="/DD_Logo_.png" alt="Define Digital" className="h-12 w-auto mx-auto opacity-80" />
        </div>

        {/* Error icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">⚠️</span>
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-2">Something Went Wrong</h1>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Don't worry — your data is safe. The app ran into an unexpected problem.
        </p>

        {/* Resolution steps */}
        <div className="text-left bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">What to do:</p>
          <ol className="space-y-2">
            {[
              'Click "Go Back" to return to the previous page',
              'Or click "Reload App" to start fresh',
              'If this keeps happening, close and restart the app',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => { onReset(); window.history.back() }}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-[#1B3A6B] hover:bg-[#163058] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Reload App
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} Define Digital · Your data is always safe
        </p>
      </div>
    </div>
  )
}

// ── Error Boundary class component ────────────────────────────────────────────
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary caught a render error]', {
      time: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack?.split('\n').slice(0, 5).join('\n'),
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <CrashScreen error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}

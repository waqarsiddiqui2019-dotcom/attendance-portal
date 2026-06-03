// Smart Error Analyzer — translates any technical error into user-friendly guidance.
// Pure JS, no React dependencies.

const PAGE_LABELS = {
  '/login': 'login page',
  '/trainer/dashboard': 'trainer dashboard',
  '/trainer/batches': 'batch list',
  '/trainer/topics-library': 'topics library',
  '/trainer/calendar': 'attendance calendar',
  '/owner/dashboard': 'owner dashboard',
  '/owner/team': 'team management',
  '/student/dashboard': 'student dashboard',
}

function getPageLabel(page = '') {
  for (const [key, label] of Object.entries(PAGE_LABELS)) {
    if (page.includes(key)) return label
  }
  return 'this page'
}

function getRoleLabel(role) {
  return { owner: 'owner', trainer: 'trainer', student: 'student' }[role] || 'user'
}

// ── Main analyzer ──────────────────────────────────────────────────────────────
export function analyzeError(error, context = {}) {
  const { page = '', role = 'trainer', action = '' } = context

  const status = error?.response?.status
  const serverMsg = String(
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message || ''
  ).toLowerCase()

  const isNetwork  = !error?.response && (
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
  const isTimeout  = error?.code === 'ECONNABORTED' || serverMsg.includes('timeout')
  const isOnLogin  = page.includes('/login') || action === 'login'
  const isOnCalendar = page.includes('calendar') || action?.includes('attendance')
  const isOnPlanner  = action?.includes('plan') || action?.includes('distribut')
  const isOnExport   = action?.includes('export')

  // Silent developer log
  console.error('[Portal Error]', {
    time: new Date().toISOString(),
    page, role, action, status, serverMsg,
    raw: error?.message, stack: error?.stack?.split('\n')[0],
  })

  // ── Network / Timeout ────────────────────────────────────────────────────
  if (isTimeout) return {
    severity: 'error',
    icon: '⏱',
    title: 'Request Timed Out',
    reason: 'The server took too long to respond — it may be busy.',
    steps: ['Wait a few seconds, then try again', 'Check your internet connection', 'If this keeps happening, restart the app'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isNetwork) return {
    severity: 'error',
    icon: '📡',
    title: 'Connection Problem',
    reason: 'Cannot reach the server. Your internet may be down.',
    steps: ['Check your internet connection', 'Refresh the page', 'Close and restart the app if the problem continues'],
    actionLabel: 'Reload Page', actionType: 'reload',
  }

  // ── Auth / Session ───────────────────────────────────────────────────────
  if (status === 401) return {
    severity: 'error',
    icon: '🔒',
    title: 'Session Expired',
    reason: 'You were logged out automatically for security.',
    steps: ['Click "Go to Login" below', 'Sign in again — your data is safe', 'Nothing was lost'],
    actionLabel: 'Go to Login', actionType: 'login',
  }

  // ── Forbidden / Role ──────────────────────────────────────────────────────
  if (status === 403) {
    if (serverMsg.includes('pending')) return {
      severity: 'warning',
      icon: '⏳',
      title: 'Account Awaiting Approval',
      reason: 'Your trainer account has not been approved yet.',
      steps: ['Please wait — the owner will review your request', 'Contact Define Digital admin for faster approval', 'You can log in once approved'],
      actionLabel: null, actionType: null,
    }
    if (serverMsg.includes('rejected') || serverMsg.includes('not approved')) return {
      severity: 'error',
      icon: '🚫',
      title: 'Account Not Approved',
      reason: 'Your access request was not approved by the admin.',
      steps: ['Contact Define Digital admin for clarification', 'You can re-apply from the trainer signup page'],
      actionLabel: 'Go to Login', actionType: 'login',
    }
    return {
      severity: 'error',
      icon: '🔐',
      title: 'Access Denied',
      reason: `This section is not available for ${getRoleLabel(role)}s.`,
      steps: [
        'Go back to your dashboard',
        role === 'student' ? 'Contact your trainer if you need access' : 'Contact the owner if you need this permission',
      ],
      actionLabel: 'Go Back', actionType: 'back',
    }
  }

  // ── Not Found ────────────────────────────────────────────────────────────
  if (status === 404) return {
    severity: 'warning',
    icon: '🔍',
    title: 'Not Found',
    reason: 'The item you are looking for no longer exists or was moved.',
    steps: ['Go back and refresh the list', 'It may have been deleted by another user'],
    actionLabel: 'Go Back', actionType: 'back',
  }

  // ── Conflict / Duplicate ─────────────────────────────────────────────────
  if (status === 409) {
    const isEmail = serverMsg.includes('email')
    const isName  = serverMsg.includes('name') || serverMsg.includes('batch')
    return {
      severity: 'warning',
      icon: '⚠️',
      title: isEmail ? 'Email Already in Use' : isName ? 'Name Already Exists' : 'Duplicate Entry',
      reason: isEmail
        ? 'An account with this email address already exists.'
        : isName ? 'Something with this name already exists.'
        : 'This entry already exists in the system.',
      steps: [
        isEmail ? 'Use a different email address' : 'Choose a different name',
        isEmail ? 'If this is your account, go to the login page' : 'Check the existing list before creating a new entry',
      ],
      actionLabel: null, actionType: null,
    }
  }

  // ── Bad Request / Validation ─────────────────────────────────────────────
  if (status === 400) {
    const cleanMsg = error?.response?.data?.error || 'Some required information is missing or incorrect.'
    return {
      severity: 'warning',
      icon: '✏️',
      title: 'Invalid Input',
      reason: cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1),
      steps: ['Check all required fields are filled in', 'Make sure dates and numbers are correct', 'Fix the highlighted fields and try again'],
      actionLabel: 'Fix This', actionType: 'fix',
    }
  }

  // ── Server Error ─────────────────────────────────────────────────────────
  if (status >= 500) return {
    severity: 'error',
    icon: '🖥',
    title: 'Server Error',
    reason: 'Something went wrong on our end. Your data is safe.',
    steps: ['Wait a moment and try again', 'Refresh the page', 'Restart the app if it keeps happening'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  // ── Context-specific fallbacks ───────────────────────────────────────────
  if (isOnLogin) {
    const isWrongPass = serverMsg.includes('invalid') || serverMsg.includes('password') || serverMsg.includes('credentials') || serverMsg.includes('incorrect')
    if (isWrongPass) return {
      severity: 'error', icon: '🔑',
      title: 'Wrong Password or Email',
      reason: 'Your email or password did not match our records.',
      steps: ['Check Caps Lock is OFF', 'Re-type your password carefully', 'Contact your admin if you have forgotten it'],
      actionLabel: null, actionType: null,
    }
    return {
      severity: 'error', icon: '🔐',
      title: 'Login Failed',
      reason: 'Could not sign you in. Please check your details.',
      steps: ['Verify your email address is correct', 'Re-type your password', 'Contact Define Digital admin if you cannot log in'],
      actionLabel: null, actionType: null,
    }
  }

  if (isOnExport) return {
    severity: 'error', icon: '📄',
    title: 'Export Failed',
    reason: 'Could not generate the file right now.',
    steps: ['Make sure there is data to export', 'Try again in a moment', 'Refresh the page and retry'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isOnCalendar) return {
    severity: 'error', icon: '📅',
    title: 'Calendar Error',
    reason: 'Could not save the attendance record.',
    steps: ['Make sure the date is not in the future', 'Check students are enrolled in this batch', 'Refresh and try again'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isOnPlanner) return {
    severity: 'error', icon: '📋',
    title: 'Planner Error',
    reason: 'Could not distribute topics to the calendar.',
    steps: ['Check that a topic set and batch are selected', 'Make sure the date range covers enough sessions', 'Try again'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  const cleanAction = action ? ` while ${action.replace(/-/g, ' ')}` : ` on the ${getPageLabel(page)}`
  return {
    severity: 'error', icon: '⚠️',
    title: 'Something Went Wrong',
    reason: `An unexpected error occurred${cleanAction}. Please try again.`,
    steps: ['Try the action again', 'Refresh the page if the problem continues', 'Contact Define Digital admin if this keeps happening'],
    actionLabel: 'Retry', actionType: 'retry',
  }
}

// ── Severity helpers ──────────────────────────────────────────────────────────
export const SEVERITY_STYLES = {
  error:   { border: 'border-rose-200',   bg: 'bg-rose-50',   icon: 'text-rose-500',   title: 'text-rose-800',   badge: 'bg-rose-100 text-rose-700' },
  warning: { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-500',  title: 'text-amber-800',  badge: 'bg-amber-100 text-amber-700' },
  info:    { border: 'border-blue-200',   bg: 'bg-blue-50',   icon: 'text-blue-500',   title: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700' },
  success: { border: 'border-emerald-200',bg: 'bg-emerald-50',icon: 'text-emerald-500',title: 'text-emerald-800',badge: 'bg-emerald-100 text-emerald-700' },
}

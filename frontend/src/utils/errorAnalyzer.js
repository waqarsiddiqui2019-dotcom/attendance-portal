// Smart Error Analyzer — translates any technical error into friendly, actionable guidance.
// Pure JS, no React dependencies.

function getPageLabel(page = '') {
  const map = {
    '/login': 'login page',
    '/trainer/dashboard': 'trainer dashboard',
    '/trainer/batches': 'batches page',
    '/trainer/topics-library': 'Topics Library',
    '/trainer/calendar': 'attendance calendar',
    '/owner/dashboard': 'owner dashboard',
    '/owner/team': 'team management',
    '/student/dashboard': 'student dashboard',
  }
  for (const [key, label] of Object.entries(map)) {
    if (page.includes(key)) return label
  }
  return 'this page'
}

// ── Main analyzer ──────────────────────────────────────────────────────────────
export function analyzeError(error, context = {}) {
  const { page = '', role = 'trainer', action = '' } = context

  const status  = error?.response?.status
  const rawMsg  = error?.response?.data?.error || error?.response?.data?.message || error?.message || ''
  const serverMsg = String(rawMsg).toLowerCase()

  const isNetwork = !error?.response && (
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
  const isTimeout = error?.code === 'ECONNABORTED' || serverMsg.includes('timeout')

  // Categorise the action
  const isTopicsAction  = action.includes('topic')
  const isAttendanceAction = action.includes('attendance')
  const isExportAction  = action.includes('export')
  const isPlannerAction = action.includes('plan') || action.includes('distribut')
  const isLoginAction   = page.includes('/login') || action === 'login'
  const isBatchAction   = action.includes('batch') || action.includes('student')

  // Silent developer log — full details go here, never shown to user
  console.error('[Portal Error]', {
    time: new Date().toISOString(),
    page, role, action, status,
    serverMsg: serverMsg.slice(0, 120),
    code: error?.code,
    raw: error?.message,
  })

  // ── 1. Network / Proxy / Timeout ─────────────────────────────────────────
  if (isTimeout) return {
    severity: 'error', icon: '⏱',
    title: 'Request Timed Out',
    reason: 'The server took too long to respond.',
    steps: ['Wait a few seconds and try again', 'Check your internet connection', 'If this keeps happening, restart the app via START-APP.bat'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isNetwork) return {
    severity: 'error', icon: '📡',
    title: 'Cannot Reach the Server',
    reason: 'The app cannot connect to the backend server right now.',
    steps: [
      'Check the app is fully started — double-click START-APP.bat',
      'Make sure two terminal windows opened (backend on port 5000 + frontend on port 3000)',
      'Refresh this page after the server is running',
    ],
    actionLabel: 'Reload Page', actionType: 'reload',
  }

  if (status === 503 || status === 502 || status === 504) return {
    severity: 'error', icon: '🔌',
    title: 'Backend Server Not Running',
    reason: 'The app server (port 5000) is not reachable.',
    steps: [
      'Close both terminal windows',
      'Double-click START-APP.bat to restart everything',
      'Wait for both windows to finish starting, then refresh',
    ],
    actionLabel: 'Reload Page', actionType: 'reload',
  }

  // ── 2. Authentication ────────────────────────────────────────────────────
  if (status === 401) return {
    severity: 'error', icon: '🔒',
    title: 'Session Expired',
    reason: 'You were logged out automatically for security.',
    steps: ['Click "Go to Login" below', 'Sign in again with your email and password', 'Your data is safe — nothing was lost'],
    actionLabel: 'Go to Login', actionType: 'login',
  }

  // ── 3. Forbidden ──────────────────────────────────────────────────────────
  if (status === 403) {
    if (serverMsg.includes('pending')) return {
      severity: 'warning', icon: '⏳',
      title: 'Account Awaiting Approval',
      reason: 'Your trainer account has not been approved by the owner yet.',
      steps: ['Wait for the owner to review your request', 'Contact Define Digital admin for faster approval', 'You will be able to log in once approved'],
      actionLabel: null, actionType: null,
    }
    if (serverMsg.includes('rejected') || serverMsg.includes('not approved')) return {
      severity: 'error', icon: '🚫',
      title: 'Account Not Approved',
      reason: 'Your access request was not approved.',
      steps: ['Contact Define Digital admin for clarification', 'You can re-apply from the trainer signup page'],
      actionLabel: 'Go to Login', actionType: 'login',
    }
    if (serverMsg.includes('trainers only') || serverMsg.includes('trainer')) return {
      severity: 'error', icon: '🔐',
      title: 'Trainers Only',
      reason: 'This action can only be performed by a trainer account.',
      steps: ['Make sure you are logged in as a Trainer (not Owner or Student)', 'Log out and sign in with a trainer account'],
      actionLabel: 'Go to Login', actionType: 'login',
    }
    return {
      severity: 'error', icon: '🔐',
      title: 'Access Denied',
      reason: `This section is not available for ${role}s.`,
      steps: ['Go back to your dashboard', 'Contact the admin if you need this access'],
      actionLabel: 'Go Back', actionType: 'back',
    }
  }

  // ── 4. Not Found ──────────────────────────────────────────────────────────
  if (status === 404) return {
    severity: 'warning', icon: '🔍',
    title: 'Not Found',
    reason: 'The item you are looking for does not exist or was deleted.',
    steps: ['Go back and refresh the list', 'The item may have been deleted by someone else'],
    actionLabel: 'Go Back', actionType: 'back',
  }

  // ── 5. Conflict / Duplicate ───────────────────────────────────────────────
  if (status === 409) {
    const isEmail = serverMsg.includes('email')
    return {
      severity: 'warning', icon: '⚠️',
      title: isEmail ? 'Email Already in Use' : 'Duplicate Entry',
      reason: isEmail ? 'An account with this email address already exists.' : 'This item already exists in the system.',
      steps: [
        isEmail ? 'Use a different email address' : 'Choose a different name or value',
        isEmail ? 'If this is your account, go to the login page instead' : 'Check the existing list to avoid duplicates',
      ],
      actionLabel: null, actionType: null,
    }
  }

  // ── 6. Bad Request ────────────────────────────────────────────────────────
  if (status === 400) {
    const userMsg = rawMsg || 'Some required information is missing or incorrect.'
    return {
      severity: 'warning', icon: '✏️',
      title: 'Invalid Input',
      reason: String(userMsg).charAt(0).toUpperCase() + String(userMsg).slice(1),
      steps: ['Check all required fields are filled in', 'Make sure dates and numbers are in the correct format', 'Fix the highlighted fields and try again'],
      actionLabel: 'Fix This', actionType: 'fix',
    }
  }

  // ── 7. Server Error ───────────────────────────────────────────────────────
  if (status >= 500) return {
    severity: 'error', icon: '🖥',
    title: 'Server Error',
    reason: 'Something went wrong on the server. Your data is safe.',
    steps: ['Wait a moment and try again', 'Refresh the page', 'If this keeps happening, restart the app via START-APP.bat'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  // ── 8. Context-specific fallbacks (no HTTP status — unknown errors) ───────

  if (isLoginAction) return {
    severity: 'error', icon: '🔑',
    title: 'Login Failed',
    reason: 'Could not sign you in. Please check your email and password.',
    steps: ['Make sure Caps Lock is OFF', 'Re-type your password carefully', 'Contact Define Digital admin if you have forgotten your password'],
    actionLabel: null, actionType: null,
  }

  if (isTopicsAction) {
    if (action === 'save-topic-items' || action === 'save-topic-set-items') return {
      severity: 'error', icon: '📚',
      title: 'Could Not Save Topics',
      reason: 'The topic list could not be saved to the server.',
      steps: [
        'Make sure the app is fully started (run START-APP.bat)',
        'Check that each topic has a title filled in',
        'Refresh the page — your topic set is not lost, try again',
      ],
      actionLabel: 'Retry', actionType: 'retry',
    }
    if (action === 'create-topic-set') return {
      severity: 'error', icon: '📚',
      title: 'Could Not Create Topic Set',
      reason: 'Failed to create the new topic set.',
      steps: ['Make sure the set name is not empty', 'Check the app is running (START-APP.bat)', 'Try again'],
      actionLabel: 'Retry', actionType: 'retry',
    }
    if (action.includes('load')) return {
      severity: 'error', icon: '📚',
      title: 'Could Not Load Topics Library',
      reason: 'Failed to load topic data from the server.',
      steps: ['Make sure the app is fully started via START-APP.bat', 'Refresh the page', 'If this keeps happening, restart the app'],
      actionLabel: 'Reload Page', actionType: 'reload',
    }
    return {
      severity: 'error', icon: '📚',
      title: 'Topics Library Error',
      reason: 'An error occurred in the Topics Library.',
      steps: ['Check the app is running (START-APP.bat)', 'Refresh the page and try again', 'Your topic sets are saved — they will not be lost'],
      actionLabel: 'Retry', actionType: 'retry',
    }
  }

  if (isAttendanceAction) return {
    severity: 'error', icon: '📅',
    title: 'Attendance Error',
    reason: 'Could not save the attendance record.',
    steps: ['Make sure the date is today or in the past (not a future date)', 'Check students are enrolled in this batch', 'Try again'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isExportAction) return {
    severity: 'error', icon: '📄',
    title: 'Export Failed',
    reason: 'Could not generate the file.',
    steps: ['Make sure there is data to export (mark some attendance first)', 'Try again in a moment', 'Refresh the page and retry'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isPlannerAction) return {
    severity: 'error', icon: '📋',
    title: 'Smart Planner Error',
    reason: 'Could not distribute topics to the calendar.',
    steps: ['Make sure a topic set and batch are both selected', 'Check the date range covers at least a few sessions', 'Try again'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  if (isBatchAction) return {
    severity: 'error', icon: '📁',
    title: 'Batch Action Failed',
    reason: `Could not complete the ${action.replace(/-/g, ' ')} action.`,
    steps: ['Check your internet connection', 'Refresh the page and try again', 'Contact Define Digital admin if this continues'],
    actionLabel: 'Retry', actionType: 'retry',
  }

  // ── 9. Generic final fallback ─────────────────────────────────────────────
  return {
    severity: 'error', icon: '⚠️',
    title: 'Something Went Wrong',
    reason: `An unexpected error occurred on the ${getPageLabel(page)}. Please try again.`,
    steps: [
      'Try the action again',
      'Refresh the page if the problem continues',
      'Make sure the app is fully started via START-APP.bat',
    ],
    actionLabel: 'Retry', actionType: 'retry',
  }
}

// ── Severity styles ───────────────────────────────────────────────────────────
export const SEVERITY_STYLES = {
  error:   { border: 'border-rose-200',    bg: 'bg-rose-50',    icon: 'text-rose-500',    title: 'text-rose-800',    badge: 'bg-rose-100 text-rose-700' },
  warning: { border: 'border-amber-200',   bg: 'bg-amber-50',   icon: 'text-amber-500',   title: 'text-amber-800',   badge: 'bg-amber-100 text-amber-700' },
  info:    { border: 'border-blue-200',    bg: 'bg-blue-50',    icon: 'text-blue-500',    title: 'text-blue-800',    badge: 'bg-blue-100 text-blue-700' },
  success: { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-500', title: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
}

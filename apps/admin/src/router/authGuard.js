const pages = new Set(['/dashboard', '/users', '/posts'])

export function loginDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '/dashboard'
  try {
    const target = new URL(value, 'https://picklight.invalid')
    return pages.has(target.pathname) ? target.pathname + target.search + target.hash : '/dashboard'
  } catch { return '/dashboard' }
}

export function createAuthGuard(session) {
  return async (to) => {
    if (to.meta.public) return true
    try {
      if (await session.ensureSession()) return true
      return { path: '/login', query: { redirect: to.fullPath } }
    } catch (error) {
      return { path: '/login', query: { redirect: to.fullPath, reason: error.reason || 'unavailable' } }
    }
  }
}

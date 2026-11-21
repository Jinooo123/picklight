export function authFailure(message, reason) {
  return Object.assign(new Error(message), { reason })
}

function requireAdmin(user) {
  if (user?.status === 'DISABLED' || user?.status === 'DELETED') {
    throw authFailure('账号已被禁用或删除，请联系管理员', 'disabled')
  }
  if (user?.role !== 'ADMIN') throw authFailure('当前账号没有管理权限', 'forbidden')
  if (user.status !== 'ACTIVE') throw authFailure('无法确认账号状态，请联系管理员', 'invalid')
  return user
}

function failureReason(error) {
  const status = error.response?.status
  const code = error.response?.data?.code ?? error.code
  if (error.reason) return error.reason
  if (code === 40301) return 'disabled'
  if (status === 401 || code === 40100 || code === 40101) return 'expired'
  if (status === 403 || code === 40300) return 'forbidden'
  return 'unavailable'
}

export function createAuthSession({ api, storage }) {
  let verifiedToken = null
  let user = null
  let generation = 0
  let pending = null

  function reset() { verifiedToken = null; user = null; pending = null }
  function logout() { generation += 1; reset(); storage.clear() }

  async function login(credentials) {
    logout()
    const attempt = generation
    const data = await api.login(credentials)
    if (generation !== attempt) throw authFailure('登录操作已取消，请重试', 'cancelled')
    const admin = requireAdmin(data?.user)
    if (typeof data?.token !== 'string' || !data.token.trim()) {
      throw authFailure('登录服务未返回有效凭证，请稍后重试', 'invalid')
    }
    storage.set(data.token)
    verifiedToken = data.token
    user = admin
    return admin
  }

  async function ensureSession() {
    const token = storage.get()
    if (!token) { reset(); return null }
    if (verifiedToken === token && user) return user
    if (pending?.token === token) return pending.promise

    const attempt = generation
    const current = () => generation === attempt && storage.get() === token
    const entry = { token }
    entry.promise = (async () => {
      try {
        const profile = await api.me()
        if (!current()) return null
        const admin = requireAdmin(profile)
        verifiedToken = token
        user = admin
        return admin
      } catch (error) {
        if (!current()) return null
        const reason = failureReason(error)
        // A timeout is not evidence that a stored session is invalid.
        if (['expired', 'forbidden', 'disabled', 'invalid'].includes(reason)) logout()
        throw authFailure(error.userMessage || error.message || '无法验证登录状态', reason)
      } finally {
        if (pending === entry) pending = null
      }
    })()
    pending = entry
    return entry.promise
  }

  return { login, ensureSession, logout }
}

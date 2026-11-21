// Adapter for PR #103 section 8 (review draft). Confirm with T-003/T-404 before release.
// Import lazily to avoid request -> router -> login -> auth initialization cycles.
async function client() { return (await import('./request.js')).default }

function unwrap(payload) {
  if (payload?.code !== 0) {
    const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
    const error = new Error(message && !/^\d+$/.test(message)
      ? message : '登录服务返回异常，请稍后重试')
    error.code = payload?.code
    throw error
  }
  return payload.data
}

export const authApi = {
  async login(credentials) {
    const request = await client()
    return unwrap(await request.post('/auth/login', credentials, { skipAuth: true, silent: true }))
  },
  async me() {
    const request = await client()
    // The guard owns this failure so the original destination is preserved.
    return unwrap(await request.get('/me', { silent: true, handleUnauthorized: false }))
  }
}

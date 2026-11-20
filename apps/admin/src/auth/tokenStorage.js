// Keep only the token in storage. Roles are verified with the server after reload.
export const tokenStorage = {
  get() {
    try { return localStorage.getItem('token') || null } catch { return null }
  },
  set(token) {
    try { localStorage.setItem('token', token) } catch {
      throw new Error('无法保存登录状态，请允许浏览器存储后重试')
    }
  },
  clear() {
    try { localStorage.removeItem('token') } catch { /* Storage may be blocked. */ }
  }
}

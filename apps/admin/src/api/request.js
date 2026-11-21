import { ElMessage } from 'element-plus'
import router from '../router'
import { createRequestClient, DEFAULT_TIMEOUT_MS } from './createRequestClient'
import { tokenStorage } from '../auth/tokenStorage.js'
import { authSession } from '../auth/session.js'

function getToken() {
  return tokenStorage.get()
}

function clearToken() {
  authSession.logout()
}

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS)

export default createRequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS,
  getToken,
  clearToken,
  onUnauthorized() {
    const currentRoute = router.currentRoute.value
    if (currentRoute.path !== '/login') {
      router.replace({ path: '/login', query: { redirect: currentRoute.fullPath } })
    }
  },
  onError(message) {
    ElMessage.error(message)
  }
})

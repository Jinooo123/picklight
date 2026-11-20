import { ElMessage } from 'element-plus'
import router from '../router'
import { createRequestClient, DEFAULT_TIMEOUT_MS } from './createRequestClient'

function getToken() {
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
}

function clearToken() {
  try {
    localStorage.removeItem('token')
  } catch {
    // Login navigation still works when browser storage is unavailable.
  }
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

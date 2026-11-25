import axios from 'axios'

export const DEFAULT_TIMEOUT_MS = 10000

function errorMessage(error) {
  const message = error.response?.data?.message
  if (typeof message === 'string' && message.trim() && !/^\d+$/.test(message.trim())) {
    return message.trim()
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '请求超时，请稍后重试'
  }
  if (!error.response && error.request) return '网络连接失败，请检查网络后重试'
  if (error.response?.status === 401) return '登录已失效，请重新登录'
  if (error.response?.status === 403) return '没有权限执行此操作'
  if (error.response?.status === 404) return '请求的资源不存在'
  if (error.response?.status >= 500) return '服务暂时不可用，请稍后重试'
  return '请求失败，请稍后重试'
}

/**
 * HTTP failures follow the status + { code, message, details } design.
 * Successful response bodies are preserved until T-003 freezes the envelope.
 * skipAuth: public request; silent: let the calling page present the error.
 */
export function createRequestClient({
  baseURL,
  timeout = DEFAULT_TIMEOUT_MS,
  getToken = () => null,
  clearToken = () => {},
  onUnauthorized = () => {},
  onError = () => {}
}) {
  const client = axios.create({ baseURL, timeout })
  let unauthorizedHandled = false

  client.interceptors.request.use((config) => {
    const token = config.skipAuth ? null : (getToken() || null)
    config._sessionToken = token
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
      unauthorizedHandled = false
    } else {
      // Do not reuse an Authorization header left over from a previous session.
      config.headers.delete('Authorization')
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (axios.isCancel(error)) return Promise.reject(error)

      const config = error.config || {}
      const message = errorMessage(error)
      error.userMessage = message

      if (error.response?.status === 401 && !config.skipAuth && config.handleUnauthorized !== false) {
        // A late response from the old session must not clear a new login.
        if (config._sessionToken !== (getToken() || null) || unauthorizedHandled) {
          return Promise.reject(error)
        }
        unauthorizedHandled = true
        clearToken()
        onUnauthorized()
      }

      if (!config.silent) onError(message)
      // Preserve the Axios error/status so callers can handle their own state.
      return Promise.reject(error)
    }
  )

  return client
}

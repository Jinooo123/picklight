const DEFAULT_BASE_URL = '/api/v1'
const DEFAULT_TIMEOUT = 10000
const LOGIN_PAGE = '/pages/login/login'

const requestConfig = {
  baseURL: DEFAULT_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  onError: showErrorToast,
  onUnauthorized: redirectToLogin
}

let unauthorizedHandled = false

function getUni() {
  return typeof globalThis !== 'undefined' ? globalThis.uni : null
}

function getToken() {
  const uniApi = getUni()
  if (!uniApi || typeof uniApi.getStorageSync !== 'function') return ''
  return uniApi.getStorageSync('token') || ''
}

function clearToken() {
  const uniApi = getUni()
  if (!uniApi || typeof uniApi.removeStorageSync !== 'function') return
  uniApi.removeStorageSync('token')
}

function showErrorToast(message) {
  const uniApi = getUni()
  if (!uniApi || typeof uniApi.showToast !== 'function') return
  uniApi.showToast({ title: message, icon: 'none' })
}

function currentPagePath() {
  const uniApi = getUni()
  if (!uniApi || typeof uniApi.getCurrentPages !== 'function') return ''
  const pages = uniApi.getCurrentPages()
  const current = pages && pages[pages.length - 1]
  return current && current.route ? `/${current.route}` : ''
}

function redirectToLogin() {
  const uniApi = getUni()
  if (!uniApi || currentPagePath() === LOGIN_PAGE) return
  if (typeof uniApi.reLaunch === 'function') {
    uniApi.reLaunch({ url: LOGIN_PAGE })
  }
}

function normalizeUrl(url) {
  if (/^https?:\/\//i.test(url)) return url
  const baseURL = String(requestConfig.baseURL || '').replace(/\/+$/, '')
  const path = String(url || '').replace(/^\/+/, '')
  if (!baseURL) return `/${path}`
  return `${baseURL}/${path}`
}

function serverMessage(data) {
  const message = data && data.message
  if (typeof message === 'string' && message.trim() && !/^\d+$/.test(message.trim())) {
    return message.trim()
  }
  return ''
}

function httpErrorMessage(statusCode, data) {
  const message = serverMessage(data)
  if (message) return message
  if (statusCode === 401) return '登录已失效，请重新登录'
  if (statusCode === 403) return '没有权限执行此操作'
  if (statusCode === 404) return '请求的资源不存在'
  if (statusCode >= 500) return '服务暂时不可用，请稍后重试'
  return '请求失败，请稍后重试'
}

function networkErrorMessage(error) {
  const text = String((error && error.errMsg) || '').toLowerCase()
  if (text.includes('timeout')) return '请求超时，请稍后重试'
  return '网络连接失败，请检查网络后重试'
}

function createRequestError(message, details = {}) {
  const error = new Error(message)
  error.userMessage = message
  Object.assign(error, details)
  return error
}

function handleUnauthorized(requestToken) {
  const currentToken = getToken()

  // A delayed response from an old session must not clear a newer token.
  if (currentToken !== requestToken) {
    unauthorizedHandled = false
    return false
  }

  if (unauthorizedHandled) return false
  unauthorizedHandled = true
  clearToken()
  requestConfig.onUnauthorized()
  return true
}

function notify(message, options) {
  if (!options.silent && typeof requestConfig.onError === 'function') {
    requestConfig.onError(message)
  }
}

export function configureRequest(options = {}) {
  if (typeof options.baseURL === 'string') requestConfig.baseURL = options.baseURL
  if (Number.isFinite(options.timeout) && options.timeout > 0) {
    requestConfig.timeout = options.timeout
  }
  if (typeof options.onError === 'function') requestConfig.onError = options.onError
  if (typeof options.onUnauthorized === 'function') {
    requestConfig.onUnauthorized = options.onUnauthorized
  }
  return { ...requestConfig }
}

export function request(options = {}) {
  const uniApi = getUni()
  const {
    url,
    method = 'GET',
    data,
    header = {},
    timeout = requestConfig.timeout,
    skipAuth = false,
    silent = false,
    ...rest
  } = options

  if (!url) {
    const error = createRequestError('请求地址不能为空')
    notify(error.userMessage, { silent })
    return Promise.reject(error)
  }

  if (!uniApi || typeof uniApi.request !== 'function') {
    const error = createRequestError('当前环境不支持网络请求')
    notify(error.userMessage, { silent })
    return Promise.reject(error)
  }

  const requestToken = skipAuth ? '' : getToken()
  const requestHeader = { ...header }
  if (requestToken) requestHeader.Authorization = `Bearer ${requestToken}`

  return new Promise((resolve, reject) => {
    uniApi.request({
      ...rest,
      url: normalizeUrl(url),
      method,
      data,
      header: requestHeader,
      timeout,
      success(response) {
        const statusCode = Number(response && response.statusCode) || 0
        const body = response && response.data

        if (statusCode >= 200 && statusCode < 300) {
          unauthorizedHandled = false
          resolve(body)
          return
        }

        const message = httpErrorMessage(statusCode, body)
        const error = createRequestError(message, {
          statusCode,
          responseData: body
        })

        const shouldNotify =
          statusCode !== 401 || skipAuth || handleUnauthorized(requestToken)
        if (shouldNotify) notify(message, { silent })
        reject(error)
      },
      fail(rawError) {
        const message = networkErrorMessage(rawError)
        const error = createRequestError(message, { cause: rawError })
        notify(message, { silent })
        reject(error)
      }
    })
  })
}

request.get = (url, options = {}) => request({ ...options, url, method: 'GET' })
request.post = (url, data, options = {}) => request({ ...options, url, data, method: 'POST' })
request.put = (url, data, options = {}) => request({ ...options, url, data, method: 'PUT' })
request.delete = (url, options = {}) => request({ ...options, url, method: 'DELETE' })

export default request

/**
 * T-202 上传队列：百分比进度、失败单文件重试、不重复上传。
 *
 * 服务端上传接口（T-502）尚未实现，所以这里不直接调 uni.uploadFile，
 * 而是接收一个 `transport.upload({ filePath, name, onProgress })`。
 * 接口上线后把 makeUniTransport() 传进来即可，队列逻辑不用动。
 *
 * 三条验收对应的实现位置：
 * - 显示百分比、失败可单文件重试 → item.progress / retry()
 * - 重试不产生重复文件或重复动态 → add() 按 path 去重 + success 项不再上传
 * - 弱网中断后已成功的文件不重复上传 → runPool() 只挑 pending，success 永不回到队列
 */

export const UPLOAD_STATUS = {
  pending: 'pending',
  uploading: 'uploading',
  success: 'success',
  failed: 'failed'
}

export const UPLOAD_PATH = '/api/v1/media/uploads'

function normalizeResult(result = {}) {
  return {
    id: result.id != null ? result.id : null,
    url: result.url || '',
    mediaType: result.mediaType || ''
  }
}

function createItem(file = {}, index = 0) {
  const path = file.path || file.tempFilePath || ''
  return {
    id: file.id || `u-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    path,
    name: file.name || '',
    size: Number(file.size || 0),
    type: file.type || 'image',
    status: UPLOAD_STATUS.pending,
    progress: 0,
    attempts: 0,
    error: '',
    result: null
  }
}

export function createUploadQueue(options = {}) {
  const transport = options.transport
  const concurrency = Math.max(1, Number(options.concurrency || 3))
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const onItemChange = typeof options.onItemChange === 'function' ? options.onItemChange : () => {}

  let items = []

  function snapshot() {
    return items.map((item) => ({ ...item, result: item.result ? { ...item.result } : null }))
  }

  function stats() {
    const total = items.length
    const count = (status) => items.filter((item) => item.status === status).length
    const success = count(UPLOAD_STATUS.success)
    const failed = count(UPLOAD_STATUS.failed)
    const uploading = count(UPLOAD_STATUS.uploading)
    const pending = count(UPLOAD_STATUS.pending)
    const sum = items.reduce(
      (acc, item) => acc + (item.status === UPLOAD_STATUS.success ? 100 : item.progress),
      0
    )
    return {
      total,
      success,
      failed,
      uploading,
      pending,
      percent: total === 0 ? 0 : Math.round(sum / total)
    }
  }

  function emitItem(item) {
    onItemChange({ ...item, result: item.result ? { ...item.result } : null })
  }

  function emitProgress() {
    onProgress(stats())
  }

  function add(files = []) {
    const added = []
    files.forEach((file, index) => {
      const path = file.path || file.tempFilePath || ''
      if (!path) return
      if (items.some((item) => item.path === path)) return
      const item = createItem(file, items.length + index)
      items.push(item)
      added.push(item)
      emitItem(item)
    })
    if (added.length) emitProgress()
    return added
  }

  async function uploadOne(item) {
    if (!item || item.status === UPLOAD_STATUS.success) return item
    if (!transport || typeof transport.upload !== 'function') {
      item.status = UPLOAD_STATUS.failed
      item.error = '缺少上传通道'
      emitItem(item)
      emitProgress()
      return item
    }

    item.status = UPLOAD_STATUS.uploading
    item.progress = 0
    item.error = ''
    item.attempts += 1
    emitItem(item)
    emitProgress()

    try {
      const result = await transport.upload({
        filePath: item.path,
        name: item.name,
        onProgress: (percent) => {
          const value = Math.max(0, Math.min(100, Number(percent) || 0))
          if (value <= item.progress) return
          item.progress = value
          emitItem(item)
          emitProgress()
        }
      })
      const normalized = normalizeResult(result)
      if (normalized.id == null) throw new Error('上传完成但未返回媒体标识')
      item.status = UPLOAD_STATUS.success
      item.progress = 100
      item.result = normalized
    } catch (error) {
      item.status = UPLOAD_STATUS.failed
      item.error = (error && (error.userMessage || error.message)) || '上传失败'
    }

    emitItem(item)
    emitProgress()
    return item
  }

  async function runPool(queue) {
    let cursor = 0
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (cursor < queue.length) {
        const item = queue[cursor]
        cursor += 1
        await uploadOne(item)
      }
    })
    await Promise.all(workers)
  }

  async function start() {
    await runPool(items.filter((item) => item.status === UPLOAD_STATUS.pending))
    return snapshot()
  }

  async function retry(itemId) {
    const item = items.find((entry) => entry.id === itemId)
    if (!item || item.status !== UPLOAD_STATUS.failed) return false
    await uploadOne(item)
    return true
  }

  async function retryFailed() {
    await runPool(items.filter((item) => item.status === UPLOAD_STATUS.failed))
    return snapshot()
  }

  function remove(itemId) {
    const target = items.find((item) => item.id === itemId)
    if (!target || target.status === UPLOAD_STATUS.uploading) return false
    items = items.filter((item) => item.id !== itemId)
    emitProgress()
    return true
  }

  /** 页面删掉一张图时按文件路径同步移出队列。 */
  function removeByPath(path) {
    const target = items.find((item) => item.path === path)
    if (!target) return false
    return remove(target.id)
  }

  /** 发布时用：只取上传成功的媒体标识，顺序与入队顺序一致。 */
  function mediaIds() {
    return items
      .filter((item) => item.status === UPLOAD_STATUS.success && item.result && item.result.id != null)
      .map((item) => item.result.id)
  }

  function reset() {
    items = []
    emitProgress()
  }

  return {
    add,
    start,
    retry,
    retryFailed,
    remove,
    removeByPath,
    reset,
    snapshot,
    stats,
    mediaIds
  }
}

/**
 * 按 T-003 契约（POST /api/v1/media/uploads，multipart 字段名 file）实现的上传通道。
 * T-502 落地后直接启用；在此之前可用 mockTransport 跑通页面。
 */
export function makeUniTransport({ baseUrl = '', getToken = () => '' } = {}) {
  return {
    upload({ filePath, onProgress }) {
      return new Promise((resolve, reject) => {
        const api = typeof uni !== 'undefined' ? uni : null
        if (!api || typeof api.uploadFile !== 'function') {
          reject(new Error('当前环境不支持上传'))
          return
        }
        const token = getToken()
        const task = api.uploadFile({
          url: `${baseUrl}${UPLOAD_PATH}`,
          filePath,
          name: 'file',
          header: token ? { Authorization: `Bearer ${token}` } : {},
          success: (response) => {
            let payload = null
            try {
              payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
            } catch (error) {
              reject(new Error('上传响应不是合法 JSON'))
              return
            }
            if (response.statusCode !== 200 || !payload) {
              reject(new Error((payload && payload.message) || `上传失败（HTTP ${response.statusCode}）`))
              return
            }
            if (payload.code !== 0 || !payload.data) {
              const failure = new Error(payload.message || '上传失败')
              failure.userMessage = payload.message || '上传失败'
              reject(failure)
              return
            }
            resolve(payload.data)
          },
          fail: (error) => {
            reject(new Error((error && error.errMsg) || '上传中断'))
          }
        })
        if (task && typeof task.onProgressUpdate === 'function' && typeof onProgress === 'function') {
          task.onProgressUpdate((event = {}) => {
            const percent = event.progress != null
              ? event.progress
              : Math.round((Number(event.totalBytesSent || 0) / Math.max(1, Number(event.totalBytesExpectedToSend || 1))) * 100)
            onProgress(percent)
          })
        }
      })
    }
  }
}

/** 联调前用：按固定耗时返回递增进度，failPaths 里的文件会先失败一次。 */
export function createMockTransport({ delay = 30, failPaths = [], failOnce = true } = {}) {
  const failedOnce = new Set()
  // 预览调试用：页面外设置 globalThis.__mockUploadFailPaths 可临时指定要失败的文件
  const failList = () => {
    const injected = typeof globalThis !== 'undefined' ? globalThis.__mockUploadFailPaths : null
    return Array.isArray(injected) ? injected : failPaths
  }
  return {
    upload({ filePath, onProgress }) {
      return new Promise((resolve, reject) => {
        let percent = 0
        const timer = setInterval(() => {
          percent += 20
          if (typeof onProgress === 'function') onProgress(Math.min(100, percent))
          if (percent < 100) return
          clearInterval(timer)

          const shouldFail =
            failList().some((target) => target && filePath.includes(target)) &&
            (!failOnce || !failedOnce.has(filePath))
          if (shouldFail) {
            failedOnce.add(filePath)
            reject(new Error('网络中断，上传失败'))
            return
          }

          resolve({
            id: Math.floor(Math.random() * 100000),
            url: `https://media.example.com/${encodeURIComponent(filePath.split('/').pop() || 'file')}`,
            mediaType: filePath.endsWith('.mp4') ? 'VIDEO' : 'IMAGE'
          })
        }, delay)
      })
    }
  }
}

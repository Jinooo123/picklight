/**
 * T-201 媒体选择与本地校验。
 *
 * 规则来源：Issue #21「图片最多 9 张、视频 1 个，超出即时拦截；格式与大小不符在本地就提示，
 * 不发请求」。所有判断都在这一个文件里完成，页面只负责展示与调用。
 *
 * 待确认：媒体接口契约（T-003）尚未冻结，图片与视频能否共存没有定论。当前按互斥处理，
 * 若联调后需要放开，只改 ALLOW_MIXED_MEDIA 一处。
 */

export const ALLOW_MIXED_MEDIA = false

export const MEDIA_LIMITS = {
  image: {
    max: 9,
    maxSizeMB: 10,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  video: {
    max: 1,
    maxSizeMB: 100,
    maxDurationSec: 60,
    extensions: ['mp4', 'mov']
  }
}

export const MEDIA_TYPE_LABEL = { image: '图片', video: '视频' }

export function extensionOf(fileName = '') {
  const clean = String(fileName).split('?')[0].split('#')[0]
  const index = clean.lastIndexOf('.')
  if (index < 0 || index === clean.length - 1) return ''
  return clean.slice(index + 1).toLowerCase()
}

export function fileNameOf(path = '') {
  const clean = String(path).split('?')[0]
  const parts = clean.split(/[\\/]/)
  return parts[parts.length - 1] || clean
}

export function formatSize(bytes = 0) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  const mb = value / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}

export function detectMediaType(name = '', mimeType = '') {
  const ext = extensionOf(name)
  if (MEDIA_LIMITS.video.extensions.includes(ext)) return 'video'
  if (MEDIA_LIMITS.image.extensions.includes(ext)) return 'image'
  const mime = String(mimeType).toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  return ''
}

function normalizeFile(raw = {}) {
  const nested = raw.file || {}
  const path = raw.tempFilePath || raw.path || nested.path || ''
  const name = raw.name || nested.name || fileNameOf(path)
  const mime = raw.mimeType || nested.type || ''
  const declared = raw.fileType || raw.type || ''
  const type = declared === 'image' || declared === 'video' ? declared : detectMediaType(name, mime)
  return {
    path,
    thumb: raw.thumbTempFilePath || path,
    name,
    size: Number(raw.size != null ? raw.size : nested.size || 0),
    duration: Number(raw.duration || 0),
    width: Number(raw.width || 0),
    height: Number(raw.height || 0),
    type
  }
}

/** 单文件校验：格式、大小、视频时长。返回 { ok, type, message }。 */
export function validateItem(item = {}) {
  const type = item.type || detectMediaType(item.name, item.mimeType)
  if (!type) {
    return { ok: false, message: `不支持的文件格式，已跳过：${item.name || '未知文件'}` }
  }

  const limit = MEDIA_LIMITS[type]
  const label = MEDIA_TYPE_LABEL[type]
  const ext = extensionOf(item.name)
  if (ext && !limit.extensions.includes(ext)) {
    return { ok: false, message: `${label}格式仅支持 ${limit.extensions.join('、')}，已跳过：${item.name}` }
  }

  const sizeMB = Number(item.size || 0) / (1024 * 1024)
  if (sizeMB > limit.maxSizeMB) {
    return {
      ok: false,
      message: `${label}不能超过 ${limit.maxSizeMB} MB，已跳过：${item.name}（${formatSize(item.size)}）`
    }
  }

  if (type === 'video') {
    const duration = Number(item.duration || 0)
    if (duration > limit.maxDurationSec) {
      return {
        ok: false,
        message: `视频时长不能超过 ${limit.maxDurationSec} 秒，已跳过：${item.name}（${Math.round(duration)} 秒）`
      }
    }
  }

  return { ok: true, type }
}

function toMediaItem(file, type, index) {
  return {
    id: file.id || `${type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    path: file.path,
    thumb: file.thumb || file.path,
    name: file.name,
    size: file.size,
    duration: file.duration,
    width: file.width,
    height: file.height
  }
}

export function countByType(items = []) {
  return items.reduce(
    (acc, item) => {
      if (item.type === 'image') acc.image += 1
      else if (item.type === 'video') acc.video += 1
      return acc
    },
    { image: 0, video: 0 }
  )
}

/** 还能选几个（供选择器传 count，也决定是否显示"添加"格）。 */
export function remainingSlots(items = []) {
  const counts = countByType(items)
  if (!ALLOW_MIXED_MEDIA) {
    if (counts.video > 0) return 0
    if (counts.image > 0) return Math.max(0, MEDIA_LIMITS.image.max - counts.image)
    return MEDIA_LIMITS.image.max
  }
  return Math.max(0, MEDIA_LIMITS.image.max - counts.image) + Math.max(0, MEDIA_LIMITS.video.max - counts.video)
}

/**
 * 把新选的文件并入已选列表。超出上限或不合规的进 rejected，不进入列表。
 * 返回 { items, rejected, message }：message 为可直接展示的一句提示。
 */
export function planSelection(current = [], incoming = []) {
  const items = [...current]
  const rejected = []

  incoming.forEach((raw) => {
    const file = normalizeFile(raw)
    const checked = validateItem(file)

    if (!checked.ok) {
      rejected.push({ name: file.name, message: checked.message })
      return
    }

    const type = checked.type

    if (!ALLOW_MIXED_MEDIA) {
      const other = type === 'image' ? 'video' : 'image'
      if (items.some((item) => item.type === other)) {
        rejected.push({
          name: file.name,
          message: `图片和视频不能同时选择，请先删除已选的${MEDIA_TYPE_LABEL[other]}`
        })
        return
      }
    }

    const limit = MEDIA_LIMITS[type]
    const used = countByType(items)[type]
    if (used >= limit.max) {
      rejected.push({
        name: file.name,
        message: `${MEDIA_TYPE_LABEL[type]}最多 ${limit.max} ${type === 'image' ? '张' : '个'}`
      })
      return
    }

    items.push(toMediaItem(file, type, items.length))
  })

  return { items, rejected, message: summarizeRejection(rejected) }
}

export function summarizeRejection(rejected = []) {
  if (!rejected.length) return ''
  const first = rejected[0].message
  return rejected.length > 1 ? `${first}（另有 ${rejected.length - 1} 个文件未加入）` : first
}

/**
 * 调起选择器，统一各端返回结构。
 * count 由调用方按剩余额度传入；微信端选视频时只能选 1 个。
 */
export function chooseMedia({ count = MEDIA_LIMITS.image.max, mediaType = ['image', 'video'] } = {}) {
  return new Promise((resolve, reject) => {
    const api = typeof uni !== 'undefined' ? uni : null
    if (!api) {
      reject(new Error('当前环境不支持选择媒体'))
      return
    }

    const onSuccess = (res = {}) => {
      const files = res.tempFiles || res.tempFilePaths || []
      resolve(files.map((file) => (typeof file === 'string' ? normalizeFile({ tempFilePath: file }) : normalizeFile(file))))
    }

    if (typeof api.chooseMedia === 'function') {
      api.chooseMedia({
        count,
        mediaType,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        maxDuration: MEDIA_LIMITS.video.maxDurationSec,
        success: onSuccess,
        fail: reject
      })
      return
    }

    if (mediaType.includes('video') && mediaType.length === 1) {
      api.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: MEDIA_LIMITS.video.maxDurationSec,
        success: onSuccess,
        fail: reject
      })
      return
    }

    api.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: onSuccess,
      fail: reject
    })
  })
}

export function isUserCancel(error) {
  const message = String((error && (error.errMsg || error.message)) || '')
  return message.includes('cancel')
}

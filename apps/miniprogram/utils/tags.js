/**
 * T-203 标签规则：0-5 个、自动去重、可新建。
 *
 * "可新建"指输入框里不存在的标签直接成为新标签，不需要从固定列表里挑；
 * 去重按规范化后的文本比较，避免「前后空格不同」「全角空格」被判成两个标签。
 */

export const TAG_LIMIT = 5
export const TAG_MAX_LENGTH = 10

/** 折叠连续空白（含全角空格）并去掉首尾空白。 */
export function normalizeTag(input = '') {
  return String(input)
    .replace(/[\s\u3000]+/g, ' ')
    .trim()
}

function lengthOf(text) {
  return Array.from(text).length
}

/**
 * 尝试添加一个标签。
 * 返回 { ok, tags, message }：失败时 tags 原样返回，message 可直接展示。
 */
export function planTagAdd(current = [], input = '') {
  const tag = normalizeTag(input)

  if (!tag) {
    return { ok: false, tags: [...current], message: '标签不能为空' }
  }

  if (lengthOf(tag) > TAG_MAX_LENGTH) {
    return { ok: false, tags: [...current], message: `标签最多 ${TAG_MAX_LENGTH} 个字` }
  }

  if (current.length >= TAG_LIMIT) {
    return { ok: false, tags: [...current], message: `最多添加 ${TAG_LIMIT} 个标签` }
  }

  const exists = current.some((item) => normalizeTag(item).toLowerCase() === tag.toLowerCase())
  if (exists) {
    return { ok: false, tags: [...current], message: '这个标签已经加过了' }
  }

  return { ok: true, tags: [...current, tag], message: '' }
}

export function removeTagAt(current = [], index = -1) {
  if (index < 0 || index >= current.length) return [...current]
  return current.filter((_, position) => position !== index)
}

export function canAddMore(current = []) {
  return current.length < TAG_LIMIT
}

/** 过滤掉非法项，用于从草稿恢复时兜底。 */
export function sanitizeTags(raw = []) {
  const result = []
  raw.forEach((item) => {
    if (typeof item !== 'string') return
    const tag = normalizeTag(item)
    if (!tag || lengthOf(tag) > TAG_MAX_LENGTH) return
    if (result.length >= TAG_LIMIT) return
    if (result.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
    result.push(tag)
  })
  return result
}

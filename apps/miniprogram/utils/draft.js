/**
 * T-203 发布草稿：切后台或页面被打断后返回，正文与标签不丢。
 *
 * 只保存正文和标签。媒体是临时文件路径，跨会话/跨冷启动会失效，
 * 存了反而会让用户以为图片还在，所以不存。
 *
 * storage 作为参数注入，默认用 uni 的同步存储，便于纯逻辑测试。
 */

import { sanitizeTags } from './tags'

export const DRAFT_KEY = 'picklight:publish-draft'
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function defaultStorage() {
  return typeof uni !== 'undefined' ? uni : null
}

export function saveDraft(payload = {}, storage = defaultStorage()) {
  if (!storage || typeof storage.setStorageSync !== 'function') return false

  const body = String(payload.body || '')
  const tags = sanitizeTags(Array.isArray(payload.tags) ? payload.tags : [])

  if (!body.trim() && tags.length === 0) {
    return clearDraft(storage)
  }

  try {
    storage.setStorageSync(DRAFT_KEY, { body, tags, savedAt: Date.now() })
    return true
  } catch (error) {
    return false
  }
}

export function loadDraft(storage = defaultStorage(), now = Date.now()) {
  if (!storage || typeof storage.getStorageSync !== 'function') return null

  let draft
  try {
    draft = storage.getStorageSync(DRAFT_KEY)
  } catch (error) {
    return null
  }

  if (!draft || typeof draft !== 'object') return null

  const body = String(draft.body || '')
  const tags = sanitizeTags(Array.isArray(draft.tags) ? draft.tags : [])

  if (!body.trim() && tags.length === 0) return null

  const savedAt = Number(draft.savedAt || 0)
  if (savedAt > 0 && now - savedAt > DRAFT_TTL_MS) return null

  return { body, tags, savedAt }
}

export function clearDraft(storage = defaultStorage()) {
  if (!storage || typeof storage.removeStorageSync !== 'function') return false
  try {
    storage.removeStorageSync(DRAFT_KEY)
    return true
  } catch (error) {
    return false
  }
}

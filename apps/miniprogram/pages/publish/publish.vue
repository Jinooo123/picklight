<template>
  <view class="page">
    <text class="title">发布动态</text>

    <textarea
      v-model="body"
      class="field area"
      placeholder="写点什么（最多 2000 字）"
      maxlength="2000"
    />
    <view class="row">
      <text class="hint">{{ body.length }}/2000</text>
    </view>

    <view class="media">
      <view class="media__head">
        <text class="media__label">图片 / 视频</text>
        <text class="media__count">{{ countText }}</text>
      </view>

      <view class="media__grid">
        <view
          v-for="(item, index) in media"
          :key="item.id"
          class="media__item"
          @click="preview(item, index)"
        >
          <image
            v-if="item.type === 'image'"
            class="media__thumb"
            :src="item.thumb"
            mode="aspectFill"
          />
          <view v-else class="media__video">
            <text class="media__video-icon">▶</text>
            <text class="media__video-time">{{ videoDuration(item) }}</text>
          </view>

          <view
            v-if="uploadOf(item).status === 'failed'"
            class="media__mask media__mask--failed"
            @click.stop="retryUpload(item)"
          >
            <text class="media__mask-text">上传失败</text>
            <text class="media__mask-hint">点击重试</text>
          </view>
          <view
            v-else-if="uploadOf(item).status === 'uploading' || uploadOf(item).status === 'pending'"
            class="media__mask"
          >
            <text class="media__mask-text">
              {{ uploadOf(item).status === 'pending' ? '等待上传' : uploadOf(item).progress + '%' }}
            </text>
            <view class="media__bar">
              <view class="media__bar-fill" :style="{ width: uploadOf(item).progress + '%' }" />
            </view>
          </view>
          <view v-else-if="uploadOf(item).status === 'success'" class="media__badge">✓</view>

          <view class="media__remove" @click.stop="removeMedia(item.id)">×</view>
        </view>

        <view v-if="slots > 0" class="media__item media__add" @click="pick">
          <text class="media__add-icon">+</text>
          <text class="media__add-text">{{ addText }}</text>
        </view>
      </view>

      <view v-if="uploadStats.total > 0" class="upload">
        <view class="upload__head">
          <text class="upload__summary">{{ uploadSummary }}</text>
          <text v-if="uploadStats.failed > 0" class="upload__retry" @click="retryAllFailed">
            重试失败项
          </text>
        </view>
        <view class="upload__bar">
          <view class="upload__bar-fill" :style="{ width: uploadStats.percent + '%' }" />
        </view>
      </view>

      <text v-if="hintText" class="media__error">{{ hintText }}</text>
      <text class="media__tip">{{ ruleText }}</text>
    </view>

    <view class="tags">
      <view class="tags__head">
        <text class="tags__label">标签</text>
        <text class="tags__count">{{ tags.length }}/{{ TAG_LIMIT }}</text>
      </view>

      <view v-if="tags.length" class="tags__list">
        <view v-for="(tag, index) in tags" :key="tag" class="tags__chip">
          <text class="tags__chip-text">{{ tag }}</text>
          <text class="tags__chip-remove" @click="removeTag(index)">×</text>
        </view>
      </view>

      <view v-if="showTagInput" class="tags__input-row">
        <input
          v-model="tagInput"
          class="tags__input"
          :maxlength="TAG_MAX_LENGTH"
          placeholder="输入标签后回车添加"
          confirm-type="done"
          @confirm="addTag"
        />
        <button class="tags__add" @click="addTag">添加</button>
      </view>

      <text v-if="tagMessage" class="tags__error">{{ tagMessage }}</text>
      <text v-else class="tags__tip">最多 {{ TAG_LIMIT }} 个，重复的会自动忽略</text>
    </view>

    <view v-if="previewing" class="player" @click="closePlayer">
      <video class="player__video" :src="previewing.path" :autoplay="true" controls @click.stop />
      <text class="player__close">点击空白处关闭</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import {
  MEDIA_LIMITS,
  chooseMedia,
  countByType,
  isUserCancel,
  planSelection,
  remainingSlots
} from '../../utils/media'
import {
  TAG_LIMIT,
  TAG_MAX_LENGTH,
  canAddMore,
  planTagAdd,
  removeTagAt
} from '../../utils/tags'
import { loadDraft, saveDraft } from '../../utils/draft'
import {
  UPLOAD_STATUS,
  createMockTransport,
  createUploadQueue,
  makeUniTransport
} from '../../utils/upload'

// T-502 上传接口尚未落地，先用本地 mock 跑通进度与重试；
// 接口上线后把这里改成 false，并在 API_BASE 填服务端地址。
const USE_MOCK_UPLOAD = true
const API_BASE = ''

const body = ref('')
const media = ref([])
const hintText = ref('')
const previewing = ref(null)
let hintTimer = null

const tags = ref([])
const tagInput = ref('')
const tagMessage = ref('')
const showTagInput = computed(() => canAddMore(tags.value))
let tagTimer = null
let draftTimer = null
let draftRestored = false

const uploadMap = ref({})
const uploadStats = ref({ total: 0, success: 0, failed: 0, uploading: 0, pending: 0, percent: 0 })

const counts = computed(() => countByType(media.value))
const slots = computed(() => remainingSlots(media.value))

const countText = computed(() =>
  counts.value.video > 0
    ? `视频 ${counts.value.video}/${MEDIA_LIMITS.video.max}`
    : `图片 ${counts.value.image}/${MEDIA_LIMITS.image.max}`
)

const addText = computed(() => (media.value.length === 0 ? '选择图片或视频' : '继续添加'))

const ruleText = computed(
  () =>
    `图片最多 ${MEDIA_LIMITS.image.max} 张（每张 ≤ ${MEDIA_LIMITS.image.maxSizeMB} MB），或视频 1 个（≤ ${MEDIA_LIMITS.video.maxDurationSec} 秒、${MEDIA_LIMITS.video.maxSizeMB} MB）`
)

const uploadSummary = computed(() => {
  const stats = uploadStats.value
  if (stats.total === 0) return ''
  if (stats.success === stats.total) return `已全部上传（${stats.total}）`
  if (stats.failed > 0 && stats.uploading === 0 && stats.pending === 0) {
    return `${stats.failed} 个失败，${stats.success} 个成功`
  }
  return `上传中 ${stats.success}/${stats.total} · ${stats.percent}%`
})

const queue = createUploadQueue({
  transport: USE_MOCK_UPLOAD
    ? createMockTransport({ delay: 120 })
    : makeUniTransport({
        baseUrl: API_BASE,
        getToken: () => {
          try {
            return (typeof uni !== 'undefined' && uni.getStorageSync('token')) || ''
          } catch (error) {
            return ''
          }
        }
      }),
  concurrency: 3,
  onProgress: (stats) => {
    uploadStats.value = stats
  },
  onItemChange: (item) => {
    uploadMap.value = {
      ...uploadMap.value,
      [item.path]: {
        queueId: item.id,
        status: item.status,
        progress: item.progress,
        error: item.error,
        mediaId: item.result ? item.result.id : null
      }
    }
  }
})

function uploadOf(item) {
  return uploadMap.value[item.path] || { status: UPLOAD_STATUS.pending, progress: 0 }
}

function setHint(text) {
  hintText.value = text
  if (hintTimer) clearTimeout(hintTimer)
  if (text) {
    hintTimer = setTimeout(() => {
      hintText.value = ''
    }, 5000)
  }
}

function videoDuration(item) {
  const seconds = Math.round(Number(item.duration || 0))
  return seconds > 0 ? `${seconds}s` : ''
}

async function pick() {
  if (slots.value <= 0) {
    setHint('已达到上限，删除后才能继续添加')
    return
  }

  const mediaType = counts.value.image > 0 ? ['image'] : ['image', 'video']

  try {
    const files = await chooseMedia({ count: slots.value, mediaType })
    if (!files.length) return
    const result = planSelection(media.value, files)
    media.value = result.items
    setHint(result.message)
    queue.add(result.items)
    queue.start()
  } catch (error) {
    if (isUserCancel(error)) return
    setHint('打开相册失败，请重试')
  }
}

function removeMedia(id) {
  const target = media.value.find((entry) => entry.id === id)
  media.value = media.value.filter((item) => item.id !== id)
  if (target) {
    queue.removeByPath(target.path)
    const next = { ...uploadMap.value }
    delete next[target.path]
    uploadMap.value = next
  }
  setHint('')
}

async function retryUpload(item) {
  const record = uploadMap.value[item.path]
  if (!record || !record.queueId) return
  await queue.retry(record.queueId)
}

async function retryAllFailed() {
  await queue.retryFailed()
}

function preview(item) {
  if (item.type === 'video') {
    previewing.value = item
    return
  }

  const images = media.value.filter((entry) => entry.type === 'image')
  const urls = images.map((entry) => entry.path)
  const index = images.findIndex((entry) => entry.id === item.id)
  if (typeof uni !== 'undefined' && typeof uni.previewImage === 'function') {
    uni.previewImage({ urls, current: urls[index] || urls[0] })
  }
}

function closePlayer() {
  previewing.value = null
}

function setTagMessage(text) {
  tagMessage.value = text
  if (tagTimer) clearTimeout(tagTimer)
  if (text) {
    tagTimer = setTimeout(() => {
      tagMessage.value = ''
    }, 4000)
  }
}

function persistDraft() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  saveDraft({ body: body.value, tags: tags.value })
}

function addTag() {
  const result = planTagAdd(tags.value, tagInput.value)
  tags.value = result.tags
  if (!result.ok) {
    setTagMessage(result.message)
    return
  }
  tagInput.value = ''
  tagMessage.value = ''
  persistDraft()
}

function removeTag(index) {
  tags.value = removeTagAt(tags.value, index)
  persistDraft()
}

watch(
  [body, tags],
  () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      saveDraft({ body: body.value, tags: tags.value })
    }, 800)
  },
  { deep: true }
)

onShow(() => {
  if (draftRestored) return
  draftRestored = true

  const draft = loadDraft()
  if (!draft) return

  if (draft.body && !body.value) body.value = draft.body
  if (draft.tags.length && tags.value.length === 0) tags.value = draft.tags

  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({ title: '已恢复上次未发布的草稿', icon: 'none' })
  }
})

onHide(() => {
  persistDraft()
})
</script>

<style lang="scss" scoped>
.page { padding: $space-lg; }
.title { display: block; margin-bottom: $space-md; font-size: $font-title; font-weight: 500; color: $text-main; }
.field { box-sizing: border-box; width: 100%; padding: $space-md; border: 1px solid $border; border-radius: $radius; background: $bg-surface; font-size: $font-base; color: $text-main; }
.area { height: 300rpx; }
.row { display: flex; justify-content: flex-end; margin: $space-xs 0 $space-md; }
.hint { font-size: $font-caption; color: $text-muted; }

.media { margin-top: $space-md; }
.media__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: $space-sm; }
.media__label { font-size: $font-base; font-weight: 500; color: $text-main; }
.media__count { font-size: $font-caption; color: $text-muted; }

.media__grid { display: flex; flex-wrap: wrap; }
.media__item { position: relative; box-sizing: border-box; width: 218rpx; height: 218rpx; margin: 0 $space-sm $space-sm 0; border: 1px solid $border; border-radius: $radius; overflow: hidden; background: $bg-surface; }
.media__item:nth-child(3n) { margin-right: 0; }
.media__thumb { display: block; width: 100%; height: 100%; }

.media__add { display: flex; flex-direction: column; align-items: center; justify-content: center; border-style: dashed; border-color: $text-disabled; }
.media__add-icon { font-size: $font-metric; line-height: 1; color: $brand; }
.media__add-text { margin-top: $space-xs; font-size: $font-caption; color: $text-muted; }

.media__remove { position: absolute; top: 0; right: 0; z-index: 3; display: flex; align-items: center; justify-content: center; width: 44rpx; height: 44rpx; border-bottom-left-radius: $radius; background: rgba(31, 42, 38, 0.62); font-size: $font-base; color: $text-inverse; }

.media__video { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; background: $text-main; color: $text-inverse; }
.media__video-icon { font-size: $font-title; }
.media__video-time { margin-top: $space-xs; font-size: $font-caption; }

.media__mask { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(31, 42, 38, 0.58); color: $text-inverse; }
.media__mask--failed { background: rgba(194, 63, 69, 0.82); }
.media__mask-text { font-size: $font-base; }
.media__mask-hint { margin-top: $space-xs; font-size: $font-caption; }
.media__bar { width: 68%; height: 6rpx; margin-top: $space-xs; border-radius: 3rpx; overflow: hidden; background: rgba(255, 255, 255, 0.38); }
.media__bar-fill { height: 100%; background: $text-inverse; }
.media__badge { position: absolute; top: 8rpx; left: 8rpx; z-index: 2; display: flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border-radius: 18rpx; background: $success; font-size: $font-caption; color: $text-inverse; }

.upload { margin-top: $space-xs; }
.upload__head { display: flex; align-items: baseline; justify-content: space-between; }
.upload__summary { font-size: $font-caption; color: $text-muted; }
.upload__retry { font-size: $font-caption; color: $brand; }
.upload__bar { height: 8rpx; margin-top: $space-xs; border-radius: 4rpx; overflow: hidden; background: $divider; }
.upload__bar-fill { height: 100%; background: $brand; }

.media__error { display: block; margin-top: $space-xs; font-size: $font-caption; color: $danger; }
.media__tip { display: block; margin-top: $space-xs; font-size: $font-caption; color: $text-muted; line-height: $line-height; }

.tags { margin-top: $space-lg; }
.tags__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: $space-sm; }
.tags__label { font-size: $font-base; font-weight: 500; color: $text-main; }
.tags__count { font-size: $font-caption; color: $text-muted; }
.tags__list { display: flex; flex-wrap: wrap; }
.tags__chip { display: flex; align-items: center; margin: 0 $space-sm $space-sm 0; padding: $space-xs $space-sm; border-radius: $radius; background: $brand-light; }
.tags__chip-text { font-size: $font-caption; color: $brand; }
.tags__chip-remove { margin-left: $space-xs; font-size: $font-base; line-height: 1; color: $brand; }
.tags__input-row { display: flex; align-items: center; }
.tags__input { flex: 1; box-sizing: border-box; height: $control-height; padding: 0 $space-md; border: 1px solid $border; border-radius: $radius; background: $bg-surface; font-size: $font-base; color: $text-main; }
.tags__add { min-height: $control-height; margin-left: $space-sm; padding: 0 $space-lg; border: 0; border-radius: $radius; background: $brand; font-size: $font-base; line-height: 1; color: $text-inverse; }
.tags__error { display: block; margin-top: $space-xs; font-size: $font-caption; color: $danger; }
.tags__tip { display: block; margin-top: $space-xs; font-size: $font-caption; color: $text-muted; }

.player { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 99; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.9); }
.player__video { width: 100%; }
.player__close { margin-top: $space-md; font-size: $font-base; color: $text-inverse; }
</style>

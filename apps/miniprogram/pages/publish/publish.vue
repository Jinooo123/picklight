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
          <view class="media__remove" @click.stop="removeMedia(item.id)">×</view>
        </view>

        <view v-if="slots > 0" class="media__item media__add" @click="pick">
          <text class="media__add-icon">+</text>
          <text class="media__add-text">{{ addText }}</text>
        </view>
      </view>

      <text v-if="hintText" class="media__error">{{ hintText }}</text>
      <text class="media__tip">{{ ruleText }}</text>
    </view>

    <view v-if="previewing" class="player" @click="closePlayer">
      <video class="player__video" :src="previewing.path" :autoplay="true" controls @click.stop />
      <text class="player__close">点击空白处关闭</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  MEDIA_LIMITS,
  chooseMedia,
  countByType,
  isUserCancel,
  planSelection,
  remainingSlots
} from '../../utils/media'

const body = ref('')
const media = ref([])
const hintText = ref('')
const previewing = ref(null)
let hintTimer = null

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
  } catch (error) {
    if (isUserCancel(error)) return
    setHint('打开相册失败，请重试')
  }
}

function removeMedia(id) {
  media.value = media.value.filter((item) => item.id !== id)
  setHint('')
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

.media__remove { position: absolute; top: 0; right: 0; display: flex; align-items: center; justify-content: center; width: 44rpx; height: 44rpx; border-bottom-left-radius: $radius; background: rgba(31, 42, 38, 0.62); font-size: $font-base; color: $text-inverse; }

.media__video { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; background: $text-main; color: $text-inverse; }
.media__video-icon { font-size: $font-title; }
.media__video-time { margin-top: $space-xs; font-size: $font-caption; }

.media__error { display: block; margin-top: $space-xs; font-size: $font-caption; color: $danger; }
.media__tip { display: block; margin-top: $space-xs; font-size: $font-caption; color: $text-muted; line-height: $line-height; }

.player { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 99; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.9); }
.player__video { width: 100%; }
.player__close { margin-top: $space-md; font-size: $font-base; color: $text-inverse; }
</style>

<template>
  <view class="page">
    <text class="title">发布动态</text>
    <textarea v-model="body" class="field area" placeholder="写点什么（最多 2000 字）" maxlength="2000" />
    <view class="row">
      <text class="hint">{{ body.length }}/2000</text>
    </view>
    <button class="btn">选择图片或视频（T-201）</button>
    <text class="tip">骨架页面，媒体选择与上传进度在 T-201 / T-202 实现</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const body = ref('')
</script>

<style scoped>
.page { padding: 32rpx; }
.title { font-size: 40rpx; font-weight: 600; display: block; margin-bottom: 24rpx; }
.field { background: #FFFFFF; border-radius: 16rpx; padding: 24rpx; font-size: 30rpx; width: 100%; box-sizing: border-box; }
.area { height: 300rpx; }
.row { display: flex; justify-content: flex-end; margin: 12rpx 0 24rpx; }
.hint { font-size: 24rpx; color: #8A8A8A; }
.btn { background: #147E70; color: #FFFFFF; border-radius: 16rpx; font-size: 30rpx; }
.tip { font-size: 24rpx; color: #8A8A8A; display: block; margin-top: 24rpx; }
</style>

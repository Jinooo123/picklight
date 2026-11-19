<template>
  <view class="page">
    <text class="title">动态详情</text>
    <text class="meta">动态编号：{{ id }}</text>
    <view class="card"><text class="card-desc">正文、媒体、评分与评论区在此实现（T-304 / T-305 / T-306）</text></view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const id = ref('')
onLoad((options) => { id.value = options && options.id ? options.id : '' })
</script>

<style scoped>
.page { padding: 32rpx; }
.title { font-size: 40rpx; font-weight: 600; display: block; }
.meta { font-size: 26rpx; color: #526761; display: block; margin: 16rpx 0 24rpx; }
.card { background: #FFFFFF; border-radius: 16rpx; padding: 32rpx; }
.card-desc { font-size: 28rpx; color: #526761; }
</style>

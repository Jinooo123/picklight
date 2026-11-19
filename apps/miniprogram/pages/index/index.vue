<template>
  <view class="page">
    <view class="hero">
      <text class="title">拾光圈</text>
      <text class="subtitle">骨架已就绪，首页信息流待实现（T-301）</text>
    </view>
    <view class="card" @click="goDetail">
      <text class="card-title">样例动态</text>
      <text class="card-desc">点击进入详情页，验证路由是否打通</text>
    </view>
    <button class="btn" @click="goLogin">去登录（验证路由）</button>
  </view>
</template>

<script setup>
function goDetail() {
  uni.navigateTo({ url: '/pages/detail/detail?id=1' })
}
function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}
</script>

<style scoped>
.page { padding: 32rpx; }
.hero { padding: 40rpx 0 32rpx; }
.title { font-size: 56rpx; font-weight: 600; color: #147E70; display: block; }
.subtitle { font-size: 26rpx; color: #526761; margin-top: 12rpx; display: block; }
.card { background: #FFFFFF; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.card-title { font-size: 32rpx; font-weight: 500; display: block; }
.card-desc { font-size: 26rpx; color: #526761; margin-top: 8rpx; display: block; }
.btn { background: #147E70; color: #FFFFFF; border-radius: 16rpx; font-size: 30rpx; }
</style>

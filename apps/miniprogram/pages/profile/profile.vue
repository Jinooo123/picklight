<template>
  <view class="page">
    <view class="header">
      <view class="avatar">{{ initial }}</view>
      <view>
        <text class="name">{{ user.username || '未登录' }}</text>
        <text class="role">{{ user.role || '游客' }}</text>
      </view>
    </view>
    <view class="cell" @click="todo('我的动态（T-205）')">我的动态</view>
    <view class="cell" @click="todo('修改密码（T-106）')">修改密码</view>
    <view class="cell" @click="todo('退出登录（T-105）')">退出登录</view>
  </view>
</template>

<script setup>
import { computed, reactive } from 'vue'

const user = reactive({ username: '', role: '' })
const initial = computed(() => (user.username ? user.username.slice(0, 1) : '拾'))

function todo(name) {
  uni.showToast({ title: name + ' 待实现', icon: 'none' })
}
</script>

<style scoped>
.page { padding: 32rpx; }
.header { display: flex; align-items: center; background: #FFFFFF; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 48rpx; background: #E1F5EE; color: #147E70;
  font-size: 40rpx; text-align: center; line-height: 96rpx; margin-right: 24rpx; }
.name { font-size: 34rpx; font-weight: 500; display: block; }
.role { font-size: 26rpx; color: #8A8A8A; }
.cell { background: #FFFFFF; border-radius: 16rpx; padding: 32rpx; font-size: 30rpx; margin-bottom: 16rpx; }
</style>

<template>
  <view class="page">
    <text class="title">登录</text>
    <input v-model="form.username" class="field" placeholder="用户名" />
    <input v-model="form.password" class="field" password placeholder="密码" />
    <text v-if="error" class="error">{{ error }}</text>
    <button class="btn" :loading="loading" @click="onSubmit">登录</button>
    <text class="link" @click="goRegister">还没有账号？去注册</text>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}

async function onSubmit() {
  error.value = ''
  if (form.username.length < 3) { error.value = '用户名至少 3 位'; return }
  if (form.password.length < 8) { error.value = '密码至少 8 位'; return }
  loading.value = true
  try {
    // TODO(T-101)：接 POST /api/v1/auth/login，拿到 token 存 uni.setStorageSync('token', ...)
    uni.showToast({ title: '接口未接入', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page { padding: 48rpx 32rpx; }
.title { font-size: 44rpx; font-weight: 600; display: block; margin-bottom: 40rpx; }
.field { background: #FFFFFF; border-radius: 16rpx; padding: 28rpx; margin-bottom: 24rpx; font-size: 30rpx; }
.error { color: #C0392B; font-size: 26rpx; margin-bottom: 16rpx; display: block; }
.btn { background: #147E70; color: #FFFFFF; border-radius: 16rpx; font-size: 32rpx; margin-top: 16rpx; }
.link { color: #147E70; font-size: 26rpx; text-align: center; display: block; margin-top: 32rpx; }
</style>

<template>
  <view class="page">
    <text class="title">注册</text>
    <input v-model="form.username" class="field" placeholder="用户名（3-20 位）" />
    <input v-model="form.password" class="field" password placeholder="密码（8-25 位）" />
    <input v-model="form.confirm" class="field" password placeholder="确认密码" />
    <text v-if="error" class="error">{{ error }}</text>
    <button class="btn" :loading="loading" @click="onSubmit">注册</button>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ username: '', password: '', confirm: '' })
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  if (form.password !== form.confirm) { error.value = '两次密码不一致'; return }
  loading.value = true
  try {
    // TODO(T-102)：接 POST /api/v1/auth/register
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
</style>

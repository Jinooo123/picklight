<template>
  <div class="wrap">
    <el-card class="box">
      <h2>拾光圈 · 管理后台</h2>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="用户名">
          <el-input id="login-username" v-model="form.username" aria-label="用户名" autocomplete="username" :disabled="loading" placeholder="管理员账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input id="login-password" v-model="form.password" aria-label="密码" type="password" show-password autocomplete="current-password" :disabled="loading" placeholder="密码" />
        </el-form-item>
        <el-alert v-if="displayError" :title="displayError" type="error" :closable="false" show-icon role="alert" />
        <el-button class="btn" native-type="submit" type="primary" :loading="loading">登录</el-button>
        <el-button v-if="canRetry" class="retry" text :disabled="loading" @click="retrySession">重试验证登录状态</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authSession } from '../auth/session.js'
import { tokenStorage } from '../auth/tokenStorage.js'
import { loginDestination } from '../router/authGuard.js'

const router = useRouter()
const route = useRoute()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')
const reasons = {
  expired: '登录已失效，请重新登录',
  forbidden: '当前账号没有管理权限',
  disabled: '账号已被禁用或删除，请联系管理员',
  invalid: '无法确认账号状态，请重新登录',
  unavailable: '暂时无法验证登录状态，请稍后重试'
}
const displayError = computed(() => error.value || reasons[route.query.reason] || '')
const canRetry = computed(() => route.query.reason === 'unavailable' && tokenStorage.get())
let active = true
onBeforeUnmount(() => { active = false; form.password = '' })

function retrySession() { router.replace(loginDestination(route.query.redirect)) }

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  if (!form.username.trim() || !form.password) { error.value = '请输入用户名和密码'; return }
  loading.value = true
  try {
    await authSession.login({ username: form.username.trim(), password: form.password })
    if (active) await router.replace(loginDestination(route.query.redirect))
  } catch (cause) {
    if (active) error.value = cause.userMessage || cause.message || '登录失败，请稍后重试'
  } finally {
    form.password = ''
    loading.value = false
  }
}
</script>

<style scoped>
.wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--el-bg-color-page); padding: 16px; box-sizing: border-box; }
.box { width: 380px; }
h2 { margin: 0 0 20px; font-size: var(--el-font-size-large); font-weight: 500; color: var(--el-color-primary); }
.btn { width: 100%; margin-top: 12px; }
.retry { width: 100%; margin: 8px 0 0; }
</style>

<template>
  <div class="wrap">
    <el-card class="box">
      <h2>拾光圈 · 管理后台</h2>
      <el-form :model="form" label-position="top" @keyup.enter="onSubmit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="管理员账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="密码" />
        </el-form-item>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <el-button class="btn" type="primary" :loading="loading" @click="onSubmit">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  if (!form.username || !form.password) { error.value = '请输入用户名和密码'; return }
  loading.value = true
  try {
    // TODO(T-701)：POST /api/v1/auth/login，校验返回角色为 ADMIN 再放行
    localStorage.setItem('token', 'dev-placeholder')
    router.replace('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--el-bg-color-page); padding: 16px; box-sizing: border-box; }
.box { width: 380px; }
h2 { margin: 0 0 20px; font-size: var(--el-font-size-large); font-weight: 500; color: var(--el-color-primary); }
.btn { width: 100%; margin-top: 12px; }
</style>

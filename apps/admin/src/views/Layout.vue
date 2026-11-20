<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="brand">拾光圈</div>
      <el-menu :default-active="$route.path" router>
        <el-menu-item index="/dashboard">统计看板</el-menu-item>
        <el-menu-item index="/users">用户管理</el-menu-item>
        <el-menu-item index="/posts">内容管理</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span>{{ $route.meta.title || '' }}</span>
        <el-button link type="primary" @click="logout">退出</el-button>
      </el-header>
      <el-main><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function logout() {
  localStorage.removeItem('token')
  router.replace('/login')
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: var(--el-bg-color); border-right: 1px solid var(--el-border-color-lighter); }
.brand { height: 56px; line-height: 56px; padding-left: 20px; font-size: var(--el-font-size-medium); font-weight: 500; color: var(--el-color-primary); }
.header { display: flex; align-items: center; justify-content: space-between; background: var(--el-bg-color); border-bottom: 1px solid var(--el-border-color-lighter); }
</style>

<template>
  <div>
    <el-card>
      <el-form inline>
        <el-form-item label="用户名"><el-input v-model="query.username" placeholder="模糊查询" clearable /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="正常" value="ACTIVE" />
            <el-option label="已禁用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-button type="primary">查询</el-button>
      </el-form>
      <el-table :data="rows" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="createdAt" label="注册时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default>—</template>
        </el-table-column>
      </el-table>
    </el-card>
    <p class="tip">骨架占位：接 T-408 的 /admin/users，禁用/恢复在 T-703 实现。</p>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
const query = reactive({ username: '', status: '' })
const rows = ref([])
</script>

<style scoped>
.tip { font-size: 13px; color: #8A8A8A; }
</style>

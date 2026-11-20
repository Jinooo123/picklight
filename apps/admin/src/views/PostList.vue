<template>
  <div>
    <el-card>
      <el-form inline>
        <el-form-item label="作者"><el-input v-model="query.author" placeholder="用户名" clearable /></el-form-item>
        <el-form-item label="标签"><el-input v-model="query.tag" placeholder="标签名" clearable /></el-form-item>
        <el-button type="primary">查询</el-button>
      </el-form>
      <el-table :data="rows" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="author" label="作者" width="140" />
        <el-table-column prop="body" label="正文" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="createdAt" label="发布时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default>—</template>
        </el-table-column>
      </el-table>
    </el-card>
    <p class="tip">骨架占位：接 T-603 的 /admin/posts，下架与删评论在 T-704 实现。</p>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
const query = reactive({ author: '', tag: '' })
const rows = ref([])
</script>

<style scoped>
.tip { font-size: var(--el-font-size-small); color: var(--el-text-color-secondary); }
</style>

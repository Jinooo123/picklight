<template>
  <div>
    <el-row :gutter="16">
      <el-col v-for="item in cards" :key="item.label" :span="6">
        <el-card><div class="label">{{ item.label }}</div><div class="value">{{ item.value }}</div></el-card>
      </el-col>
    </el-row>
    <el-card class="chart">
      <div ref="chartRef" style="height: 320px"></div>
    </el-card>
    <p class="tip">骨架占位：数据接 T-606 的 /admin/stats/overview 与 /admin/stats/daily，图表在 T-705 实现。</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const cards = [
  { label: '总用户数', value: '—' },
  { label: '总动态数', value: '—' },
  { label: '近 7 日新增', value: '—' },
  { label: '今日活跃', value: '—' }
]
const chartRef = ref(null)

onMounted(() => {
  // TODO(T-705)：引入 echarts 初始化折线图，数据来自 /admin/stats/daily
})
</script>

<style scoped>
.label { font-size: var(--el-font-size-small); color: var(--el-text-color-secondary); }
.value { font-size: 28px; font-weight: 500; margin-top: 8px; }
.chart { margin-top: 16px; }
.tip { font-size: var(--el-font-size-small); color: var(--el-text-color-secondary); }
</style>

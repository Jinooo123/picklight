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
    <el-card class="metrics-note">
      <h3>统计口径</h3>
      <p>按北京时间自然日统计，近 7 日包含今天，今日数据尚未结束。</p>
      <p>活跃用户：当日成功登录、发布、评论或评分的普通用户，按用户去重；排除管理员。近 7 日活跃按整个区间去重，不累加每日活跃数。</p>
      <p>累计注册用户包含后来禁用、逻辑删除的普通用户；累计发布动态包含后来下架、删除的动态。编辑、恢复和删除不计为新增。</p>
      <p>活跃事件可能延迟或漏记；接入接口后显示服务端统计时间。当前数据尚未接入，「—」表示待加载。</p>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const cards = [
  // 字段与口径见 docs/08-api-contract.md；T-705 接入接口后替换占位值。
  { label: '累计注册用户', value: '—' },
  { label: '累计发布动态', value: '—' },
  { label: '近 7 日新增用户', value: '—' },
  { label: '今日活跃用户', value: '—' }
]
const chartRef = ref(null)

onMounted(() => {
  // TODO(T-705)：引入 echarts 初始化折线图，数据来自 /admin/stats/daily
})
</script>

<style scoped>
.label { font-size: 13px; color: #526761; }
.value { font-size: 28px; font-weight: 500; margin-top: 8px; }
.chart { margin-top: 16px; }
.tip { font-size: 13px; color: #8A8A8A; }
.metrics-note { margin-top: 16px; font-size: 13px; color: #526761; line-height: 1.7; }
.metrics-note h3 { margin: 0 0 8px; font-size: 14px; }
.metrics-note p { margin: 6px 0; }
</style>

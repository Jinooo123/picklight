<template>
  <view class="pl-loading" :class="`pl-loading--${size}`" role="status" :aria-label="text || undefined">
    <view class="pl-loading__spinner" aria-hidden="true" />
    <text v-if="text" class="pl-loading__text">{{ text }}</text>
  </view>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
  size: { type: String, default: 'default', validator: (value) => ['small', 'default'].includes(value) }
})
</script>

<style lang="scss" scoped>
.pl-loading { display: flex; align-items: center; justify-content: center; padding: $space-xl $space-lg; line-height: $line-height; }
.pl-loading__spinner { box-sizing: border-box; flex-shrink: 0; width: $space-lg; height: $space-lg; border: 4rpx solid $brand-light; border-top-color: $brand; border-radius: 50%; animation: pl-spin 0.8s linear infinite; }
.pl-loading__text { margin-left: $space-sm; color: $text-muted; font-size: $font-base; }
.pl-loading--small { padding: $space-sm; }
.pl-loading--small .pl-loading__spinner { width: $space-md; height: $space-md; }
.pl-loading--small .pl-loading__text { font-size: $font-caption; }
@keyframes pl-spin { to { transform: rotate(360deg); } }
</style>

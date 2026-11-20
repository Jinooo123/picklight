<template>
  <view class="pl-empty" :class="`pl-empty--${size}`">
    <view v-if="icon || $slots.icon" class="pl-empty__icon" aria-hidden="true"><slot name="icon">{{ icon }}</slot></view>
    <text v-if="title" class="pl-empty__title">{{ title }}</text>
    <text v-if="description" class="pl-empty__description">{{ description }}</text>
    <view v-if="$slots.default" class="pl-empty__action"><slot /></view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: '○' },
  size: { type: String, default: 'default', validator: (value) => ['small', 'default'].includes(value) }
})
</script>

<style lang="scss" scoped>
.pl-empty { padding: $space-xxl $space-lg; text-align: center; line-height: $line-height; }
.pl-empty__icon { margin-bottom: $space-sm; color: $text-muted; font-size: $font-metric; }
.pl-empty__title { display: block; color: $text-main; font-size: $font-body; font-weight: 500; }
.pl-empty__description { display: block; margin-top: $space-xs; color: $text-muted; font-size: $font-base; white-space: pre-wrap; word-break: break-word; }
.pl-empty__action { margin-top: $space-lg; }
.pl-empty--small { padding: $space-lg $space-md; }
.pl-empty--small .pl-empty__icon { font-size: $font-title; }
</style>

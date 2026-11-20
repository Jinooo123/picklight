<template>
  <view class="pl-card">
    <view v-if="$slots.header" class="pl-card__header"><slot name="header" /></view>
    <view class="pl-card__body"><slot /></view>
    <view v-if="$slots.footer" class="pl-card__footer"><slot name="footer" /></view>
  </view>
</template>

<style lang="scss" scoped>
.pl-card {
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $radius;
  background: $bg-surface;
  color: $text-main;
  font-size: $font-base;
  line-height: $line-height;
}
.pl-card__header { padding: $space-md $space-lg; border-bottom: 1px solid $divider; font-size: $font-body; font-weight: 500; }
.pl-card__body { padding: $space-lg; }
.pl-card__footer { padding: $space-md $space-lg; border-top: 1px solid $divider; }
</style>

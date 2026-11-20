<template>
  <PlEmpty :title="title" :description="message" :icon="icon" :size="size">
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <PlButton v-if="actionText" variant="secondary" :loading="loading" :disabled="disabled" @click="onRetry">{{ actionText }}</PlButton>
  </PlEmpty>
</template>

<script setup>
import PlButton from '../PlButton/PlButton.vue'
import PlEmpty from '../PlEmpty/PlEmpty.vue'

const props = defineProps({
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  actionText: { type: String, default: '' },
  icon: { type: String, default: '!' },
  size: { type: String, default: 'default', validator: (value) => ['small', 'default'].includes(value) },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['retry'])
function onRetry() {
  if (!props.loading && !props.disabled) emit('retry')
}
</script>

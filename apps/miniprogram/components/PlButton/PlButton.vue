<template>
  <button
    class="pl-button"
    :class="[`pl-button--${variant}`, { 'pl-button--block': block, 'pl-button--disabled': disabled || loading }]"
    :disabled="disabled || loading"
    :loading="loading"
    hover-class="pl-button--pressed"
    @click="onClick"
  ><slot /></button>
</template>

<script setup>
const props = defineProps({
  variant: { type: String, default: 'primary', validator: (value) => ['primary', 'secondary', 'danger'].includes(value) },
  block: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['click'])
function onClick(event) {
  if (!props.disabled && !props.loading) emit('click', event)
}
</script>

<style lang="scss" scoped>
.pl-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: $control-height;
  margin: 0;
  padding: $space-sm $space-lg;
  border: 1px solid transparent;
  border-radius: $radius;
  background: $brand;
  color: $text-inverse;
  font-size: $font-body;
  font-weight: 500;
  line-height: $line-height;
  vertical-align: middle;
}
.pl-button::after { border: 0; }
.pl-button--block { display: flex; width: 100%; }
.pl-button--secondary { border-color: $brand; background: $brand-light; color: $brand; }
.pl-button--danger { background: $danger; }
.pl-button--pressed { opacity: 0.85; }
.pl-button--disabled { opacity: 0.5; }
</style>

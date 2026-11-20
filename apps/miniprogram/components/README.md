# 基础组件（T-008）

色值、字号与使用规则见 [`docs/09-ui-baseline.md`](../../../docs/09-ui-baseline.md)。五个组件只呈现 UI 和事件，不请求接口、不判断登录或业务状态；业务文案由调用方传入。

| 组件 | Props | Slots / 事件 |
| --- | --- | --- |
| PlButton | variant: primary / secondary / danger；block、loading、disabled: Boolean | 默认插槽放按钮文案；click 事件；loading / disabled 时不触发 |
| PlCard | 无 | 默认内容；可选 header / footer 插槽 |
| PlEmpty | title、description、icon: String；size: default / small | icon 插槽覆盖图标；默认插槽放引导操作 |
| PlLoading | text: String；size: default / small | 无；文案为空时只显示加载环 |
| PlError | title、message、actionText、icon: String；size: default / small；loading、disabled: Boolean | retry 事件；icon 插槽；actionText 为空不显示操作按钮 |

## 最小使用示例

```vue
<template>
  <PlCard>
    <template #header>我的动态</template>
    <PlLoading v-if="loading" text="正在加载动态" />
    <PlError v-else-if="error" title="加载失败" :message="error" action-text="重试" @retry="load" />
    <PlEmpty v-else-if="!items.length" title="暂无动态" description="发布后会显示在这里">
      <PlButton @click="publish">去发布</PlButton>
    </PlEmpty>
    <view v-else v-for="item in items" :key="item.id">{{ item.body }}</view>
  </PlCard>
</template>

<script setup>
import { ref } from 'vue'
import PlButton from './PlButton/PlButton.vue'
import PlCard from './PlCard/PlCard.vue'
import PlEmpty from './PlEmpty/PlEmpty.vue'
import PlLoading from './PlLoading/PlLoading.vue'
import PlError from './PlError/PlError.vue'

const props = defineProps({ fetchItems: { type: Function, required: true } })
const emit = defineEmits(['publish'])
const items = ref([])
const loading = ref(false)
const error = ref('')
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try { items.value = await props.fetchItems() }
  catch (cause) { error.value = cause.userMessage || '加载失败，请稍后重试' }
  finally { loading.value = false }
}
function publish() { emit('publish') }
load()
</script>
```

上例按当前文件所在目录写相对路径；从 `pages/xxx/xxx.vue` 引入时使用 `../../components/PlButton/PlButton.vue` 等路径。`fetchItems` 由业务层提供，负责处理 API 的实际分页字段。切换四态时保持原筛选条件，重试由页面控制，不由组件自动发送请求。

## 与 T-107 的衔接

T-008 提供五个基础组件与公共样式。T-107（潘宇）负责在至少三个真实业务页面复用空状态、加载、错误组件，补充页面联调记录；本次未改动其业务页面或公共路由配置。

uni-app 编译会把 `uni.scss` 的变量注入 `lang="scss"` 样式。微信目标编译与浏览器交互验证均已通过，记录见 [`T-008 验证记录`](../../../docs/test/T-008-视觉与组件基线.md)。微信平台预览按小程序 README 的 HBuilderX 步骤运行，选择需要展示状态的业务页面；props 传入上述示例值即可。编译与浏览器测试不替代微信开发者工具中的原生运行验证。

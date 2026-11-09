import { defineAsyncComponent, defineComponent, h } from 'vue'
import ModalLoadingState from './ModalLoadingState.vue'

export function defineAsyncModal(loader) {
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      const AsyncModal = defineAsyncComponent({
        loader,
        suspensible: false,
        delay: 0,
        timeout: 15000,
        loadingComponent: ModalLoadingState,
        // Vue 的错误回退只接收 error，需显式保留打开状态和关闭事件。
        errorComponent: defineComponent({
          props: { error: Error },
          setup: props => () => h(ModalLoadingState, { ...attrs, error: props.error }),
        }),
      })
      return () => h(AsyncModal, attrs)
    },
  })
}

import { defineAsyncComponent } from 'vue'
import ModalLoadingState from './ModalLoadingState.vue'

export function defineAsyncModal(loader) {
  return defineAsyncComponent({
    loader,
    suspensible: false,
    delay: 120,
    timeout: 15000,
    loadingComponent: ModalLoadingState,
    errorComponent: ModalLoadingState,
  })
}

import { ref } from 'vue'
import { trackViewModeChange } from '@/utils/common/analytics'
import { STORAGE_KEYS } from '@/utils/config/constants'

function getDefaultViewMode() {
  const stored = localStorage.getItem(STORAGE_KEYS.VIEW_MODE)
  if (stored === 'list' || stored === 'grid')
    return stored
  return 'grid'
}

const viewMode = ref(getDefaultViewMode())

export function useViewMode() {
  const setViewMode = (mode) => {
    const nextMode = mode === 'list' ? 'list' : 'grid'
    const oldMode = viewMode.value
    viewMode.value = nextMode
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, nextMode)

    if (oldMode !== nextMode) {
      trackViewModeChange(nextMode)
    }
  }

  return {
    viewMode,
    setViewMode,
  }
}

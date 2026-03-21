import { computed, ref, watch } from 'vue'
import { getDisplayFilename } from '@/utils/common/format'

export function useSearchSuggestions({ modelValue, wallpapers }) {
  const isFocused = ref(false)
  const localValue = ref(modelValue.value)
  const selectedIndex = ref(-1)
  const showSuggestions = ref(false)
  const suppressNextSuggestionOpen = ref(false)
  const suggestionsPosition = ref({ top: 0, left: 0, width: 0 })

  const suggestions = computed(() => {
    if (!localValue.value || !wallpapers.value.length) {
      return []
    }

    const query = localValue.value.toLowerCase()
    return wallpapers.value
      .filter((wallpaper) => {
        const displayLabel = wallpaper.displayTitle || getDisplayFilename(wallpaper.filename)
        return [
          wallpaper.filename?.toLowerCase() || '',
          displayLabel.toLowerCase(),
        ].some(text => text.includes(query))
      })
      .slice(0, 6)
      .map((wallpaper) => {
        const label = wallpaper.displayTitle || getDisplayFilename(wallpaper.filename)
        return {
          exactValue: wallpaper.filename,
          label,
          value: label,
        }
      })
  })

  const shouldShowSuggestions = computed(() => {
    return showSuggestions.value && isFocused.value && suggestions.value.length > 0
  })

  watch(() => modelValue.value, (val) => {
    localValue.value = val
  })

  watch(localValue, () => {
    if (suppressNextSuggestionOpen.value) {
      suppressNextSuggestionOpen.value = false
      showSuggestions.value = false
      selectedIndex.value = -1
      return
    }

    showSuggestions.value = Boolean(localValue.value) && isFocused.value
    selectedIndex.value = -1
  })

  function hideSuggestions() {
    showSuggestions.value = false
    selectedIndex.value = -1
  }

  function suppressSuggestionsOnce() {
    suppressNextSuggestionOpen.value = true
  }

  function markFocused(focused) {
    isFocused.value = focused
  }

  function selectNextSuggestion() {
    selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
  }

  function selectPreviousSuggestion() {
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  }

  function updateSuggestionsPosition(searchBarEl) {
    if (!searchBarEl)
      return

    const rect = searchBarEl.getBoundingClientRect()
    suggestionsPosition.value = {
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    }
  }

  return {
    hideSuggestions,
    isFocused,
    localValue,
    markFocused,
    selectedIndex,
    selectNextSuggestion,
    selectPreviousSuggestion,
    suppressSuggestionsOnce,
    shouldShowSuggestions,
    showSuggestions,
    suggestions,
    suggestionsPosition,
    updateSuggestionsPosition,
  }
}

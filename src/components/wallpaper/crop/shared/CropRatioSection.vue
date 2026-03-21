<script setup>
defineProps({
  ratioPresets: {
    type: Array,
    default: () => [],
  },
  selectedRatio: {
    type: String,
    default: 'auto',
  },
  showCustomInput: {
    type: Boolean,
    default: false,
  },
  customWidth: {
    type: [String, Number],
    default: '',
  },
  customHeight: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits([
  'applyCustom',
  'selectRatio',
  'toggleCustom',
  'update:customHeight',
  'update:customWidth',
])

function handleWidthInput(event) {
  emit('update:customWidth', event.target.value)
}

function handleHeightInput(event) {
  emit('update:customHeight', event.target.value)
}
</script>

<template>
  <div class="panel-section">
    <h3 class="section-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      比例预设
    </h3>
    <div class="ratio-grid">
      <button
        v-for="preset in ratioPresets"
        :key="preset.id"
        class="ratio-btn"
        :class="{
          'ratio-btn--active': selectedRatio === preset.id,
          'ratio-btn--highlight': preset.highlight,
        }"
        @click="emit('selectRatio', preset.id)"
      >
        <span class="ratio-name">{{ preset.name }}</span>
        <span class="ratio-desc">{{ preset.description }}</span>
      </button>
    </div>

    <button
      class="custom-toggle"
      :class="{ 'custom-toggle--active': showCustomInput }"
      @click="emit('toggleCustom')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span>自定义比例</span>
    </button>

    <Transition name="slide-fade">
      <div v-if="showCustomInput" class="custom-input-card">
        <div class="custom-inputs">
          <input
            :value="customWidth"
            type="number"
            placeholder="宽"
            min="1"
            @input="handleWidthInput"
            @keyup.enter="emit('applyCustom')"
          >
          <span class="input-divider">:</span>
          <input
            :value="customHeight"
            type="number"
            placeholder="高"
            min="1"
            @input="handleHeightInput"
            @keyup.enter="emit('applyCustom')"
          >
          <button class="apply-btn" @click="emit('applyCustom')">
            应用
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;

  svg {
    width: 13px;
    height: 13px;
    color: #667eea;
  }
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &--active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
    border-color: rgba(102, 126, 234, 0.4);
    box-shadow: 0 0 12px rgba(102, 126, 234, 0.15);

    .ratio-name {
      color: #667eea;
    }

    .ratio-desc {
      color: rgba(102, 126, 234, 0.8);
    }
  }

  &--highlight {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
    border-color: rgba(102, 126, 234, 0.2);
    padding: 10px 12px;

    &.ratio-btn--active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
      border-color: rgba(102, 126, 234, 0.5);
    }

    .ratio-desc {
      color: #667eea;
      font-weight: 600;
    }
  }
}

.ratio-name {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.ratio-desc {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
}

.custom-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  svg {
    width: 12px;
    height: 12px;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &--active {
    color: #667eea;
    border-color: rgba(102, 126, 234, 0.3);

    svg {
      transform: rotate(45deg);
    }
  }
}

.custom-input-card {
  margin-top: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.custom-inputs {
  display: flex;
  align-items: center;
  gap: 6px;

  input {
    width: 50px;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    outline: none;
    text-align: center;
    transition: all 0.2s ease;

    &:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
  }
}

.input-divider {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 700;
  font-size: 12px;
}

.apply-btn {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  margin-left: auto;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
  }
}
</style>

<script setup>
defineProps({
  exactOutputEnabled: {
    type: Boolean,
    default: false,
  },
  exactOutputValid: {
    type: Boolean,
    default: true,
  },
  outputFormat: {
    type: String,
    default: 'jpeg',
  },
  outputQuality: {
    type: Number,
    default: 92,
  },
  outputHeight: {
    type: [String, Number],
    default: '',
  },
  outputWidth: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits([
  'update:exactOutputEnabled',
  'update:outputFormat',
  'update:outputQuality',
  'update:outputHeight',
  'update:outputWidth',
])

const formatOptions = [
  { value: 'jpeg', label: 'JPG', hint: '兼顾体积与画质' },
  { value: 'png', label: 'PNG', hint: '无损，适合纯净边缘' },
  { value: 'webp', label: 'WebP', hint: '更轻，适合网页使用' },
]

function handleExactToggle(event) {
  emit('update:exactOutputEnabled', event.target.checked)
}

function handleFormatChange(format) {
  emit('update:outputFormat', format)
}

function handleQualityChange(event) {
  emit('update:outputQuality', Number.parseInt(event.target.value, 10))
}

function handleWidthInput(event) {
  emit('update:outputWidth', event.target.value)
}

function handleHeightInput(event) {
  emit('update:outputHeight', event.target.value)
}
</script>

<template>
  <div class="panel-section panel-section--output">
    <h3 class="section-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      输出选项
    </h3>

    <div class="format-group">
      <button
        v-for="option in formatOptions"
        :key="option.value"
        class="format-chip"
        :class="{ 'format-chip--active': outputFormat === option.value }"
        @click="handleFormatChange(option.value)"
      >
        <span class="format-chip__label">{{ option.label }}</span>
        <span class="format-chip__hint">{{ option.hint }}</span>
      </button>
    </div>

    <div v-if="outputFormat !== 'png'" class="quality-group">
      <div class="quality-header">
        <span class="quality-label">导出质量</span>
        <span class="quality-value">{{ outputQuality }}%</span>
      </div>
      <input
        class="quality-range"
        type="range"
        min="60"
        max="100"
        step="1"
        :value="outputQuality"
        @input="handleQualityChange"
      >
      <div class="quality-scale">
        <span>小体积</span>
        <span>高画质</span>
      </div>
    </div>

    <label class="option-toggle option-toggle--exact">
      <input :checked="exactOutputEnabled" type="checkbox" @change="handleExactToggle">
      <span class="toggle-track">
        <span class="toggle-thumb" />
      </span>
      <span class="toggle-label">
        <span class="label-text">精确输出尺寸</span>
        <span class="label-hint">导出固定宽高，适合指定屏幕或设备</span>
      </span>
    </label>

    <div v-if="exactOutputEnabled" class="exact-size-card" :class="{ 'exact-size-card--invalid': !exactOutputValid }">
      <div class="exact-size-inputs">
        <label class="size-field">
          <span>宽度</span>
          <input :value="outputWidth" type="number" min="1" placeholder="1920" @input="handleWidthInput">
        </label>
        <label class="size-field">
          <span>高度</span>
          <input :value="outputHeight" type="number" min="1" placeholder="1080" @input="handleHeightInput">
        </label>
      </div>
      <p class="exact-size-hint" :class="{ 'exact-size-hint--error': !exactOutputValid }">
        {{ exactOutputValid ? '会按你填写的尺寸精确导出，并自动同步裁剪比例' : '请输入有效的宽度和高度' }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  &--output {
    padding: 14px 16px 16px;
  }
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
    color: var(--color-accent);
  }
}

.format-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.format-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 11px;
  text-align: left;
  background: var(--crop-control-surface);
  border: 1px solid var(--crop-control-border);
  border-radius: 10px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--crop-control-surface-hover);
    border-color: var(--crop-control-border-hover);
  }

  &--active {
    background: var(--accent-gradient-soft);
    border-color: var(--accent-border-strong);
    box-shadow: 0 0 0 1px var(--accent-ring) inset;

    .format-chip__label {
      color: var(--accent-contrast-soft);
    }

    .format-chip__hint {
      color: rgba(var(--color-accent-rgb), 0.92);
    }
  }
}

.format-chip__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--crop-control-text);
}

.format-chip__hint {
  font-size: 9px;
  line-height: 1.5;
  color: var(--crop-control-hint);
}

.quality-group {
  padding: 10px 12px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}

.quality-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.quality-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.quality-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-contrast-soft);
  font-family: 'SF Mono', Monaco, monospace;
}

.quality-range {
  width: 100%;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  outline: none;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid var(--color-accent);
    box-shadow: 0 2px 8px var(--accent-shadow);
    cursor: pointer;
  }
}

.quality-scale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}

.option-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  &--exact {
    margin-bottom: 10px;
  }

  input {
    display: none;

    &:checked + .toggle-track {
      background: var(--accent-gradient);

      .toggle-thumb {
        transform: translateX(14px);
      }
    }
  }
}

.exact-size-card {
  padding: 10px 12px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;

  &--invalid {
    border-color: rgba(248, 113, 113, 0.34);
    box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.08) inset;
  }
}

.exact-size-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.size-field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  span {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.46);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  input {
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: rgba(0, 0, 0, 0.24);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    outline: none;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &:focus {
      border-color: var(--accent-border-strong);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
  }
}

.exact-size-hint {
  margin: 8px 0 0;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);

  &--error {
    color: rgba(248, 113, 113, 0.9);
  }
}

.toggle-track {
  position: relative;
  width: 34px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  transition: background 0.25s ease;
  flex-shrink: 0;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label-text {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.label-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}
</style>

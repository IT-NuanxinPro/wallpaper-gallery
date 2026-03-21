<script setup>
defineProps({
  outputOriginal: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:outputOriginal'])

function handleChange(event) {
  emit('update:outputOriginal', event.target.checked)
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
    <label class="option-toggle">
      <input :checked="outputOriginal" type="checkbox" @change="handleChange">
      <span class="toggle-track">
        <span class="toggle-thumb" />
      </span>
      <span class="toggle-label">
        <span class="label-text">超高分辨率</span>
        <span class="label-hint">最大 16K，适合大屏显示器</span>
      </span>
    </label>
  </div>
</template>

<style lang="scss" scoped>
.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;

  &--output {
    padding: 12px 16px;
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
    color: #667eea;
  }
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

  input {
    display: none;

    &:checked + .toggle-track {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      .toggle-thumb {
        transform: translateX(14px);
      }
    }
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

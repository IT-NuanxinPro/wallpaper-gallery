<script setup>
defineProps({
  imageLoaded: {
    type: Boolean,
    default: false,
  },
  imageSrc: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['load', 'error'])
</script>

<template>
  <div class="desktop-image-stage">
    <div class="desktop-image-stage__surface">
      <div class="desktop-image-stage__frame">
        <div v-if="!imageLoaded" class="desktop-image-stage__loading">
          <slot name="loading" />
        </div>

        <img
          :src="imageSrc"
          alt="壁纸预览"
          class="desktop-image-stage__image"
          :class="{ 'is-loaded': imageLoaded }"
          @load="emit('load', $event)"
          @error="emit('error')"
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.desktop-image-stage {
  width: 100%;
  max-width: 860px;

  &__surface {
    position: relative;
    padding: 0;
    border-radius: 36px;
    background: transparent;
    overflow: visible;
  }

  &__frame {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: 30px;
    background: transparent;
    box-shadow:
      0 22px 42px rgba(2, 8, 23, 0.28),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }

  &__loading {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(180deg, rgba(8, 15, 30, 0.74), rgba(6, 11, 22, 0.68)),
      radial-gradient(circle at top, rgba(59, 130, 246, 0.16), transparent 52%);
    backdrop-filter: blur(12px);
  }

  &__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.28s ease;

    &.is-loaded {
      opacity: 1;
    }
  }
}
</style>

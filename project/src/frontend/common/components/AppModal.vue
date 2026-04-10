<template>
  <div v-if="modelValue" class="app-modal-overlay" @click="closeOnOverlay ? close() : null">
    <div class="app-modal" @click.stop>
      <div
        v-if="$slots.header || title"
        class="app-modal-header"
        style="
          padding: 16px;
          border-bottom: 1px solid var(--app-border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <slot name="header">
          <h2 style="margin: 0; font-size: 1.25rem">{{ title }}</h2>
          <button
            @click="close"
            style="
              background: none;
              border: none;
              font-size: 1.5rem;
              cursor: pointer;
              color: var(--app-text-color);
            "
          >
            &times;
          </button>
        </slot>
      </div>
      <div class="app-modal-body">
        <slot></slot>
      </div>
      <div
        v-if="$slots.footer"
        class="app-modal-footer"
        style="
          padding: 16px;
          border-top: 1px solid var(--app-border-color);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        "
      >
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  closeOnOverlay: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}
</script>

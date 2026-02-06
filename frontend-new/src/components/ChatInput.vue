<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const inputText = ref('')

function handleSubmit() {
  if (!inputText.value.trim() || props.disabled) return

  const message = inputText.value
  inputText.value = ''
  emit('send', message)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="input-area">
    <textarea
      v-model="inputText"
      placeholder="Message Claude..."
      rows="1"
      :disabled="disabled"
      @keydown.enter.prevent="handleSubmit"
    />
    <button type="submit" :disabled="!inputText.trim() || disabled">
      Send
    </button>
  </form>
</template>

<style scoped>
.input-area {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #333333;
  background: #252525;
}

textarea {
  flex: 1;
  padding: 14px 18px;
  background: #2a2a2a;
  color: #e5e7eb;
  border: 2px solid transparent;
  border-radius: 16px;
  resize: none;
  font-family: inherit;
  font-size: 15px;
  outline: none;
  transition: all 150ms ease-in-out;
}

textarea::placeholder {
  color: #6b7280;
}

textarea:focus {
  border-color: #9ca3af;
  transform: scale(1.01);
}

button {
  padding: 0 28px;
  background: #6b7280;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 500;
  font-size: 15px;
  transition: all 150ms ease-in-out;
}

button:disabled {
  background: #374151;
  opacity: 0.5;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  background: #9ca3af;
}

button:not(:disabled):active {
  transform: scale(0.98);
}

button:focus-visible {
  outline: 2px solid #9ca3af;
  outline-offset: 2px;
}
</style>

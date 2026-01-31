<script setup lang="ts">
const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const input = ref('')
const textarea = ref<HTMLTextAreaElement>()

function submit() {
  if (!input.value.trim() || props.disabled) return
  emit('send', input.value.trim())
  input.value = ''
  nextTick(() => resize())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function resize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
</script>

<template>
  <div class="chat-input">
    <textarea
      ref="textarea"
      v-model="input"
      :disabled="disabled"
      placeholder="Send a message..."
      rows="1"
      @keydown="onKeydown"
      @input="resize"
    />
    <button
      :disabled="!input.trim() || disabled"
      @click="submit"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--bg-primary);
}

textarea {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

textarea:focus {
  border-color: var(--accent);
}

textarea::placeholder {
  color: var(--text-dim);
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: var(--bg-primary);
  transition: opacity 0.15s;
}

button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  opacity: 0.85;
}
</style>

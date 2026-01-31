<script setup lang="ts">
import type { ChatMessage, ToolCall } from '~/types'

const props = defineProps<{
  messages: ChatMessage[]
  activeTools: ToolCall[]
  isStreaming: boolean
}>()

const container = ref<HTMLElement>()

function scrollToBottom() {
  nextTick(() => {
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.messages[props.messages.length - 1]?.content, scrollToBottom)
watch(() => props.activeTools.length, scrollToBottom)

onMounted(scrollToBottom)
</script>

<template>
  <div ref="container" class="message-list">
    <div v-if="!messages.length" class="empty-state">
      <div class="empty-icon">~</div>
      <div class="empty-text">Start a conversation</div>
    </div>
    <ChatMessageBubble
      v-for="(msg, i) in messages"
      :key="i"
      :message="msg"
    />
    <div v-if="activeTools.length" class="active-tools">
      <ChatToolExecution
        v-for="(tool, i) in activeTools"
        :key="i"
        :tool="tool"
      />
    </div>
    <div v-if="isStreaming" class="streaming-indicator">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
}

.empty-icon {
  font-family: var(--font-mono);
  font-size: 32px;
  color: var(--accent);
  opacity: 0.4;
}

.empty-text {
  font-size: 15px;
}

.active-tools {
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.streaming-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 24px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.4;
  animation: pulse 1.4s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.4; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>

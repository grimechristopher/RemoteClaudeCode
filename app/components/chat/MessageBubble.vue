<script setup lang="ts">
import type { ChatMessage } from '~/types'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div class="message" :class="message.role">
    <div class="message-content">
      <div class="message-text">{{ message.content }}</div>
      <div v-if="message.toolCalls?.length" class="tool-calls">
        <ChatToolExecution
          v-for="(tool, i) in message.toolCalls"
          :key="i"
          :tool="tool"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  padding: 4px 24px;
}

.message.user {
  justify-content: flex-end;
}

.message-content {
  max-width: 75%;
  min-width: 0;
}

.message.user .message-content {
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 16px 16px 4px 16px;
  padding: 10px 16px;
}

.message.assistant .message-content {
  padding: 10px 0;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.message.user .message-text {
  font-size: 14px;
}

.message.assistant .message-text {
  font-size: 14px;
  color: var(--text-primary);
}

.tool-calls {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>

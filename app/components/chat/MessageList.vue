<script setup lang="ts">
import type { FeedItem } from '~/types'

const props = defineProps<{
  items: FeedItem[]
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

watch(() => props.items.length, scrollToBottom)
watch(
  () => props.items[props.items.length - 1]?.content,
  scrollToBottom,
)

onMounted(scrollToBottom)
</script>

<template>
  <div ref="container" class="feed">
    <div v-if="!items.length" class="empty-state">
      <div class="empty-icon">~</div>
      <div class="empty-text">Start a conversation</div>
    </div>
    <ChatFeedItem
      v-for="(item, i) in items"
      :key="i"
      :item="item"
      :is-active="isStreaming && item.type === 'tool_call' && i === items.length - 1"
    />
    <div v-if="isStreaming && items[items.length - 1]?.type !== 'tool_call'" class="streaming-indicator">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </div>
  </div>
</template>

<style scoped>
.feed {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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

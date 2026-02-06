<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import type { FeedItem } from '../composables/useChat'

const props = defineProps<{
  item: FeedItem
}>()

const expanded = ref(false)

const renderedMarkdown = computed(() => {
  if (props.item.type === 'text' && props.item.content) {
    return marked(props.item.content)
  }
  return ''
})
</script>

<template>
  <!-- User message -->
  <div v-if="item.type === 'user'" class="feed-item user-message">
    {{ item.content }}
  </div>

  <!-- Claude text -->
  <div
    v-else-if="item.type === 'text'"
    class="feed-item claude-message"
    v-html="renderedMarkdown"
  ></div>

  <!-- Tool call -->
  <div
    v-else-if="item.type === 'tool_call'"
    class="feed-item tool-call"
    @click="expanded = !expanded"
  >
    <div class="tool-header">
      <span class="tool-icon">
        <template v-if="item.category === 'filesystem'">📁</template>
        <template v-else-if="item.category === 'command'">▶️</template>
        <template v-else-if="item.category === 'web'">🌐</template>
        <template v-else-if="item.category === 'search'">🔍</template>
        <template v-else>⚙️</template>
      </span>
      <span class="tool-summary">{{ item.summary || item.tool }}</span>
      <span class="chevron" :class="{ open: expanded }">›</span>
    </div>
    <div v-if="expanded && item.input" class="tool-details">
      <pre>{{ JSON.stringify(item.input, null, 2) }}</pre>
    </div>
  </div>

  <!-- Tool result -->
  <div
    v-else-if="item.type === 'tool_result'"
    class="feed-item tool-result"
    @click="expanded = !expanded"
  >
    <div class="result-header">
      <span class="result-status" :class="{ error: item.isError }">
        {{ item.isError ? '✗' : '✓' }}
      </span>
      <span class="result-tool">{{ item.tool }}</span>
      <span class="chevron" :class="{ open: expanded }">›</span>
    </div>
    <div v-if="expanded && item.output" class="tool-details">
      <pre>{{ item.output }}</pre>
    </div>
  </div>

  <!-- Result meta (cost/duration) -->
  <div v-else-if="item.type === 'result'" class="feed-item result-meta">
    <span v-if="item.cost !== undefined">${{ item.cost.toFixed(4) }}</span>
    <span v-if="item.duration !== undefined"
      >{{ (item.duration / 1000).toFixed(1) }}s</span
    >
  </div>

  <!-- Error -->
  <div v-else-if="item.type === 'error'" class="feed-item error-message">
    ⚠️ {{ item.content }}
  </div>
</template>

<style scoped>
.feed-item {
  margin: 4px 0;
}

/* User message */
.user-message {
  align-self: flex-end;
  background: #2d3748;
  color: #ffffff;
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 65%;
  word-wrap: break-word;
  font-size: 15px;
  margin-left: auto;
}

/* Claude message */
.claude-message {
  align-self: flex-start;
  color: #e5e7eb;
  width: 100%;
  word-wrap: break-word;
  font-size: 15px;
  line-height: 1.7;
  padding: 4px 0;
  text-align: left;
}

/* Markdown styling within Claude messages */
.claude-message :deep(h1),
.claude-message :deep(h2),
.claude-message :deep(h3) {
  color: #f3f4f6;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.claude-message :deep(h1) {
  font-size: 1.5em;
}
.claude-message :deep(h2) {
  font-size: 1.3em;
}
.claude-message :deep(h3) {
  font-size: 1.1em;
}

.claude-message :deep(p) {
  margin: 0.75em 0;
}

.claude-message :deep(ul),
.claude-message :deep(ol) {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

.claude-message :deep(li) {
  margin: 0.25em 0;
}

.claude-message :deep(code) {
  background: #1e293b;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: #94a3b8;
}

.claude-message :deep(pre) {
  background: #1e293b;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
}

.claude-message :deep(pre code) {
  background: none;
  padding: 0;
  color: #e5e7eb;
}

.claude-message :deep(blockquote) {
  border-left: 3px solid #4b5563;
  padding-left: 1em;
  margin: 1em 0;
  color: #9ca3af;
}

.claude-message :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.claude-message :deep(a:hover) {
  text-decoration: underline;
}

.claude-message :deep(strong) {
  color: #f3f4f6;
  font-weight: 600;
}

.claude-message :deep(em) {
  font-style: italic;
}

/* Tool call */
.tool-call {
  cursor: pointer;
  max-width: 75%;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #334155;
  border-radius: 8px;
  font-size: 13px;
  color: #94a3b8;
  transition: background 150ms;
}

.tool-header:hover {
  background: #3d4a5c;
}

.tool-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tool-summary {
  flex: 1;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  font-size: 16px;
  transition: transform 150ms;
  color: #6b7280;
}

.chevron.open {
  transform: rotate(90deg);
}

/* Tool result */
.tool-result {
  cursor: pointer;
  max-width: 75%;
  margin-top: -2px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #2a3441;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
  transition: background 150ms;
}

.result-header:hover {
  background: #323d4d;
}

.result-status {
  font-size: 12px;
  color: #10b981;
}

.result-status.error {
  color: #ef4444;
}

.result-tool {
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

/* Tool details (expanded) */
.tool-details {
  margin-top: 4px;
  padding: 8px 12px;
  background: #1e293b;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.tool-details pre {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

/* Result meta */
.result-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
  padding-left: 4px;
}

/* Error */
.error-message {
  background: #2d1a1a;
  color: #ef4444;
  padding: 12px 16px;
  border-radius: 8px;
  max-width: 70%;
  font-size: 14px;
}
</style>

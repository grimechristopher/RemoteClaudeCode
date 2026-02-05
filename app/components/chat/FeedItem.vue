<script setup lang="ts">
import type { FeedItem } from '~/types'

defineProps<{
  item: FeedItem
  isActive?: boolean
}>()

const expanded = ref(false)

function formatOutput(output: string): string {
  if (output.length > 300) {
    return output.slice(0, 300) + '...'
  }
  return output
}
</script>

<template>
  <!-- User message -->
  <div v-if="item.type === 'user'" class="feed-item user-msg">
    <div class="user-bubble">{{ item.content }}</div>
  </div>

  <!-- Claude text -->
  <div v-else-if="item.type === 'text'" class="feed-item claude-text">
    <div class="claude-content">{{ item.content }}</div>
  </div>

  <!-- Tool call -->
  <div v-else-if="item.type === 'tool_call'" class="feed-item tool-item" @click="expanded = !expanded">
    <div class="tool-header">
      <span class="tool-icon">
        <template v-if="item.category === 'filesystem'">&#128196;</template>
        <template v-else-if="item.category === 'command'">&#9654;</template>
        <template v-else-if="item.category === 'web'">&#127760;</template>
        <template v-else-if="item.category === 'search'">&#128269;</template>
        <template v-else-if="item.category === 'calendar'">&#128197;</template>
        <template v-else>&#9881;</template>
      </span>
      <span class="tool-summary">{{ item.summary || item.tool }}</span>
      <span v-if="isActive" class="tool-status spinning" />
      <svg
        class="chevron"
        :class="{ open: expanded }"
        width="12" height="12"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
    <div v-if="expanded && item.input && Object.keys(item.input).length" class="tool-details">
      <div class="detail-label">Input</div>
      <pre class="detail-pre">{{ JSON.stringify(item.input, null, 2) }}</pre>
    </div>
  </div>

  <!-- Tool result -->
  <div v-else-if="item.type === 'tool_result'" class="feed-item tool-result-item" @click="expanded = !expanded">
    <div class="result-header">
      <span class="result-status" :class="{ error: item.isError }">
        {{ item.isError ? '&#10007;' : '&#10003;' }}
      </span>
      <span class="result-tool">{{ item.tool }}</span>
      <span class="result-summary">{{ item.output ? formatOutput(item.output).split('\n')[0] : '' }}</span>
      <svg
        class="chevron"
        :class="{ open: expanded }"
        width="12" height="12"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
    <div v-if="expanded && item.output" class="tool-details">
      <div class="detail-label">Output</div>
      <pre class="detail-pre">{{ item.output }}</pre>
    </div>
  </div>

  <!-- Result (cost/duration) -->
  <div v-else-if="item.type === 'result'" class="feed-item result-info">
    <span v-if="item.cost !== undefined" class="result-meta">${{ item.cost?.toFixed(4) }}</span>
    <span v-if="item.duration !== undefined" class="result-meta">{{ (item.duration! / 1000).toFixed(1) }}s</span>
  </div>

  <!-- Error -->
  <div v-else-if="item.type === 'error'" class="feed-item error-item">
    <span class="error-icon">&#9888;</span>
    <span class="error-text">{{ item.content }}</span>
  </div>
</template>

<style scoped>
.feed-item {
  padding: 0 24px;
}

/* User message */
.user-msg {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  padding-bottom: 4px;
}

.user-bubble {
  max-width: 75%;
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 16px 16px 4px 16px;
  padding: 10px 16px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

/* Claude text */
.claude-text {
  padding-top: 4px;
  padding-bottom: 4px;
}

.claude-content {
  max-width: 85%;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: var(--text-primary);
}

/* Tool call */
.tool-item {
  padding-top: 2px;
  padding-bottom: 2px;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.1s;
}

.tool-header:hover {
  background: var(--bg-elevated);
}

.tool-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.tool-summary {
  flex: 1;
  font-family: var(--font-mono);
  color: var(--accent);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-status.spinning {
  width: 10px;
  height: 10px;
  border: 2px solid var(--accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chevron {
  transition: transform 0.15s;
  flex-shrink: 0;
  color: var(--text-dim);
}

.chevron.open {
  transform: rotate(90deg);
}

/* Tool result */
.tool-result-item {
  padding-top: 1px;
  padding-bottom: 2px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-top: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-dim);
  transition: background 0.1s;
}

.result-header:hover {
  background: var(--bg-elevated);
}

.result-status {
  font-size: 11px;
  color: var(--success);
}

.result-status.error {
  color: var(--error);
}

.result-tool {
  font-family: var(--font-mono);
  color: var(--text-dim);
  font-size: 11px;
}

.result-summary {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: var(--text-dim);
  font-size: 11px;
}

/* Shared details */
.tool-details {
  margin-top: 4px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.detail-pre {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  font-family: var(--font-mono);
}

/* Result info */
.result-info {
  display: flex;
  gap: 12px;
  padding-top: 4px;
  padding-bottom: 8px;
}

.result-meta {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

/* Error */
.error-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
  color: var(--error);
  font-size: 13px;
}

.error-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.error-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

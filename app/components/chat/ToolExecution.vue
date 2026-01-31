<script setup lang="ts">
import type { ToolCall } from '~/types'

defineProps<{
  tool: ToolCall
}>()

const expanded = ref(false)
</script>

<template>
  <div class="tool-execution" @click="expanded = !expanded">
    <div class="tool-header">
      <svg
        class="chevron"
        :class="{ expanded }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span class="tool-name">{{ tool.name }}</span>
      <span v-if="tool.isError" class="tool-error">failed</span>
    </div>
    <div v-if="expanded" class="tool-details">
      <div v-if="tool.input && Object.keys(tool.input).length" class="tool-section">
        <div class="tool-label">Input</div>
        <pre>{{ JSON.stringify(tool.input, null, 2) }}</pre>
      </div>
      <div v-if="tool.output" class="tool-section">
        <div class="tool-label">Output</div>
        <pre>{{ typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-execution {
  margin: 4px 0;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  cursor: pointer;
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.chevron {
  transition: transform 0.15s;
  flex-shrink: 0;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.tool-name {
  font-family: var(--font-mono);
  color: var(--accent);
}

.tool-error {
  color: var(--error);
  font-size: 11px;
}

.tool-details {
  border-top: 1px solid var(--border);
  padding: 8px 10px;
}

.tool-section {
  margin-bottom: 8px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.tool-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

pre {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
</style>

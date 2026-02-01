<script setup lang="ts">
import type { ScheduledJob } from '~/types'

defineProps<{
  jobs: ScheduledJob[]
}>()

const emit = defineEmits<{
  edit: [job: ScheduledJob]
  toggle: [job: ScheduledJob]
  delete: [id: string]
}>()

const expandedId = ref<string | null>(null)

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}
</script>

<template>
  <div class="job-list">
    <div v-if="!jobs.length" class="empty">
      No scheduled jobs yet
    </div>
    <div
      v-for="job in jobs"
      :key="job.id"
      class="job-card"
    >
      <div class="job-row" @click="toggle(job.id)">
        <div class="job-info">
          <div class="job-name">{{ job.name }}</div>
          <div class="job-cron">{{ job.cron }}</div>
        </div>
        <div class="job-meta">
          <span
            v-if="job.lastStatus"
            class="status"
            :class="job.lastStatus"
          >
            {{ job.lastStatus }}
          </span>
          <span
            class="enabled-badge"
            :class="{ active: job.enabled }"
          >
            {{ job.enabled ? 'on' : 'off' }}
          </span>
        </div>
      </div>
      <div v-if="expandedId === job.id" class="job-details">
        <div class="detail-row">
          <span class="detail-label">Prompt</span>
          <span class="detail-value">{{ job.prompt }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last run</span>
          <span class="detail-value">{{ formatDate(job.lastRun) }}</span>
        </div>
        <div v-if="job.lastOutput" class="detail-row">
          <span class="detail-label">Last output</span>
          <pre class="detail-output">{{ job.lastOutput }}</pre>
        </div>
        <div class="detail-actions">
          <button class="btn-action" @click="emit('toggle', job)">
            {{ job.enabled ? 'Disable' : 'Enable' }}
          </button>
          <button class="btn-action" @click="emit('edit', job)">Edit</button>
          <button class="btn-action danger" @click="emit('delete', job.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.job-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty {
  text-align: center;
  padding: 48px;
  color: var(--text-dim);
}

.job-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.job-row:hover {
  background: var(--bg-elevated);
}

.job-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.job-name {
  font-size: 14px;
  font-weight: 500;
}

.job-cron {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
}

.job-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status.success {
  color: var(--success);
  background: rgba(74, 222, 128, 0.1);
}

.status.error {
  color: var(--error);
  background: rgba(248, 113, 113, 0.1);
}

.enabled-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--text-dim);
  background: var(--bg-primary);
}

.enabled-badge.active {
  color: var(--accent);
  background: var(--accent-dim);
}

.job-details {
  border-top: 1px solid var(--border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-output {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
  padding: 8px;
  border-radius: 6px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.btn-action {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.1s;
}

.btn-action:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn-action.danger:hover {
  border-color: var(--error);
  color: var(--error);
}
</style>

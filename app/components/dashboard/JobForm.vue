<script setup lang="ts">
import type { ScheduledJob } from '~/types'

const props = defineProps<{
  job?: ScheduledJob | null
}>()

const emit = defineEmits<{
  save: [data: { name: string; prompt: string; cron: string; oneOff: boolean }]
  cancel: []
}>()

const name = ref(props.job?.name || '')
const prompt = ref(props.job?.prompt || '')
const cronExpr = ref(props.job?.cron || '0 9 * * 1')
const oneOff = ref(props.job?.oneOff || false)

function submit() {
  if (!name.value.trim() || !prompt.value.trim() || !cronExpr.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    prompt: prompt.value.trim(),
    cron: cronExpr.value.trim(),
    oneOff: oneOff.value,
  })
}
</script>

<template>
  <div class="job-form">
    <div class="field">
      <label>Name</label>
      <input v-model="name" placeholder="Weekly calendar summary" />
    </div>
    <div class="field">
      <label>Prompt</label>
      <textarea v-model="prompt" rows="4" placeholder="Summarize my calendar for this week..." />
    </div>
    <div class="field">
      <label>Cron Expression</label>
      <input v-model="cronExpr" placeholder="0 9 * * 1" class="mono" />
      <div class="hint">e.g. "0 9 * * 1" = every Monday at 9am</div>
    </div>
    <div class="field-row">
      <label class="toggle">
        <input type="checkbox" v-model="oneOff" />
        <span>One-off (disable after first run)</span>
      </label>
    </div>
    <div class="actions">
      <button class="btn-cancel" @click="emit('cancel')">Cancel</button>
      <button class="btn-save" @click="submit">Save</button>
    </div>
  </div>
</template>

<style scoped>
.job-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input, textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, textarea:focus {
  border-color: var(--accent);
}

input.mono {
  font-family: var(--font-mono);
}

textarea {
  resize: vertical;
}

.hint {
  font-size: 12px;
  color: var(--text-dim);
}

.field-row {
  display: flex;
  align-items: center;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: 0;
}

.toggle input {
  accent-color: var(--accent);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.btn-cancel:hover {
  background: var(--bg-elevated);
}

.btn-save {
  background: var(--accent);
  border: none;
  color: var(--bg-primary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.btn-save:hover {
  opacity: 0.85;
}
</style>

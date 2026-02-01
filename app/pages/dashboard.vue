<script setup lang="ts">
import type { ScheduledJob } from '~/types'

const jobs = ref<ScheduledJob[]>([])
const showForm = ref(false)
const editingJob = ref<ScheduledJob | null>(null)

async function fetchJobs() {
  jobs.value = await $fetch('/api/jobs')
}

async function onSave(data: { name: string; prompt: string; cron: string; oneOff: boolean }) {
  if (editingJob.value) {
    await $fetch(`/api/jobs/${editingJob.value.id}`, {
      method: 'PUT',
      body: data,
    })
  } else {
    await $fetch('/api/jobs', {
      method: 'POST',
      body: data,
    })
  }
  showForm.value = false
  editingJob.value = null
  await fetchJobs()
}

function onEdit(job: ScheduledJob) {
  editingJob.value = job
  showForm.value = true
}

async function onToggle(job: ScheduledJob) {
  await $fetch(`/api/jobs/${job.id}`, {
    method: 'PUT',
    body: { enabled: !job.enabled },
  })
  await fetchJobs()
}

async function onDelete(id: string) {
  await $fetch(`/api/jobs/${id}`, { method: 'DELETE' })
  await fetchJobs()
}

function onCancel() {
  showForm.value = false
  editingJob.value = null
}

onMounted(fetchJobs)
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <NuxtLink to="/" class="btn-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </NuxtLink>
      <span class="header-title">Scheduled Jobs</span>
      <button class="btn-add" @click="showForm = true; editingJob = null">
        + New Job
      </button>
    </header>

    <div class="dashboard-content">
      <DashboardJobForm
        v-if="showForm"
        :job="editingJob"
        @save="onSave"
        @cancel="onCancel"
      />
      <DashboardJobList
        :jobs="jobs"
        @edit="onEdit"
        @toggle="onToggle"
        @delete="onDelete"
      />
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.btn-back:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-add {
  background: var(--accent);
  border: none;
  color: var(--bg-primary);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.btn-add:hover {
  opacity: 0.85;
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getJobs, createJob, updateJob, deleteJob, runJobNow, type Job } from '../api/jobs'

const jobs = ref<Job[]>([])
const showCreateForm = ref(false)
const newJob = ref({
  name: '',
  prompt: '',
  cron: '0 9 * * *',
  enabled: true,
})

async function loadJobs() {
  jobs.value = await getJobs()
}

async function handleCreate() {
  await createJob(newJob.value)
  showCreateForm.value = false
  newJob.value = {
    name: '',
    prompt: '',
    cron: '0 9 * * *',
    enabled: true,
  }
  await loadJobs()
}

async function handleToggle(job: Job) {
  await updateJob(job.id, { enabled: !job.enabled })
  await loadJobs()
}

async function handleDelete(id: string) {
  if (confirm('Delete this job?')) {
    await deleteJob(id)
    await loadJobs()
  }
}

async function handleRunNow(id: string) {
  await runJobNow(id)
  alert('Job triggered!')
  await loadJobs()
}

onMounted(loadJobs)
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <router-link to="/" class="back-btn">← Chat</router-link>
      <h1>Scheduled Jobs</h1>
      <button @click="showCreateForm = !showCreateForm" class="create-btn">
        + New Job
      </button>
    </header>

    <div v-if="showCreateForm" class="create-form">
      <h3>Create Scheduled Job</h3>
      <input
        v-model="newJob.name"
        placeholder="Job name"
        class="form-input"
      />
      <textarea
        v-model="newJob.prompt"
        placeholder="Prompt to send to Claude"
        rows="3"
        class="form-textarea"
      />
      <input
        v-model="newJob.cron"
        placeholder="Cron schedule (e.g., 0 9 * * *)"
        class="form-input"
      />
      <div class="form-actions">
        <button @click="showCreateForm = false">Cancel</button>
        <button @click="handleCreate" class="save-btn">Create</button>
      </div>
    </div>

    <div class="jobs-list">
      <div v-if="jobs.length === 0" class="empty-state">
        <p>No scheduled jobs yet</p>
      </div>

      <div v-for="job in jobs" :key="job.id" class="job-card">
        <div class="job-header">
          <h3>{{ job.name }}</h3>
          <div class="job-actions">
            <button
              @click="handleToggle(job)"
              class="toggle-btn"
              :class="{ active: job.enabled }"
            >
              {{ job.enabled ? 'Enabled' : 'Disabled' }}
            </button>
            <button @click="handleRunNow(job.id)" class="run-btn">
              ▶️ Run Now
            </button>
            <button @click="handleDelete(job.id)" class="delete-btn">
              🗑️
            </button>
          </div>
        </div>

        <p class="job-prompt">{{ job.prompt }}</p>

        <div class="job-meta">
          <span>Schedule: {{ job.cron }}</span>
          <span v-if="job.lastRun">
            Last run: {{ new Date(job.lastRun).toLocaleString() }}
          </span>
          <span v-if="job.nextRun">
            Next run: {{ new Date(job.nextRun).toLocaleString() }}
          </span>
          <span v-if="job.lastStatus" :class="`status-${job.lastStatus}`">
            {{ job.lastStatus }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
  background: #1a1a1a;
  color: #e5e7eb;
}

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333333;
}

.dashboard-header h1 {
  flex: 1;
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.back-btn {
  padding: 8px 16px;
  background: #252525;
  color: #9ca3af;
  text-decoration: none;
  border-radius: 8px;
  font-size: 14px;
  transition: all 150ms;
}

.back-btn:hover {
  background: #2d2d2d;
  color: #e5e7eb;
}

.create-btn {
  padding: 10px 20px;
  background: #6b7280;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms;
}

.create-btn:hover {
  background: #9ca3af;
}

.create-form {
  background: #252525;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid #333333;
}

.create-form h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px;
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  border-radius: 8px;
  color: #e5e7eb;
  font-family: inherit;
  font-size: 14px;
  margin-bottom: 12px;
  outline: none;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #6b7280;
}

.form-textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.form-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 150ms;
}

.form-actions button:first-child {
  background: transparent;
  border: 1px solid #3d3d3d;
  color: #9ca3af;
}

.form-actions button:first-child:hover {
  background: #252525;
}

.form-actions .save-btn {
  background: #6b7280;
  color: #ffffff;
}

.form-actions .save-btn:hover {
  background: #9ca3af;
}

.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #6b7280;
}

.job-card {
  background: #252525;
  border: 1px solid #333333;
  border-radius: 12px;
  padding: 20px;
  transition: border-color 150ms;
}

.job-card:hover {
  border-color: #4b5563;
}

.job-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.job-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e5e7eb;
}

.job-actions {
  display: flex;
  gap: 8px;
}

.job-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms;
}

.toggle-btn {
  background: #374151;
  color: #9ca3af;
}

.toggle-btn.active {
  background: #2d3748;
  color: #10b981;
}

.run-btn {
  background: #2d3748;
  color: #9ca3af;
}

.run-btn:hover {
  background: #374151;
}

.delete-btn {
  background: transparent;
  font-size: 16px;
  padding: 4px 8px;
}

.delete-btn:hover {
  transform: scale(1.1);
}

.job-prompt {
  color: #9ca3af;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.job-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
}

.job-meta .status-success {
  color: #10b981;
}

.job-meta .status-error {
  color: #ef4444;
}
</style>

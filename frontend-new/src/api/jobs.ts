export interface Job {
  id: string
  name: string
  prompt: string
  cron: string
  enabled: boolean
  oneOff: boolean
  lastRun: string | null
  lastStatus: 'success' | 'error' | null
  lastOutput: string | null
  nextRun: string | null
  createdAt: string
}

export async function getJobs(): Promise<Job[]> {
  const response = await fetch('/api/jobs')

  if (!response.ok) {
    throw new Error('Failed to fetch jobs')
  }

  return response.json()
}

export async function createJob(data: Partial<Job>): Promise<Job> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to create job')
  }

  return response.json()
}

export async function updateJob(id: string, data: Partial<Job>): Promise<Job> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to update job')
  }

  return response.json()
}

export async function deleteJob(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete job')
  }
}

export async function runJobNow(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/${id}/run`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Failed to run job')
  }

  await response.json()
}

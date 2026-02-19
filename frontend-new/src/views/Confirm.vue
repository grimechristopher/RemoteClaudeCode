<template>
  <div class="confirm-container">
    <div class="confirm-card">
      <div v-if="loading" class="loading">
        <div class="spinner-large"></div>
        <p>Confirming your login...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="goToLogin" class="retry-btn">Back to Login</button>
      </div>
      <div v-else class="success-state">
        <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <p>Successfully logged in!</p>
        <p class="redirect-text">Redirecting to chat...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'
import { setAuthToken } from '../utils/auth'

const router = useRouter()
const loading = ref(true)
const error = ref('')

const supabase = createClient(
  'https://supabase.chrisgrime.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2MTkxNjAwLCJleHAiOjE5MTM5NTgwMDB9.m6ZSBvlHqBJpNPSeIfnXm35vcxfYThFSQj3K4qw0tTM'
)

onMounted(async () => {
  try {
    // Get the session from the URL hash or query params
    const { data, error: authError } = await supabase.auth.getSession()

    if (authError || !data.session) {
      error.value = 'Failed to confirm login. Please try again.'
      loading.value = false
      return
    }

    // Save token
    setAuthToken(data.session.access_token)

    // Wait a moment then redirect
    setTimeout(() => {
      router.push('/')
    }, 1000)
  } catch (err) {
    error.value = 'An unexpected error occurred'
    loading.value = false
  }
})

const goToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.confirm-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  padding: 20px;
}

.confirm-card {
  background: #fff;
  padding: 60px 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.loading, .error-state, .success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner-large {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading p, .success-state p {
  color: #374151;
  font-size: 16px;
  margin: 0;
}

.redirect-text {
  color: #6b7280;
  font-size: 14px;
}

.check-icon {
  width: 64px;
  height: 64px;
  color: #10b981;
  stroke-width: 3;
}

.error-message {
  color: #ef4444;
  font-size: 16px;
  margin: 0;
}

.retry-btn {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #2563eb;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createClient } from '@supabase/supabase-js'
import { setAuthToken } from '../utils/auth'

const router = useRouter()
const email = ref('')
const loading = ref(false)
const error = ref('')
const showOtpInput = ref(false)
const otp = ref('')
const otpLoading = ref(false)

const supabase = createClient(
  'https://supabase.chrisgrime.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2MTkxNjAwLCJleHAiOjE5MTM5NTgwMDB9.m6ZSBvlHqBJpNPSeIfnXm35vcxfYThFSQj3K4qw0tTM'
)

const signInWithOtp = async () => {
  if (!email.value) return

  loading.value = true
  error.value = ''

  try {
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm`,
      }
    })

    if (authError) {
      error.value = authError.message
    } else {
      showOtpInput.value = true
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

const verifyOtp = async () => {
  if (!email.value || !otp.value) return

  otpLoading.value = true
  error.value = ''

  try {
    const { data, error: authError } = await supabase.auth.verifyOtp({
      email: email.value,
      token: otp.value,
      type: 'magiclink'
    })

    if (authError) {
      error.value = authError.message
    } else if (data.session?.access_token) {
      setAuthToken(data.session.access_token)
      router.push('/')
    }
  } catch (err) {
    error.value = 'Invalid or expired OTP'
  } finally {
    otpLoading.value = false
  }
}

const resetForm = () => {
  email.value = ''
  otp.value = ''
  showOtpInput.value = false
  error.value = ''
}

const resendEmail = async () => {
  if (!email.value) return
  await signInWithOtp()
}

const signInWithProvider = async (provider: 'github' | 'linkedin_oidc') => {
  try {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/confirm`
      }
    })

    if (authError) {
      error.value = authError.message
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Claude Chat Login</h1>
      <p class="subtitle">Sign in to access chat</p>

      <!-- Error Messages -->
      <p v-if="error" class="error">{{ error }}</p>

      <!-- Success Message for Email Sent -->
      <div v-if="showOtpInput" class="otp-notice">
        <h3 class="otp-title">Check your email for a link</h3>
        <p class="otp-subtitle">Have a verification code instead?</p>
        <p class="otp-email">
          Enter the code sent to<br>
          <span>{{ email }}</span>
        </p>
      </div>

      <!-- Email Form -->
      <form v-if="!showOtpInput" @submit.prevent="signInWithOtp" class="auth-form">
        <div class="form-group">
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Enter your email"
            required
            :disabled="loading"
          />
        </div>

        <button type="submit" class="login-btn" :disabled="!email || loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Sending email...' : 'Continue with email' }}
        </button>
      </form>

      <!-- OTP Form -->
      <form v-if="showOtpInput" @submit.prevent="verifyOtp" class="auth-form">
        <div class="form-group">
          <input
            id="otp"
            v-model="otp"
            type="text"
            maxlength="6"
            pattern="[0-9]{6}"
            placeholder="Enter verification code"
            required
            :disabled="otpLoading"
          />
        </div>

        <button type="submit" class="login-btn" :disabled="!otp || otp.length !== 6 || otpLoading">
          <span v-if="otpLoading" class="spinner"></span>
          {{ otpLoading ? 'Verifying...' : 'Verify Email Address' }}
        </button>

        <button type="button" @click="resetForm" class="secondary-btn">
          Back to Email
        </button>

        <p class="resend-text">
          Not seeing the email?
          <button type="button" @click="resendEmail" class="link-btn" :disabled="loading">
            Try sending again
          </button>
        </p>
      </form>

      <!-- Divider -->
      <div v-if="!showOtpInput" class="divider">
        <span>or continue with</span>
      </div>

      <!-- Social Login Buttons -->
      <div v-if="!showOtpInput" class="social-buttons">
        <button @click="signInWithProvider('github')" class="social-btn">
          <svg class="social-icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>Continue with GitHub</span>
        </button>

        <button @click="signInWithProvider('linkedin_oidc')" class="social-btn">
          <svg class="social-icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span>Continue with LinkedIn</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  padding: 20px;
}

.login-card {
  background: #fff;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 450px;
  width: 100%;
}

h1 {
  font-size: 28px;
  margin-bottom: 8px;
  color: #2f2f3f;
  text-align: center;
}

.subtitle {
  color: #6b7280;
  margin-bottom: 32px;
  font-size: 14px;
  text-align: center;
}

.error {
  color: #ef4444;
  font-size: 14px;
  margin-bottom: 16px;
  padding: 12px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  text-align: center;
}

.otp-notice {
  text-align: center;
  margin-bottom: 24px;
}

.otp-title {
  font-size: 18px;
  font-weight: 600;
  color: #2f2f3f;
  margin-bottom: 8px;
}

.otp-subtitle {
  font-size: 16px;
  font-weight: 500;
  color: #2f2f3f;
  margin-bottom: 8px;
}

.otp-email {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 16px;
}

.otp-email span {
  font-weight: 600;
  color: #2f2f3f;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  margin: 0;
}

input {
  width: 100%;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #2f2f3f;
  font-size: 14px;
  transition: all 0.2s;
}

input::placeholder {
  color: #9ca3af;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f3f4f6;
}

.login-btn {
  width: 100%;
  padding: 12px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn:hover:not(:disabled) {
  background: #2563eb;
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  width: 100%;
  padding: 12px 16px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: #e5e7eb;
}

.resend-text {
  text-align: center;
  color: #6b7280;
  font-size: 13px;
  margin-top: 8px;
}

.link-btn {
  background: none;
  border: none;
  color: #3b82f6;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.link-btn:hover {
  color: #2563eb;
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.divider {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e7eb;
}

.divider span {
  position: relative;
  display: inline-block;
  padding: 0 16px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
}

.social-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.social-btn {
  width: 100%;
  padding: 12px 16px;
  background: #fff;
  color: #3b82f6;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.social-btn:hover {
  background: #3b82f6;
  color: #fff;
}

.social-icon {
  width: 20px;
  height: 20px;
}
</style>

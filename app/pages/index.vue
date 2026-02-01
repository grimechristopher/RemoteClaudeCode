<script setup lang="ts">
import type { Session } from '~/types'

const { messages, isStreaming, currentSessionId, activeTools, sendMessage, loadSession, createSession } = useChat()

const drawerOpen = ref(false)
const sessions = ref<Session[]>([])

async function fetchSessions() {
  sessions.value = await $fetch('/api/sessions')
}

async function onSelectSession(id: string) {
  await loadSession(id)
  drawerOpen.value = false
}

async function onNewSession() {
  await createSession()
  await fetchSessions()
  drawerOpen.value = false
}

async function onDeleteSession(id: string) {
  await $fetch(`/api/sessions/${id}`, { method: 'DELETE' })
  if (currentSessionId.value === id) {
    currentSessionId.value = null
    messages.value = []
  }
  await fetchSessions()
}

function openDrawer() {
  fetchSessions()
  drawerOpen.value = true
}

onMounted(fetchSessions)
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="btn-menu" @click="openDrawer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="header-title">Remote Claude Code</span>
      <NuxtLink to="/dashboard" class="btn-dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </NuxtLink>
    </header>

    <ChatMessageList
      :messages="messages"
      :active-tools="activeTools"
      :is-streaming="isStreaming"
    />

    <ChatChatInput
      :disabled="isStreaming"
      @send="sendMessage"
    />

    <SessionDrawer
      :open="drawerOpen"
      :sessions="sessions"
      :active-id="currentSessionId"
      @close="drawerOpen = false"
      @select="onSelectSession"
      @create="onNewSession"
      @delete="onDeleteSession"
    />
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-menu,
.btn-dashboard {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.btn-menu:hover,
.btn-dashboard:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}
</style>

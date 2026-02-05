<script setup lang="ts">
import type { Session } from '~/types'

const {
  feedItems,
  isStreaming,
  currentSessionId,
  currentSystemPrompt,
  sendMessage,
  loadSession,
  createSession,
  updateSystemPrompt,
} = useChat()

const drawerOpen = ref(false)
const sessions = ref<Session[]>([])
const showSystemPrompt = ref(false)
const systemPromptDraft = ref('')

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
    feedItems.value = []
  }
  await fetchSessions()
}

function openDrawer() {
  fetchSessions()
  drawerOpen.value = true
}

function openSystemPrompt() {
  systemPromptDraft.value = currentSystemPrompt.value || ''
  showSystemPrompt.value = true
}

async function saveSystemPrompt() {
  await updateSystemPrompt(systemPromptDraft.value || null)
  showSystemPrompt.value = false
}

onMounted(fetchSessions)
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="btn-icon" @click="openDrawer" title="Sessions">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="header-title">Remote Claude Code</span>
      <button
        v-if="currentSessionId"
        class="btn-icon"
        :class="{ active: currentSystemPrompt }"
        @click="openSystemPrompt"
        title="System Prompt"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
      <NuxtLink to="/dashboard" class="btn-icon" title="Dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </NuxtLink>
    </header>

    <ChatMessageList
      :items="feedItems"
      :is-streaming="isStreaming"
    />

    <ChatInput
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

    <!-- System Prompt Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showSystemPrompt" class="modal-overlay" @click.self="showSystemPrompt = false">
          <div class="modal">
            <div class="modal-header">System Prompt</div>
            <textarea
              v-model="systemPromptDraft"
              class="modal-textarea"
              rows="6"
              placeholder="You are my personal assistant. You have access to my Obsidian vault at /data/notes and my Nextcloud calendar..."
            />
            <div class="modal-actions">
              <button class="btn-cancel" @click="showSystemPrompt = false">Cancel</button>
              <button class="btn-save" @click="saveSystemPrompt">Save</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 15px;
}

.btn-icon {
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
  text-decoration: none;
}

.btn-icon:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.btn-icon.active {
  border-color: var(--accent);
  color: var(--accent);
}

/* System Prompt Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  font-weight: 500;
  font-size: 15px;
}

.modal-textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.modal-textarea:focus {
  border-color: var(--accent);
}

.modal-textarea::placeholder {
  color: var(--text-dim);
}

.modal-actions {
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .chat-header {
    padding: 10px 12px;
  }

  .header-title {
    font-size: 14px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
  }
}
</style>

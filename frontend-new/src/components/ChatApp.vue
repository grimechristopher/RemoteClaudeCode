<script setup lang="ts">
import { ref } from 'vue'
import { useChat } from '../composables/useChat'
import ChatHeader from './ChatHeader.vue'
import ChatInput from './ChatInput.vue'
import FeedItem from './FeedItem.vue'
import SessionDrawer from './SessionDrawer.vue'

const {
  feedItems,
  sessionId,
  systemPrompt,
  isStreaming,
  sendUserMessage,
  loadSession,
  clearSession,
  updateSystemPrompt,
} = useChat()

const drawerOpen = ref(false)
const showSystemPromptModal = ref(false)
const systemPromptDraft = ref('')

function handleOpenDrawer() {
  drawerOpen.value = true
}

function handleOpenSystemPrompt() {
  systemPromptDraft.value = systemPrompt.value || ''
  showSystemPromptModal.value = true
}

async function handleSelectSession(id: string) {
  await loadSession(id)
  drawerOpen.value = false
}

function handleNewSession() {
  clearSession()
  drawerOpen.value = false
}

async function saveSystemPrompt() {
  await updateSystemPrompt(systemPromptDraft.value || null)
  showSystemPromptModal.value = false
}
</script>

<template>
  <div class="chat-app">
    <ChatHeader
      @open-drawer="handleOpenDrawer"
      @open-system-prompt="handleOpenSystemPrompt"
      @new-chat="handleNewSession"
    />

    <div class="feed">
      <div v-if="feedItems.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-text">Start a conversation</div>
      </div>

      <FeedItem v-for="(item, index) in feedItems" :key="index" :item="item" />

      <div v-if="isStreaming" class="streaming-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>

    <ChatInput :disabled="isStreaming" @send="sendUserMessage" />

    <SessionDrawer
      :open="drawerOpen"
      :current-session-id="sessionId"
      @close="drawerOpen = false"
      @select="handleSelectSession"
      @new-session="handleNewSession"
    />

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showSystemPromptModal"
          class="modal-overlay"
          @click.self="showSystemPromptModal = false"
        >
          <div class="modal">
            <h3>System Prompt</h3>
            <textarea
              v-model="systemPromptDraft"
              placeholder="You are a helpful assistant..."
              rows="6"
            />
            <div class="modal-actions">
              <button @click="showSystemPromptModal = false">Cancel</button>
              <button class="save-btn" @click="saveSystemPrompt">Save</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #222222;
}

.feed {
  flex: 1;
  overflow-y: auto;
  padding: 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scroll-behavior: smooth;
  align-items: flex-start;
  position: relative;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #6b7280;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.3;
}

.empty-text {
  font-size: 16px;
}

.streaming-indicator {
  display: flex;
  gap: 6px;
  padding: 8px;
  align-self: flex-start;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
  animation: pulse 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%,
  80%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* System Prompt Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: #1e1e1e;
  border: 1px solid #333333;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal h3 {
  font-size: 18px;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0;
}

.modal textarea {
  background: #252525;
  border: 1px solid #3d3d3d;
  border-radius: 8px;
  padding: 12px;
  color: #e5e7eb;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.modal textarea:focus {
  border-color: #6b7280;
}

.modal textarea::placeholder {
  color: #6b7280;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
}

.modal-actions button:first-child {
  background: transparent;
  border: 1px solid #3d3d3d;
  color: #9ca3af;
}

.modal-actions button:first-child:hover {
  background: #252525;
  color: #e5e7eb;
}

.modal-actions .save-btn {
  background: #6b7280;
  color: #ffffff;
}

.modal-actions .save-btn:hover {
  background: #9ca3af;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 200ms;
}

.modal-enter-from .modal {
  transform: scale(0.95);
}

.modal-leave-to .modal {
  transform: scale(0.95);
}
</style>

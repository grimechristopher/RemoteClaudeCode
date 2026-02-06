<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Session } from '../api/chat'
import { getSessions, deleteSession } from '../api/chat'

const props = defineProps<{
  open: boolean
  currentSessionId: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  newSession: []
}>()

const sessions = ref<Session[]>([])

async function loadSessions() {
  sessions.value = await getSessions()
}

async function handleDelete(id: string) {
  if (confirm('Delete this session?')) {
    await deleteSession(id)
    await loadSessions()
    if (id === props.currentSessionId) {
      emit('newSession')
    }
  }
}

onMounted(loadSessions)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-overlay" @click.self="emit('close')">
        <div class="drawer">
          <div class="drawer-header">
            <h2>Sessions</h2>
            <button class="close-btn" @click="emit('close')">✕</button>
          </div>

          <button class="new-session-btn" @click="emit('newSession')">
            + New Chat
          </button>

          <div class="sessions-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === currentSessionId }"
              @click="emit('select', session.id)"
            >
              <div class="session-title">{{ session.title || 'New Chat' }}</div>
              <div class="session-date">
                {{ new Date(session.createdAt).toLocaleDateString() }}
              </div>
              <button
                class="delete-btn"
                @click.stop="handleDelete(session.id)"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
}

.drawer {
  width: 320px;
  max-width: 85vw;
  background: #1e1e1e;
  border-right: 1px solid #333333;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #333333;
}

.drawer-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #e5e7eb;
}

.new-session-btn {
  margin: 16px 20px;
  padding: 12px;
  background: #2d3748;
  color: #e5e7eb;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: background 150ms;
}

.new-session-btn:hover {
  background: #374151;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.session-item {
  padding: 12px 16px;
  margin-bottom: 8px;
  background: #252525;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms;
  position: relative;
}

.session-item:hover {
  background: #2a2a2a;
  border-color: #3d3d3d;
}

.session-item.active {
  background: #2d3748;
  border-color: #4b5563;
}

.session-title {
  font-size: 14px;
  color: #e5e7eb;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 32px;
}

.session-date {
  font-size: 12px;
  color: #6b7280;
}

.delete-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  opacity: 0;
  transition: opacity 150ms;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  transform: scale(1.1);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 200ms;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(-100%);
}
</style>

<script setup lang="ts">
import type { Session } from '~/types'

const props = defineProps<{
  open: boolean
  sessions: Session[]
  activeId: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  create: []
  delete: [id: string]
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-overlay" @click.self="emit('close')">
        <div class="drawer">
          <div class="drawer-header">
            <span>Sessions</span>
            <button class="btn-new" @click="emit('create')">+ New</button>
          </div>
          <div class="drawer-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === activeId }"
              @click="emit('select', session.id)"
            >
              <div class="session-title">{{ session.title || 'New Chat' }}</div>
              <button
                class="btn-delete"
                @click.stop="emit('delete', session.id)"
              >
                &times;
              </button>
            </div>
            <div v-if="!sessions.length" class="empty">No sessions yet</div>
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
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 500;
}

.btn-new {
  background: var(--accent-dim);
  border: 1px solid rgba(34, 211, 238, 0.2);
  color: var(--accent);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.btn-new:hover {
  background: var(--accent-hover);
}

.drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.session-item:hover {
  background: var(--bg-elevated);
}

.session-item.active {
  background: var(--accent-dim);
}

.session-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 18px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.1s;
}

.session-item:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  color: var(--error);
}

.empty {
  text-align: center;
  padding: 24px;
  color: var(--text-dim);
  font-size: 13px;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.2s;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(-100%);
}
</style>

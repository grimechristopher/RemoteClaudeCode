<script setup lang="ts">
const emit = defineEmits<{
  openDrawer: []
  openSystemPrompt: []
  newChat: []
}>()
</script>

<template>
  <header class="chat-header">
    <button class="btn-icon" @click="emit('openDrawer')" title="Sessions">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <button class="btn-icon" @click="emit('newChat')" title="New Chat">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
    <span class="header-title">Command Center</span>
    <button
      class="btn-icon"
      @click="emit('openSystemPrompt')"
      title="System Prompt"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        />
      </svg>
    </button>
    <router-link to="/dashboard" class="btn-icon" title="Dashboard">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    </router-link>
  </header>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #333333;
  background: #1a1a1a;
}

.header-title {
  flex: 1;
  font-weight: 500;
  font-size: 16px;
  color: #e5e7eb;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #333333;
  background: transparent;
  color: #d1d5db;
  cursor: pointer;
  transition: all 150ms;
}

.btn-icon:hover {
  background: #252525;
  color: #e5e7eb;
  border-color: #4b5563;
}
</style>

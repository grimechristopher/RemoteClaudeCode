<script setup lang="ts">
// Router handles component rendering
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: #1a1a1a;
  color: #e5e7eb;
}

#app {
  height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 12px;
}

::-webkit-scrollbar-track {
  background: #2a2a2a;
}

::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: #505050;
}
</style>

<script setup>
import { ref } from "vue";

// Components
import TorrentList from "../components/TorrentList.vue";

const selectedTorrentId = ref(null);

function handleSelect(id) {
    selectedTorrentId.value = id;
}

function clearSelection() {
    selectedTorrentId.value = null;
}
</script>

<template>
  <div class="dashboard">

    <!-- Header -->
    <header class="header">
      <h1>Deluge Modern WebUI</h1>

      <div class="header-buttons">
        <ThemeToggle />
        <button @click="$router.push('/settings')">Preferences</button>
        <button @click="$router.push('/plugins')">Plugins</button>
        <AddTorrent />
      </div>
    </header>

    <!-- Global Controls -->
    <GlobalControls />

    <div class="main">
      <!-- Torrent List -->
      <div class="left">
        <TorrentList @select="handleSelect" />
      </div>

      <!-- Torrent Details -->
      <div class="right" v-if="selectedTorrentId">
        <button class="close" @click="clearSelection">Close</button>
        <TorrentDetails :torrentId="selectedTorrentId" />
      </div>
    </div>

  </div>
</template>

<style scoped>
.dashboard {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg);
  color: var(--text);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
}

.main {
  display: flex;
  gap: 1rem;
}

.left {
  width: 40%;
  background: var(--bg-alt);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.right {
  width: 60%;
  background: var(--bg-alt);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.close {
  float: right;
  margin-bottom: 0.5rem;
  background: var(--danger);
  color: var(--bg);
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
}

.close:hover {
  background: var(--danger-hover);
}
</style>

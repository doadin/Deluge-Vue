<template>
  <div class="app-shell">
    <TorrentList />
    <ConnectionManager v-if="showManager" @close="showManager = false" />
  </div>
</template>

<script setup>
import TorrentList from "./components/TorrentList.vue";
import ConnectionManager from "./components/ConnectionManager.vue";
import { getDelugeClient } from './rpc/delugeClient';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const showManager = ref(false);

onMounted(() => {
  const client = getDelugeClient();

  // Only show the manager automatically if we have no webui session.
  if (!client.sessionId) {
    showManager.value = true;
  }

  // Attempt background login to restore session/password (do NOT force-open manager on failure).
  (async () => {
    try {
      await client.login();
    } catch (err) {
      console.debug('webui login not established on mount:', err && err.message);
      // Do not flip showManager here; the user closed or will open manager manually.
    }
  })();

  // Event handlers so we can remove them on unmount.
  const onConnected = () => { showManager.value = false; };

  const onWebuiLoggedIn = () => {
    // Query the web API to see if a daemon is already connected.
    (async () => {
      const clientLater = getDelugeClient();
      try {
        const res = await clientLater.rpc('web.connected', []);
        console.debug('RPC web.connected response:', res);
        // client.rpc may return boolean or wrapped object; handle common shapes
        const connected = (typeof res === 'boolean')
          ? res
          : (res && (res.result === true || res === true));
        if (!connected) {
          showManager.value = true;
        } else {
          showManager.value = false;
        }
      } catch (e) {
        console.debug('web.connected check failed:', e && e.message);
        // If the check fails, do not aggressively open the manager; keep current state.
      }
    })();
  };

  window.addEventListener('connected', onConnected);
  window.addEventListener('webui-logged-in', onWebuiLoggedIn);

  onBeforeUnmount(() => {
    window.removeEventListener('connected', onConnected);
    window.removeEventListener('webui-logged-in', onWebuiLoggedIn);
  });
});
</script>
<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

const client = new DelugeClient();
const config = ref(null);
const saving = ref(false);

async function loadConfig() {
    await client.login();
    config.value = await client.getConfig();
}

async function save() {
    saving.value = true;
    await client.setConfig(config.value);
    saving.value = false;
}

onMounted(loadConfig);
</script>

<template>
  <div class="settings" v-if="config">

    <h2>Preferences</h2>

    <!-- NETWORK -->
    <section>
      <h3>Network</h3>

      <label>
        Listen Port:
        <input type="number" v-model="config.listen_ports[0]" />
      </label>

      <label>
        Outgoing Ports:
        <input type="number" v-model="config.outgoing_ports[0]" />
      </label>

      <label>
        Random Port:
        <input type="checkbox" v-model="config.random_port" />
      </label>
    </section>

    <!-- BANDWIDTH -->
    <section>
      <h3>Bandwidth</h3>

      <label>
        Max Download Speed (KB/s):
        <input type="number" v-model="config.max_download_speed" />
      </label>

      <label>
        Max Upload Speed (KB/s):
        <input type="number" v-model="config.max_upload_speed" />
      </label>

      <label>
        Max Connections:
        <input type="number" v-model="config.max_connections_global" />
      </label>

      <label>
        Max Upload Slots:
        <input type="number" v-model="config.max_upload_slots_global" />
      </label>
    </section>

    <!-- QUEUE -->
    <section>
      <h3>Queue</h3>

      <label>
        Max Active Torrents:
        <input type="number" v-model="config.max_active_limit" />
      </label>

      <label>
        Max Active Downloads:
        <input type="number" v-model="config.max_active_downloading" />
      </label>

      <label>
        Max Active Uploads:
        <input type="number" v-model="config.max_active_seeding" />
      </label>
    </section>

    <!-- DAEMON -->
    <section>
      <h3>Daemon</h3>

      <label>
        Allow Remote:
        <input type="checkbox" v-model="config.allow_remote" />
      </label>

      <label>
        Daemon Port:
        <input type="number" v-model="config.daemon_port" />
      </label>
    </section>

    <!-- BUTTON -->
    <button @click="save" :disabled="saving">
      {{ saving ? "Saving..." : "Save Preferences" }}
    </button>

  </div>
</template>

<style scoped>
.settings {
  padding: 1rem;
}
section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f3f4f6;
  border-radius: 8px;
}
label {
  display: block;
  margin: 0.5rem 0;
}
input[type="number"] {
  margin-left: 0.5rem;
  width: 100px;
}
input[type="checkbox"] {
  margin-left: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
button:hover {
  background: #2563eb;
}
</style>

<script setup>
import { defineEmits, defineProps, ref, onMounted } from "vue";
import { getDelugeClient } from "../rpc/delugeClient";

const props = defineProps({
  modal: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(["close"]);

const client = getDelugeClient("/api");
const config = ref(null);
const saving = ref(false);
const loading = ref(true);
const errorMessage = ref("");
const selectedTab = ref("Downloads");

const tabs = [
  "Downloads",
  "Network",
  "Encryption",
  "Bandwidth",
  "Interface",
  "Other",
  "Daemon",
  "Queue",
  "Proxy",
  "Cache",
  "Plugins",
  "ItConfig",
];

function normalizeConfig(data) {
  return {
    ...data,
    download_location: data?.download_location || "",
    move_completed: Boolean(data?.move_completed),
    move_completed_path: data?.move_completed_path || "",
    copy_torrent_files: Boolean(data?.copy_torrent_files),
    torrentfiles_location: data?.torrentfiles_location || "",
    prioritize_first_last_pieces: Boolean(data?.prioritize_first_last_pieces),
    sequential_download: Boolean(data?.sequential_download),
    add_paused: Boolean(data?.add_paused),
    pre_allocate: Boolean(data?.pre_allocate),
    listen_ports: Array.isArray(data?.listen_ports) ? data.listen_ports : [data?.listen_ports ?? 0],
    outgoing_ports: Array.isArray(data?.outgoing_ports) ? data.outgoing_ports : [data?.outgoing_ports ?? 0],
    random_port: Boolean(data?.random_port),
    bind_address: data?.bind_address || "",
    enable_upnp: Boolean(data?.enable_upnp),
    encryption: data?.encryption ?? 0,
    max_download_speed: data?.max_download_speed ?? 0,
    max_upload_speed: data?.max_upload_speed ?? 0,
    max_connections_global: data?.max_connections_global ?? 0,
    max_upload_slots_global: data?.max_upload_slots_global ?? 0,
    max_active_limit: data?.max_active_limit ?? 0,
    max_active_downloading: data?.max_active_downloading ?? 0,
    max_active_seeding: data?.max_active_seeding ?? 0,
    allow_remote: Boolean(data?.allow_remote),
    daemon_port: data?.daemon_port ?? 0,
    cache_size: data?.cache_size ?? 512,
    cache_expiry: data?.cache_expiry ?? 60,
    webui_password: data?.webui_password || "",
  };
}

async function loadConfig() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await client.login();
    const data = await client.getConfig();
    config.value = normalizeConfig(data);
  } catch (error) {
    console.error(error);
    errorMessage.value = error.message || "Unable to load Deluge settings.";
  } finally {
    loading.value = false;
  }
}

const close = () => {
  if (props.modal) {
    emit("close");
  }
};

async function save() {
  if (!config.value) return;

  saving.value = true;
  errorMessage.value = "";

  try {
    await client.setConfig(config.value);
    errorMessage.value = "Preferences saved.";
  } catch (error) {
    console.error(error);
    errorMessage.value = error.message || "Unable to save Deluge settings.";
  } finally {
    saving.value = false;
  }
}

function ok() {
  save().then(() => close());
}

onMounted(loadConfig);
</script>

<template>
  <div class="settings-shell" v-if="config">
    <div class="settings-modal">
      <div class="settings-left">
        <h3>Preferences</h3>
        <ul class="settings-tabs">
          <li v-for="tab in tabs" :key="tab" :class="{ active: selectedTab === tab }" @click="selectedTab = tab">{{ tab }}</li>
        </ul>
      </div>

      <div class="settings-right">
        <div class="settings-header">
          <div>
            <h2>{{ selectedTab }}</h2>
            <p v-if="errorMessage" class="status-message" :class="{ success: errorMessage.includes('saved') }">{{ errorMessage }}</p>
          </div>
          <div class="settings-controls">
            <button type="button" class="secondary" @click="close">Close</button>
            <button type="button" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Apply' }}</button>
            <button type="button" @click="ok">OK</button>
          </div>
        </div>

        <div class="settings-content">
          <!-- Downloads -->
          <div v-if="selectedTab === 'Downloads'">
            <label>Download to:
              <input type="text" v-model="config.download_location" />
            </label>
            <label><input type="checkbox" v-model="config.move_completed" /> Move completed to</label>
            <label>Completed location: <input type="text" v-model="config.move_completed_path" :disabled="!config.move_completed" /></label>
            <label><input type="checkbox" v-model="config.copy_torrent_files" /> Copy .torrent files to</label>
            <label>Torrent files location: <input type="text" v-model="config.torrentfiles_location" :disabled="!config.copy_torrent_files" /></label>
            <label><input type="checkbox" v-model="config.add_paused" /> Add torrents in Paused state</label>
            <label><input type="checkbox" v-model="config.pre_allocate" /> Pre-allocate disk space</label>
          </div>

          <!-- Network -->
          <div v-if="selectedTab === 'Network'">
            <label>Incoming Interface: <input type="text" v-model="config.bind_address" /></label>
            <label>Listen Port: <input type="number" v-model="config.listen_ports[0]" /></label>
            <label><input type="checkbox" v-model="config.random_port" /> Use Random Port</label>
            <label>Outgoing Interface: <input type="text" v-model="config.bind_address" /></label>
            <label>Outgoing Port: <input type="number" v-model="config.outgoing_ports[0]" /></label>
            <label><input type="checkbox" v-model="config.enable_upnp" /> UPnP / NAT-PMP</label>
          </div>

          <!-- Encryption -->
          <div v-if="selectedTab === 'Encryption'">
            <label>Incoming: <select v-model="config.encryption"><option :value="0">Disabled</option><option :value="1">Prefer</option><option :value="2">Require</option></select></label>
            <label>Outgoing: <select v-model="config.encryption"><option :value="0">Disabled</option><option :value="1">Prefer</option><option :value="2">Require</option></select></label>
            <label>Level: <select v-model="config.encryption"><option :value="0">Either</option><option :value="1">Preferred</option><option :value="2">Required</option></select></label>
          </div>

          <!-- Bandwidth -->
          <div v-if="selectedTab === 'Bandwidth'">
            <label>Maximum Connections: <input type="number" v-model="config.max_connections_global" /></label>
            <label>Maximum Upload Slots: <input type="number" v-model="config.max_upload_slots_global" /></label>
            <label>Maximum Download Speed (KB/s): <input type="number" v-model="config.max_download_speed" /></label>
            <label>Maximum Upload Speed (KB/s): <input type="number" v-model="config.max_upload_speed" /></label>
          </div>

          <!-- Interface -->
          <div v-if="selectedTab === 'Interface'">
            <label><input type="checkbox" /> Show session speed in titlebar</label>
            <label><input type="checkbox" /> Show filters with zero torrents</label>
            <label>Theme: <select><option>Gray</option><option>System Default</option></select></label>
            <label>WebUI Password: <input type="password" v-model="config.webui_password" /></label>
          </div>

          <!-- Other -->
          <div v-if="selectedTab === 'Other'">
            <label><input type="checkbox" /> Be alerted about new releases</label>
            <label>GeoIP Database Path: <input type="text" /></label>
          </div>

          <!-- Daemon -->
          <div v-if="selectedTab === 'Daemon'">
            <label>Daemon Port: <input type="number" v-model="config.daemon_port" /></label>
            <label><input type="checkbox" v-model="config.allow_remote" /> Allow Remote Connections</label>
          </div>

          <!-- Queue -->
          <div v-if="selectedTab === 'Queue'">
            <label>Max Active Torrents: <input type="number" v-model="config.max_active_limit" /></label>
            <label>Max Active Downloads: <input type="number" v-model="config.max_active_downloading" /></label>
            <label>Max Active Uploads: <input type="number" v-model="config.max_active_seeding" /></label>
          </div>

          <!-- Proxy -->
          <div v-if="selectedTab === 'Proxy'">
            <label>Type: <select><option>None</option><option>SOCKS5</option><option>HTTP</option></select></label>
            <label><input type="checkbox" /> Force use of proxy</label>
          </div>

          <!-- Cache -->
          <div v-if="selectedTab === 'Cache'">
            <label>Cache Size (16 KB blocks): <input type="number" v-model="config.cache_size" /></label>
            <label>Cache Expiry (seconds): <input type="number" v-model="config.cache_expiry" /></label>
          </div>

          <!-- Plugins -->
          <div v-if="selectedTab === 'Plugins'">
            <p>Installed plugins will be listed here.</p>
          </div>

      <button v-if="props.modal" type="button" class="secondary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-shell {
  width: 100%;
}
.settings-modal {
  display: flex;
  gap: 16px;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}
.settings-left {
  width: 180px;
  border-right: 1px solid var(--border);
  padding-right: 12px;
}
.settings-left h3 {
  margin: 0 0 8px 0;
}
.settings-tabs {
  list-style: none;
  padding: 0;
  margin: 0;
}
.settings-tabs li {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text);
}
.settings-tabs li.active {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-alt) 86%);
  font-weight: 600;
}
.settings-right {
  flex: 1;
  padding-left: 12px;
}
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.settings-controls button {
  margin-left: 8px;
}
.settings-content {
  max-height: 60vh;
  overflow-y: auto;
}
label { display: block; margin: 8px 0; }
input[type="text"], input[type="number"], input[type="password"], select { margin-left: 8px; }
.status-message { color: var(--danger); }
.status-message.success { color: #15803d; }
</style>

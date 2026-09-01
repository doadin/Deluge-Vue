<script setup>
import { defineEmits, defineProps, ref, onMounted, watch, computed } from "vue";
import { getDelugeClient } from "../rpc/delugeClient";

const props = defineProps({
  modal: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(["close"]);

const client = getDelugeClient();
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

// Plugins state
const pluginsAvailable = ref([]);
const pluginsEnabled = ref([]);
const pluginsLoading = ref(false);
const pluginsError = ref("");
const pluginInfo = ref(null);
const pluginInfoNormalized = ref(null);
const pluginInfoLoading = ref(false);
const pluginInfoError = ref("");

async function loadPlugins() {
  pluginsError.value = "";
  pluginsLoading.value = true;
  try {
    await client.login();
    // client.getPlugins may return list or dict depending on API; handle common shapes
    let available = [];
    try {
      const p = await client.getPlugins();
      if (Array.isArray(p)) available = p;
      else if (p && Array.isArray(p.available_plugins)) available = p.available_plugins;
      else if (p && p.available) available = p.available;
    } catch (e) {
      console.debug('getPlugins failed:', e && e.message);
      available = [];
    }

    let enabled = [];
    try {
      const e = await client.getEnabledPlugins();
      if (Array.isArray(e)) enabled = e;
      else if (e && Array.isArray(e.enabled_plugins)) enabled = e.enabled_plugins;
    } catch (err) {
      console.debug('getEnabledPlugins failed:', err && err.message);
      enabled = [];
    }

    pluginsAvailable.value = available;
    pluginsEnabled.value = enabled;
  } catch (error) {
    console.error('Failed to load plugins:', error);
    pluginsError.value = error.message || 'Unable to load plugins';
  } finally {
    pluginsLoading.value = false;
  }
}

async function loadPluginInfo(name) {
  pluginInfo.value = null;
  pluginInfoNormalized.value = null;
  pluginInfoError.value = "";
  pluginInfoLoading.value = true;
  try {
    await client.login();
    const candidateMethods = ['web.get_plugin_info','get_plugin_info','plugins.get_plugin_info','core.get_plugin_info'];
    let info = null;
    for (const m of candidateMethods) {
      try {
        const res = await client.rpc(m, [name]);
        if (res) { info = res; break; }
      } catch (e) {
        console.debug('RPC', m, 'failed for plugin info:', e && e.message);
      }
    }
    pluginInfo.value = info;
    pluginInfoNormalized.value = normalizePluginInfo(info);
  } catch (e) {
    console.error('Failed to load plugin info:', e);
    pluginInfoError.value = e.message || 'Unable to load plugin info';
  } finally {
    pluginInfoLoading.value = false;
  }
}

function normalizePluginInfo(raw) {
  if (!raw) return null;
  const obj = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return { raw }; } })() : raw;
  const keys = Object.keys(obj || {});
  const findKey = (names) => {
    for (const n of names) {
      const k = keys.find(x => x.toLowerCase() === n.toLowerCase());
      if (k) return obj[k];
    }
    return null;
  };
  return {
    name: findKey(["name", "plugin_name", "Plugin", "Name"]) || "",
    author: findKey(["author", "authors", "Author"]) || "",
    version: findKey(["version", "plugin_version", "Version"]) || "",
    email: findKey(["author_email", "author-email", "Author-email"]) || "",
    homepage: findKey(["homepage", "home-page", "Home-page", "url"]) || "",
    description: findKey(["description", "desc", "Summary", "summary", "Description"]) || "",
    raw: obj,
  };
}

// Plugin settings (read-only)
const pluginSettings = ref(null);
const pluginSettingsLoading = ref(false);
const pluginSettingsError = ref("");

async function loadPluginSettings(plugin) {
  console.log('Loading settings for plugin:', plugin);
  pluginSettings.value = null;
  pluginSettingsError.value = "";
  pluginSettingsLoading.value = true;
  try {
    await client.login();
    const candidates = [
      `${plugin}.get_settings`,
      `${plugin}.getSettings`,
      `web.get_plugin_settings`,
      `get_plugin_settings`,
      `${plugin}.get_config`,
    ];
    let result = null;
    for (const m of candidates) {
      try {
        const res = await client.rpc(m, []);
        console.log('RPC result for', m, ':', res);
        if (res && Object.keys(res).length > 0) { result = res; break; }
      } catch (e) {
        // try next
      }
    }
    if (!result) {
      pluginSettingsError.value = "No settings endpoint found for plugin.";
    } else {
      // If plugin returns wrapper {result: {...}} client.rpc already unwraps, so use result directly
      pluginSettings.value = result;
    }
  } catch (e) {
    pluginSettingsError.value = e.message || String(e);
  } finally {
    pluginSettingsLoading.value = false;
  }
}

// Helpers to normalize plugin names/descriptions (pluginsAvailable items may be objects or strings)
function pluginName(p) {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return p.name || p.plugin_name || p.Name || p.Plugin || '';
}

function pluginDesc(p) {
  if (!p) return '';
  if (typeof p === 'string') return '';
  return p.description || p.desc || p.Summary || p.summary || '';
}

const availableNotEnabled = computed(() => {
  const enabledSet = new Set((pluginsEnabled.value || []).map(String));
  return (pluginsAvailable.value || []).filter(p => !enabledSet.has(String(pluginName(p))));
});

const allTabs = computed(() => {
  // Append plugin tabs (enabled plugin names) after the static tabs
  const pluginTabs = (pluginsEnabled.value || []).map(String);
  const seen = new Set();
  const out = [];
  for (const t of tabs) {
    if (!seen.has(t)) { out.push(t); seen.add(t); }
  }
  for (const p of pluginTabs) {
    if (!seen.has(p)) { out.push(p); seen.add(p); }
  }
  return out;
});

async function togglePlugin(name) {
  try {
    await client.login();
    if (pluginsEnabled.value.includes(name)) {
      await client.disablePlugin(name);
    } else {
      await client.enablePlugin(name);
    }
    await loadPlugins();
  } catch (err) {
    console.error('Toggle plugin failed:', err);
    pluginsError.value = err.message || 'Failed to toggle plugin';
  }
}

watch(selectedTab, (v) => {
  if (v === 'Plugins') loadPlugins();
});

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
          <!--
          <li v-for="tab in tabs" :key="tab" :class="{ active: selectedTab === tab }" @click="selectedTab = tab">{{ tab }}</li>
          -->
          <li v-for="tab in allTabs" :key="tab" :class="{ active: selectedTab === tab }" @click="selectedTab = tab">{{ tab }}</li>
        </ul>
      </div>

      <div class="settings-right">
        <div class="settings-header">
          <div>
            <h2>{{ selectedTab }}</h2>
            <p v-if="errorMessage" class="status-message" :class="{ success: errorMessage.includes('saved') }">{{ errorMessage }}</p>
          </div>
        </div>

        <div class="settings-content">
          <!-- Downloads -->
          <div v-if="selectedTab === 'Downloads'">
            <label>Folders</label>
            <label>Download to:
              <input type="text" v-model="config.download_location" />
            </label>
            <label><input type="checkbox" v-model="config.move_completed" /> Move completed to</label>
            <label>Completed location: <input type="text" v-model="config.move_completed_path" :disabled="!config.move_completed" /></label>
            <label><input type="checkbox" v-model="config.copy_torrent_files" /> Copy .torrent files to</label>
            <label>Torrent files location: <input type="text" v-model="config.torrentfiles_location" :disabled="!config.copy_torrent_files" /></label>
            <label>Options</label>
            <label><input type="checkbox" v-model="config.prioritize_first_last_pieces" /> Prioritize first and last pieces of torrent</label>
            <label><input type="checkbox" v-model="config.sequential_download" /> Sequential download</label>
            <label><input type="checkbox" v-model="config.add_paused" /> Add torrents in Paused state</label>
            <label><input type="checkbox" v-model="config.pre_allocate" /> Pre-allocate disk space</label>
          </div>

          <!-- Network -->
          <div v-if="selectedTab === 'Network'">
            <label>Incoming Interface: <input type="text" v-model="config.listen_interface" /></label>
            <label><input type="checkbox" v-model="config.random_port" /> Use Random Port</label>
            <label>Listen Ports: <input type="number" v-model="config.listen_ports[0]" /><input type="number" v-model="config.listen_ports[1]" /></label>
            <label>Outgoing Interface: <input type="text" v-model="config.outgoing_interface" /></label>
            <label><input type="checkbox" v-model="config.random_outgoing_ports" /> Use Random Outgoing Ports</label>
            <label>Outgoing Ports: <input type="number" v-model="config.outgoing_ports[0]" /><input type="number" v-model="config.outgoing_ports[1]" /></label>
            <label><input type="checkbox" v-model="config.upnp" /> UPnP</label>
            <label><input type="checkbox" v-model="config.natpmp" /> NAT-PMP</label>
            <label><input type="checkbox" v-model="config.utpex" /> Peer Exchange</label>
            <label><input type="checkbox" v-model="config.lsd" /> Local Service Discovery</label>
            <label><input type="checkbox" v-model="config.dht" /> DHT</label>
          </div>

          <!-- Encryption -->
          <div v-if="selectedTab === 'Encryption'">
            <label>Incoming: <select v-model="config.enc_in_policy"><option :value="0">Forced</option><option :value="1">Enabled</option><option :value="2">Disabled</option></select></label>
            <label>Outgoing: <select v-model="config.enc_out_policy"><option :value="0">Forced</option><option :value="1">Enabled</option><option :value="2">Disabled</option></select></label>
            <label>Level: <select v-model="config.enc_level"><option :value="0">Handshake</option><option :value="1">Full Stream</option><option :value="2">Either</option></select></label>
          </div>

          <!-- Bandwidth -->
          <div v-if="selectedTab === 'Bandwidth'">
            <label>Global Bandwidth Usage</label>
            <label>Maximum Connections: <input type="number" v-model="config.max_connections_global" /></label>
            <label>Maximum Upload Slots: <input type="number" v-model="config.max_upload_slots_global" /></label>
            <label>Maximum Download Speed (KB/s): <input type="number" v-model="config.max_download_speed" /></label>
            <label>Maximum Upload Speed (KB/s): <input type="number" v-model="config.max_upload_speed" /></label>
            <label>Maximum Half-Open Connections: <input type="number" v-model="config.max_half_open_connections" /></label>
            <label>Maximum Connection Attempts per Second: <input type="number" v-model="config.max_connections_per_second" /></label>
            <label><input type="checkbox" v-model="config.ignore_limits_on_local_network" /> Ignore limits on local network</label>
            <label><input type="checkbox" v-model="config.rate_limit_ip_overhead" /> Rate limit IP overhead</label>
            <label>Per Torrent Bandwidth Usage</label>
            <label>Maximum Connections: <input type="number" v-model="config.max_connections_per_torrent" /></label>
            <label>Maximum Upload Slots: <input type="number" v-model="config.max_upload_slots_per_torrent" /></label>
            <label>Maximum Download Speed (KB/s): <input type="number" v-model="config.max_download_speed_per_torrent" /></label>
            <label>Maximum Upload Speed (KB/s): <input type="number" v-model="config.max_upload_speed_per_torrent" /></label>
          </div>

          <!-- Interface -->
           <!-- 
          <div v-if="selectedTab === 'Interface'">
            <label><input type="checkbox" /> Show session speed in titlebar</label>
            <label><input type="checkbox" /> Show filters with zero torrents</label>
            <label>Theme: <select><option>Gray</option><option>System Default</option></select></label>
            <label>WebUI Password: <input type="password" v-model="config.webui_password" /></label>
          </div> 
          -->

          <!-- Other -->
          <div v-if="selectedTab === 'Other'">
            <label><input type="checkbox" v-model="config.new_release_check" /> Be alerted about new releases</label>
            <label>GeoIP Database Path: <input type="text" v-model="config.geoip_db_location" /></label>
          </div>

          <!-- Daemon -->
          <div v-if="selectedTab === 'Daemon'">
            <label>Daemon Port: <input type="number" v-model="config.daemon_port" /></label>
            <label><input type="checkbox" v-model="config.allow_remote" /> Allow Remote Connections</label>
          </div>

          <!-- Queue -->
          <div v-if="selectedTab === 'Queue'">
            <label>New Torrents</label>
            <label><input type="checkbox" v-model="config.queue_new_to_top" /> Queue to top</label>
            <label>Active Torrents</label>
            <label>Total: <input type="number" v-model="config.max_active_limit" /></label>
            <label>Downloading: <input type="number" v-model="config.max_active_downloading" /></label>
            <label>Seeding: <input type="number" v-model="config.max_active_seeding" /></label>
            <label><input type="checkbox" v-model="config.dont_count_slow_torrents" /> Ignore slow torrents</label>
            <label><input type="checkbox" v-model="config.auto_manage_prefer_seeds" /> Prefer seeding torrents</label>
            <label>Seeding Rotation</label>
            <label>Share Ratio: <input type="number" v-model="config.stop_seed_ratio" /></label>
            <label>Time Ratio: <input type="number" v-model="config.seed_time_ratio_limit" /></label>
            <label>Time (m): <input type="number" v-model="config.seed_time_limit" /></label>
            <label>Share Ratio Reached</label>
            <label><input type="checkbox" v-model="config.allow_remote" /> Share Ratio</label>
          </div>

          <!-- Proxy -->
          <div v-if="selectedTab === 'Proxy'">
            <label>Type: <select><option>None</option><option>SOCKS5</option><option>HTTP</option></select></label>
            <label><input type="checkbox" v-model="config.proxy.force_proxy" /> Force use of proxy</label>
            <label><input type="checkbox" v-model="config.proxy.anonymous_mode" /> Hide Client Identity</label>
          </div>

          <!-- Cache -->
          <div v-if="selectedTab === 'Cache'">
            <label>Cache Size (16 KB blocks): <input type="number" v-model="config.cache_size" /></label>
            <label>Cache Expiry (seconds): <input type="number" v-model="config.cache_expiry" /></label>
          </div>

          <!-- Plugins -->
          <div v-if="selectedTab === 'Plugins'">
            <div v-if="pluginsLoading">Loading plugins…</div>
            <div v-else style="display:flex; gap:16px;">
              <div style="flex:1">
                <div v-if="pluginsError" class="status-message">{{ pluginsError }}</div>
                <h4>Available</h4>
                <ul style="list-style:none; padding:0; margin:0;">
                  <li v-for="p in pluginsAvailable" :key="p.name || p" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border);">
                    <div style="min-width:0">
                      <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:320px;">{{ p.name || p }}</div>
                      <div style="font-size:0.85rem; color:var(--text-muted); max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ p.description || p.desc || '' }}</div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                      <button @click="togglePlugin(p.name || p)">{{ pluginsEnabled.includes(p.name || p) ? 'Disable' : 'Enable' }}</button>
                      <button @click="loadPluginInfo(p.name || p)">Info</button>
                    </div>
                  </li>
                  <li v-if="pluginsAvailable.length===0" style="color:var(--text-muted)">No plugins found.</li>
                </ul>
              </div>
          
              <div style="width:360px;">
                <h4>Plugin Info</h4>
                <div v-if="pluginInfoLoading">Loading info…</div>
                <div v-else-if="pluginInfoError" class="status-message">{{ pluginInfoError }}</div>
                <div v-else-if="pluginInfoNormalized">
                  <div style="margin-bottom:8px;"><strong>Name:</strong> {{ pluginInfoNormalized.name || '—' }}</div>
                  <div style="margin-bottom:8px;"><strong>Author:</strong> {{ pluginInfoNormalized.author || '—' }}</div>
                  <div style="margin-bottom:8px;"><strong>Version:</strong> {{ pluginInfoNormalized.version || '—' }}</div>
                  <div style="margin-bottom:8px;"><strong>Author Email:</strong> {{ pluginInfoNormalized.email || '—' }}</div>
                  <div style="margin-bottom:8px;"><strong>Homepage:</strong>
                    <span v-if="pluginInfoNormalized.homepage"><a :href="pluginInfoNormalized.homepage" target="_blank" rel="noopener">{{ pluginInfoNormalized.homepage }}</a></span>
                    <span v-else>—</span>
                  </div>
                  <div style="margin-top:10px;"><strong>Description</strong>
                    <p style="max-height:220px; overflow:auto; margin:6px 0;">{{ pluginInfoNormalized.description }}</p>
                  </div>
                </div>
                <div v-else style="color:var(--text-muted)">Select a plugin and click Info to view details.</div>
              </div>
            </div>
          </div>

          <!-- Plugin tab content placeholder -->
          <div v-if="pluginsEnabled.includes(selectedTab)" style="padding:12px; border-top:1px solid var(--border); margin-top:12px;">
            <h3>{{ selectedTab }} (Plugin)</h3>
            <div style="margin:8px 0">
              <button @click="loadPluginSettings(selectedTab)">Load settings</button>
              <span v-if="pluginSettingsLoading" style="margin-left:8px">Loading…</span>
              <div v-if="pluginSettingsError" class="status-message" style="margin-top:8px">{{ pluginSettingsError }}</div>
            </div>
          
            <div v-if="pluginSettings && !pluginSettingsLoading" style="margin-top:12px">
              <table style="width:100%; border-collapse:collapse;">
                <thead><tr><th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--border)">Key</th><th style="text-align:left; padding:6px 8px; border-bottom:1px solid var(--border)">Value</th></tr></thead>
                <tbody>
                  <tr v-for="(val, key) in pluginSettings" :key="key">
                    <td style="padding:6px 8px; vertical-align:top; color:var(--text-muted); width:38%">{{ key }}</td>
                    <td style="padding:6px 8px; vertical-align:top;">
                      <template v-if="typeof val === 'boolean'">
                        <input type="checkbox" :checked="val" disabled />
                      </template>
                      <template v-else-if="typeof val === 'number'">
                        <input type="number" :value="val" disabled />
                      </template>
                      <template v-else-if="typeof val === 'string' && val.length < 200">
                        <div style="white-space:pre-wrap;">{{ val }}</div>
                      </template>
                      <template v-else>
                        <pre style="max-height:240px; overflow:auto; margin:0;">{{ JSON.stringify(val, null, 2) }}</pre>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          
            <div v-else-if="!pluginSettingsLoading && !pluginSettings" style="color:var(--text-muted); margin-top:8px">
              No settings loaded. Click "Load settings" to fetch this plugin's configuration (read-only).
            </div>
          </div>

          <div class="settings-header">
            <div class="settings-controls">
              <button type="button" class="secondary" @click="close">Close</button>
              <button type="button" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Apply' }}</button>
              <button type="button" @click="ok">OK</button>
            </div>
          </div>
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

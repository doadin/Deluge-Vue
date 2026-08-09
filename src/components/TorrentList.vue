<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getDelugeClient } from "../rpc/delugeClient";
import Settings from "./Settings.vue";

const client = getDelugeClient("/api");
const torrents = ref([]);
const selectedTorrent = ref(null);
const sortKey = ref("name");
const sortOrder = ref("asc");
const searchQuery = ref("");
const showSettings = ref(false);
let refreshTimer = null;

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatSpeed = (value) => {
  return `${formatBytes(value || 0)}/s`;
};

const formatEta = (value) => {
  if (!value || value < 0) return "∞";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  return `${Math.round(value / 3600)}h`;
};

const getStateLabel = (state) => {
  return String(state || "unknown").replace(/_/g, " ");
};

const getStateClass = (state) => {
  const normalized = String(state || "unknown").toLowerCase();
  if (normalized.includes("download") || normalized.includes("seeding")) return "active";
  if (normalized.includes("pause") || normalized.includes("queued")) return "queued";
  if (normalized.includes("error")) return "error";
  return "default";
};

const selectTorrent = (torrent) => {
  selectedTorrent.value = selectedTorrent.value?.id === torrent.id ? null : torrent;
};

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortOrder.value = "asc";
  }
};

const formatDate = (value) => {
  if (!value || Number(value) === 0) return "—";
  const date = new Date(Number(value) * 1000);
  return date.toLocaleString();
};

const filteredTorrents = () => {
  const query = searchQuery.value.trim().toLowerCase();
  const source = query
    ? torrents.value.filter((torrent) => {
        const name = String(torrent.name || "").toLowerCase();
        const state = String(torrent.state || "").toLowerCase();
        return name.includes(query) || state.includes(query);
      })
    : torrents.value;

  const sorted = [...source];
  sorted.sort((a, b) => {
    let left = a[sortKey.value];
    let right = b[sortKey.value];

    if (sortKey.value === "name") {
      left = String(left || "").toLowerCase();
      right = String(right || "").toLowerCase();
    } else if (sortKey.value === "state") {
      left = String(left || "").toLowerCase();
      right = String(right || "").toLowerCase();
    } else if (sortKey.value === "progress") {
      left = Number(left || 0);
      right = Number(right || 0);
    } else if (sortKey.value === "queue") {
      left = Number(left || 0);
      right = Number(right || 0);
    } else if (sortKey.value === "time_added") {
      left = Number(left || 0);
      right = Number(right || 0);
    }

    if (left < right) return sortOrder.value === "asc" ? -1 : 1;
    if (left > right) return sortOrder.value === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
};

const clearSelection = () => {
  selectedTorrent.value = null;
};

const clearSearch = async () => {
  searchQuery.value = "";
  await refreshTorrents();
};

const showRemoveDialog = ref(false);
const removeWithData = ref(false);
const globalStatus = ref({
  connections: 0,
  maxConnections: 0,
  downloadSpeed: 0,
  uploadSpeed: 0,
  ipOverhead: 0,
  freeDiskSpace: null,
  externalIp: "—",
  dhtNodes: 0,
});

const getRemoveTarget = () => {
  const id = selectedTorrent.value?.id || torrents.value[0]?.id || null;
  return id;
};

const confirmRemoveTorrent = () => {
  const torrentId = getRemoveTarget();
  if (!torrentId) {
    window.alert("Select a torrent first.");
    return;
  }
  removeWithData.value = false;
  showRemoveDialog.value = true;
};

const removeCurrentTorrent = async (keepData) => {
  const torrentId = getRemoveTarget();
  if (!torrentId) {
    return;
  }

  showRemoveDialog.value = false;

  try {
    if (keepData) {
      await client.removeTorrent(torrentId);
    } else {
      await client.removeTorrentAndData(torrentId);
    }
    selectedTorrent.value = null;
    await refreshTorrents();
  } catch (error) {
    console.error(error);
    window.alert(`Unable to remove torrent: ${error.message}`);
  }
};

const normalizeTorrentData = (torrentData) => {
  return {
    ...torrentData,
    download_speed: torrentData.download_speed ?? torrentData.download_payload_rate ?? 0,
    upload_speed: torrentData.upload_speed ?? torrentData.upload_payload_rate ?? 0,
  };
};

const refreshGlobalStatus = async () => {
  try {
    await client.login();
    const [coreConfig, sessionStatus, externalIp] = await Promise.all([
      client.getConfig(),
      client.getSessionStatus([
        'peer.num_peers_connected',
        'payload_download_rate',
        'payload_upload_rate',
        'download_rate',
        'upload_rate',
        'dht.dht_nodes',
        'net.has_incoming_connections',
      ]),
      client.getExternalIp(),
    ]);

    const coreCfg = coreConfig || {};
    let freeSpace = null;
    const downloadLocation = coreCfg.download_location || coreCfg.download_location_path || coreCfg.downloadLocation;
    if (downloadLocation) {
      try {
        freeSpace = await client.getFreeSpace(downloadLocation);
      } catch (error) {
        freeSpace = null;
      }
    }

    globalStatus.value = {
      connections:
        sessionStatus['peer.num_peers_connected'] ??
        sessionStatus.connection_count ??
        sessionStatus.total_connections ??
        sessionStatus.connections ??
        0,
      maxConnections:
        coreCfg.max_connections_global ??
        coreCfg.max_connections ??
        sessionStatus.max_connections ??
        sessionStatus.maxConnections ??
        0,
      downloadSpeed:
        sessionStatus.payload_download_rate ??
        sessionStatus.download_rate ??
        sessionStatus.download_speed ??
        0,
      uploadSpeed:
        sessionStatus.payload_upload_rate ??
        sessionStatus.upload_rate ??
        sessionStatus.upload_speed ??
        0,
      ipOverhead:
        sessionStatus.download_rate != null && sessionStatus.payload_download_rate != null
          ? sessionStatus.download_rate - sessionStatus.payload_download_rate +
            (sessionStatus.upload_rate != null && sessionStatus.payload_upload_rate != null
              ? sessionStatus.upload_rate - sessionStatus.payload_upload_rate
              : 0)
          : 0,
      freeDiskSpace: freeSpace ?? null,
      externalIp: externalIp || sessionStatus.external_ip || sessionStatus.externalIp || "—",
      dhtNodes:
        sessionStatus['dht.dht_nodes'] ??
        sessionStatus.dht_node_count ??
        sessionStatus.dhtNodes ??
        0,
    };
  } catch (error) {
    console.error("Failed to refresh global status:", error);
  }
};

const refreshTorrents = async () => {
  try {
    await client.login();
    const data = await client.getTorrents();
    torrents.value = Object.entries(data.torrents || {}).map(([id, torrent]) => ({
      id,
      ...normalizeTorrentData(torrent),
    }));
    if (selectedTorrent.value) {
      const updated = torrents.value.find((torrent) => torrent.id === selectedTorrent.value.id);
      selectedTorrent.value = updated || normalizeTorrentData(selectedTorrent.value);
    }
  } catch (error) {
    console.error("Failed to refresh torrents:", error);
  }
};

const getSelectedTorrentId = () => {
  return selectedTorrent.value?.id || torrents.value[0]?.id || null;
};

const runTorrentAction = async (action, label) => {
  const torrentId = getSelectedTorrentId();
  if (!torrentId) {
    window.alert("Select a torrent first.");
    return;
  }

  try {
    await action(torrentId);
    await refreshTorrents();
  } catch (error) {
    console.error(error);
    window.alert(`Unable to ${label}: ${error.message}`);
  }
};

const handleAddTorrent = async () => {
  const magnet = window.prompt("Enter a magnet link or torrent URL", "");
  if (!magnet) return;

  try {
    await client.addMagnet(magnet);
    await refreshTorrents();
  } catch (error) {
    console.error(error);
    window.alert(`Unable to add torrent: ${error.message}`);
  }
};

const openSettings = () => {
  showSettings.value = true;
};

const refreshAllState = async () => {
  await Promise.all([refreshTorrents(), refreshGlobalStatus()]);
};

onMounted(async () => {
  await refreshAllState();
  refreshTimer = window.setInterval(refreshAllState, 3000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="torrent-page">

    <!-- LEFT SIDEBAR -->
    <div class="sidebar">
      <div class="sidebar-section">
        <h4>States</h4>
        <button class="sidebar-button">All ({{ torrents.length }})</button>
        <button class="sidebar-button">Active ({{ activeCount }})</button>
        <button class="sidebar-button">Seeding ({{ seedingCount }})</button>
        <button class="sidebar-button">Paused ({{ pausedCount }})</button>
      </div>

      <div class="sidebar-section">
        <h4>Trackers</h4>
        <button class="sidebar-button">Trackers ({{ torrents.length }})</button>
      </div>

      <div class="sidebar-section">
        <h4>Owner</h4>
        <button class="sidebar-button">Admin ({{ torrents.length }})</button>
      </div>
    </div>

    <!-- TOP TOOLBAR -->
    <div class="torrent-toolbar">
      <div>
        <h2>Torrents</h2>
        <p>{{ torrents.length }} active torrents</p>
      </div>
    </div>

    <!-- ACTION BAR BELOW TOOLBAR -->
    <div class="action-bar">
      <div class="action-group">
        <button class="toolbar-button accent" @click="handleAddTorrent">Add</button>
        <button class="toolbar-button" @click="confirmRemoveTorrent">Remove</button>
        <button class="toolbar-button" @click="() => runTorrentAction((id) => client.pauseTorrent(id), 'pause the selected torrent')">Pause</button>
        <button class="toolbar-button" @click="() => runTorrentAction((id) => client.resumeTorrent(id), 'resume the selected torrent')">Resume</button>
        <button class="toolbar-button" @click="() => runTorrentAction((id) => client.queueUp(id), 'move the selected torrent up in the queue')">↑</button>
        <button class="toolbar-button" @click="() => runTorrentAction((id) => client.queueDown(id), 'move the selected torrent down in the queue')">↓</button>
        <button class="toolbar-button" @click="() => runTorrentAction((id) => client.queueTop(id), 'move the selected torrent to the top of the queue')">Queue Top</button>
        <button class="toolbar-button" @click="openSettings">Preferences</button>
      </div>

      <div class="action-group compact">
        <div class="search-wrapper">
          <input v-model="searchQuery" class="search-input" placeholder="Search torrents" />
          <button v-if="searchQuery" class="search-clear" @click="clearSearch">×</button>
        </div>

        <label class="toolbar-select">
          <span>Sort</span>
          <select :value="sortKey" @change="sortKey = $event.target.value">
            <option value="name">Name</option>
            <option value="state">Status</option>
            <option value="progress">Progress</option>
            <option value="time_added">Added</option>
          </select>
        </label>

        <button class="toolbar-button" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
          {{ sortOrder === "asc" ? "↑ Asc" : "↓ Desc" }}
        </button>

        <button class="toolbar-button" @click="clearSelection">Clear</button>
      </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="content-shell">
      <div class="torrent-table" v-if="torrents.length">
        <div class="torrent-row header">
          <div class="cell name"><button class="sort-button" @click="sortBy('name')">Name</button></div>
          <div class="cell status"><button class="sort-button" @click="sortBy('state')">Status</button></div>
          <div class="cell progress"><button class="sort-button" @click="sortBy('progress')">Progress</button></div>
          <div class="cell speeds">Speed</div>
          <div class="cell added"><button class="sort-button" @click="sortBy('time_added')">Added</button></div>
          <div class="cell eta">ETA</div>
        </div>

        <div
          v-for="torrent in filteredTorrents()"
          :key="torrent.id"
          class="torrent-row"
          :class="[{ selected: selectedTorrent?.id === torrent.id }, getStateClass(torrent.state)]"
          @click="selectTorrent(torrent)"
        >
          <div class="cell name">
            <div class="torrent-name">{{ torrent.name || "Untitled torrent" }}</div>
            <div class="torrent-meta">{{ formatBytes(torrent.total_size || 0) }}</div>
          </div>

          <div class="cell status">
            <span class="status-pill" :class="getStateClass(torrent.state)">
              {{ getStateLabel(torrent.state) }}
            </span>
          </div>

          <div class="cell progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${Math.min(100, Math.max(0, Number(torrent.progress || 0)))}%` }"></div>
            </div>
            <span class="progress-text">{{ Number(torrent.progress || 0).toFixed(1) }}%</span>
          </div>

          <div class="cell speeds">
            <div>↓ {{ formatSpeed(torrent.download_speed) }}</div>
            <div>↑ {{ formatSpeed(torrent.upload_speed) }}</div>
          </div>

          <div class="cell added">
            {{ formatDate(torrent.time_added) }}
          </div>

          <div class="cell eta">
            {{ formatEta(torrent.eta) }}
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        No torrents found.
      </div>
    </div>

    <!-- DETAILS PANEL -->
    <div v-if="selectedTorrent" class="details-panel">
      <div class="details-content">
        <div class="details-header">
          <div>
            <h3>{{ selectedTorrent.name || "Torrent details" }}</h3>
            <p>{{ formatBytes(selectedTorrent.total_size || 0) }}</p>
          </div>
          <span class="status-pill" :class="getStateClass(selectedTorrent.state)">
            {{ getStateLabel(selectedTorrent.state) }}
          </span>
        </div>

        <div class="details-grid">
          <div>
            <span class="detail-label">Progress</span>
            <strong>{{ Number(selectedTorrent.progress || 0).toFixed(1) }}%</strong>
          </div>
          <div>
            <span class="detail-label">Downloaded</span>
            <strong>{{ formatBytes(selectedTorrent.total_done || 0) }}</strong>
          </div>
          <div>
            <span class="detail-label">Uploaded</span>
            <strong>{{ formatBytes(selectedTorrent.total_uploaded || 0) }}</strong>
          </div>
          <div>
            <span class="detail-label">ETA</span>
            <strong>{{ formatEta(selectedTorrent.eta) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- GLOBAL SUMMARY BAR -->
    <div class="global-summary-bar">
      <div class="summary-item">
        <span>Connections</span>
        <strong>{{ globalStatus.connections }} / {{ globalStatus.maxConnections }}</strong>
      </div>
      <div class="summary-item">
        <span>Download Speed</span>
        <strong>{{ formatSpeed(globalStatus.downloadSpeed) }}</strong>
      </div>
      <div class="summary-item">
        <span>Upload Speed</span>
        <strong>{{ formatSpeed(globalStatus.uploadSpeed) }}</strong>
      </div>
      <div class="summary-item">
        <span>IP Overhead</span>
        <strong>{{ globalStatus.ipOverhead ? formatBytes(globalStatus.ipOverhead) : '—' }}</strong>
      </div>
      <div class="summary-item">
        <span>Free Disk</span>
        <strong>{{ globalStatus.freeDiskSpace !== null ? formatBytes(globalStatus.freeDiskSpace) : '—' }}</strong>
      </div>
      <div class="summary-item">
        <span>External IP</span>
        <strong>{{ globalStatus.externalIp }}</strong>
      </div>
      <div class="summary-item">
        <span>DHT Nodes</span>
        <strong>{{ globalStatus.dhtNodes }}</strong>
      </div>
    </div>
    <div v-if="showSettings" class="modal-backdrop" @click.self="showSettings = false">
      <div class="modal-shell">
        <button class="modal-close" @click="showSettings = false">×</button>
        <Settings :modal="true" @close="showSettings = false" />
      </div>
    </div>

    <div v-if="showRemoveDialog" class="confirm-backdrop" @click.self="showRemoveDialog = false">
      <div class="confirm-shell">
        <div class="confirm-header">
          <strong>Remove Torrent</strong>
          <button class="modal-close" @click="showRemoveDialog = false">×</button>
        </div>
        <p class="confirm-message">Are you sure you want to remove the torrent(s)?</p>
        <div class="confirm-actions">
          <button type="button" class="toolbar-button secondary" @click="showRemoveDialog = false">Cancel</button>
          <button type="button" class="toolbar-button" @click="removeCurrentTorrent(true)">Remove Torrent</button>
          <button type="button" class="toolbar-button danger" @click="removeCurrentTorrent(false)">Remove With Data</button>
        </div>
      </div>
    </div>
  </div>
</template>


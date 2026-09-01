<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { getDelugeClient } from "../rpc/delugeClient";
import Settings from "./Settings.vue";

const client = getDelugeClient();
const torrents = ref([]);
const selectedTorrent = ref(null);
// persist last-used sort settings in localStorage
const sortKey = ref(localStorage.getItem('sortKey') || "name");
const sortOrder = ref(localStorage.getItem('sortOrder') || "asc");

watch(sortKey, (val) => {
  try { localStorage.setItem('sortKey', val); } catch (e) { /* ignore */ }
});

watch(sortOrder, (val) => {
  try { localStorage.setItem('sortOrder', val); } catch (e) { /* ignore */ }
});
const searchQuery = ref("");
const showSettings = ref(false);
const selectedState = ref('all');
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

const formatDuration = (value) => {
  const s = Number(value || 0);
  if (!Number.isFinite(s) || s <= 0) return '—';
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${s}s`;
};

const getFirstValue = (obj, keys, fallback = null) => {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return fallback;
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

const activeTab = ref('Status');
const tabLoading = ref({ Status: false, Details: false, Options: false, Files: false, Peers: false, Trackers: false });
const files = ref(null);
const peers = ref(null);
const trackers = ref(null);

const fetchTabData = async (tab) => {
  const id = selectedTorrent.value?.id;
  if (!id) return;
  try {
    tabLoading.value[tab] = true;
    await client.login();
    if (tab === 'Files' && files.value === null) {
      const res = await client.getTorrentFiles(id);
      files.value = res.files || res || [];
    }
    if (tab === 'Peers' && peers.value === null) {
      const res = await client.getTorrentPeers(id);
      peers.value = res || [];
    }
    if (tab === 'Trackers' && trackers.value === null) {
      // getTorrentTrackers returns status with trackers field
      const res = await client.getTorrentTrackers(id);
      trackers.value = (res && res.trackers) || res || [];
    }
  } catch (e) {
    console.error('Failed to load tab data', tab, e);
  } finally {
    tabLoading.value[tab] = false;
  }
};

const selectTorrent = async (torrent) => {
  try {
    // toggle off if clicking the currently selected torrent
    if (selectedTorrent.value?.id === torrent.id) {
      selectedTorrent.value = null;
      return;
    }

    await client.login();
    // fetch expanded torrent status from the backend
    const det = await client.getTorrentStatus(torrent.id);

    // normalize speeds and merge with brief torrent info
    const normalized = {
      id: torrent.id,
      name: det.name ?? torrent.name,
      state: det.state ?? torrent.state,
      progress: det.progress ?? torrent.progress,
      total_size: det.total_size ?? torrent.total_size,
      total_done: det.total_done ?? torrent.total_done,
      total_uploaded: det.total_uploaded ?? torrent.total_uploaded,
      download_speed: det.download_payload_rate ?? det.download_speed ?? torrent.download_speed ?? 0,
      upload_speed: det.upload_payload_rate ?? det.upload_speed ?? torrent.upload_speed ?? 0,
      eta: det.eta ?? torrent.eta,
      time_added: det.time_added ?? torrent.time_added,
      // include all returned properties so template can access them
      ...det,
    };

    // reset tab-specific caches
    files.value = null;
    peers.value = null;
    trackers.value = null;
    activeTab.value = 'Status';

    // if det included nested arrays for files/peers/trackers, seed them
    if (det.files) files.value = det.files;
    if (det.peers) peers.value = det.peers;
    if (det.trackers) trackers.value = det.trackers;

    selectedTorrent.value = normalized;
  } catch (error) {
    console.error('Failed to load torrent details:', error);
    // fallback to the lightweight torrent object
    selectedTorrent.value = torrent;
  }
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

// Sidebar counts by torrent state
const activeCount = computed(() => {
  return torrents.value.filter((t) => {
    const s = String(t.state || '').toLowerCase();
    return Number(t.download_speed || 0) > 0 || Number(t.upload_speed || 0) > 0;
  }).length;
});

const downloadingCount = computed(() => {
  return torrents.value.filter((t) => {
    const s = String(t.state || '').toLowerCase();
    return s.includes('downloading');
  }).length;
});

const checkingCount = computed(() => {
  return torrents.value.filter((t) => {
    const s = String(t.state || '').toLowerCase();
    return s.includes('checking');
  }).length;
});

const errorCount = computed(() => {
  return torrents.value.filter((t) => {
    const s = String(t.state || '').toLowerCase();
    return s.includes('error');
  }).length;
});

const seedingCount = computed(() => {
  return torrents.value.filter((t) => String(t.state || '').toLowerCase().includes('seeding')).length;
});

const pausedCount = computed(() => {
  return torrents.value.filter((t) => {
    const s = String(t.state || '').toLowerCase();
    return s.includes('pause') || s.includes('paused') || s.includes('stopped');
  }).length;
});

const filteredTorrents = () => {
  const query = searchQuery.value.trim().toLowerCase();
  const source = query
    ? torrents.value.filter((torrent) => {
        const name = String(torrent.name || "").toLowerCase();
        const state = String(torrent.state || "").toLowerCase();
        return name.includes(query) || state.includes(query);
      })
    : torrents.value;

  // filter by selected sidebar state
  const stateFiltered = source.filter((t) => {
    if (selectedState.value === 'all') return true;
    const s = String(t.state || '').toLowerCase();
    const dl = Number(t.download_speed || 0);
    const ul = Number(t.upload_speed || 0);

    switch (selectedState.value) {
      case 'active':
        return dl > 0 || ul > 0;
      case 'downloading':
        return s.includes('downloading') || (dl > 0 && !s.includes('seeding'));
      case 'checking':
        return s.includes('checking');
      case 'seeding':
        return s.includes('seeding');
      case 'paused':
        return s.includes('pause') || s.includes('paused') || s.includes('stopped') || s.includes('queued');
      case 'error':
        return s.includes('error');
      default:
        return true;
    }
  });

  const sorted = [...stateFiltered];
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
      if (updated) {
        // Merge updated lightweight fields into the existing detailed selectedTorrent
        // so we don't lose fields that were fetched via getTorrentStatus()
        selectedTorrent.value = {
          ...selectedTorrent.value,
          ...normalizeTorrentData(updated),
        };
      } else {
        selectedTorrent.value = normalizeTorrentData(selectedTorrent.value);
      }
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
          <button class="sidebar-button" :class="{ active: selectedState === 'all' }" @click="selectedState = 'all'">All ({{ torrents.length }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'active' }" @click="selectedState = 'active'">Active ({{ activeCount }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'checking' }" @click="selectedState = 'checking'">Checking ({{ checkingCount }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'downloading' }" @click="selectedState = 'downloading'">Downloading ({{ downloadingCount }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'seeding' }" @click="selectedState = 'seeding'">Seeding ({{ seedingCount }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'paused' }" @click="selectedState = 'paused'">Paused ({{ pausedCount }})</button>
          <button class="sidebar-button" :class="{ active: selectedState === 'error' }" @click="selectedState = 'error'">Error ({{ errorCount }})</button>
      </div>

      <div class="sidebar-section">
        <h4>Trackers</h4>
        <button class="sidebar-button" @click="selectedTracker = null">Trackers ({{ torrents.length }})</button>
      </div>

      <div class="sidebar-section">
        <h4>Owner</h4>
        <button class="sidebar-button" @click="selectedOwner = 'admin'">Admin ({{ torrents.length }})</button>
      </div>
    </div>

    <!-- TOP TOOLBAR -->
     <!-- 
    <div class="torrent-toolbar">
      <div>
        <h2>Torrents</h2>
        <p>{{ torrents.length }} active torrents</p>
      </div>
    </div>
     -->

    <!-- ACTION BAR BELOW TOOLBAR -->
    <div class="torrent-toolbar">
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

    <!-- DETAILS PANEL (Tabbed) -->
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

        <div class="details-tabs">
          <button
            v-for="tab in ['Status','Details','Options','Files','Peers','Trackers']"
            :key="tab"
            :class="['details-tab', { active: activeTab === tab } ]"
            @click="() => { activeTab = tab; fetchTabData(tab); }"
          >
            {{ tab }}
          </button>
        </div>

        <div class="details-body">
          <div v-show="activeTab === 'Status'" class="tab-panel status-panel">
            <div class="details-grid">
              <div>
                <span class="detail-label">Downloaded</span>
                <strong>{{ formatBytes(getFirstValue(selectedTorrent, ['total_done','downloaded','downloaded_bytes'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Down Speed</span>
                <strong>{{ formatSpeed(getFirstValue(selectedTorrent, ['download_payload_rate','download_speed','download_rate'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Seeds</span>
                <strong>
                  {{ getFirstValue(selectedTorrent, ['num_seeds','seeds','num_seeds_live'], '—') }}
                  ({{ getFirstValue(selectedTorrent, ['total_seeds','seeds_total'], '—') }})
                </strong>
              </div>

              <div>
                <span class="detail-label">Active Time</span>
                <strong>{{ formatDuration(getFirstValue(selectedTorrent, ['active_time','time_active','active_seconds'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Uploaded</span>
                <strong>{{ formatBytes(getFirstValue(selectedTorrent, ['total_uploaded','uploaded'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Up Speed</span>
                <strong>{{ formatSpeed(getFirstValue(selectedTorrent, ['upload_payload_rate','upload_speed','upload_rate'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Peers</span>
                <strong>
                  {{ getFirstValue(selectedTorrent, ['num_peers','peers','num_peers_live'], '—') }}
                  ({{ getFirstValue(selectedTorrent, ['total_peers','peers_total'], '—') }})
                </strong>
              </div>

              <div>
                <span class="detail-label">Seeding Time</span>
                <strong>{{ formatDuration(getFirstValue(selectedTorrent, ['seeding_time','seed_time','time_seeding'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Share Ratio</span>
                <strong>{{ getFirstValue(selectedTorrent, ['ratio','share_ratio'], null) !== null ? Number(getFirstValue(selectedTorrent, ['ratio','share_ratio'])).toFixed(3) : '—' }}</strong>
              </div>

              <div>
                <span class="detail-label">ETA</span>
                <strong>{{ formatEta(getFirstValue(selectedTorrent, ['eta'], null)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Availability</span>
                <strong>{{ getFirstValue(selectedTorrent, ['distributed_copies','availability','availability_text'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Last Transfer</span>
                <strong>{{ getFirstValue(selectedTorrent, ['last_transfer','last_seen_transfer','last_seen_complete'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Next Announce</span>
                <strong>{{ getFirstValue(selectedTorrent, ['next_announce','next_announce_in','tracker_next_announce'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Pieces</span>
                <strong>
                  {{ getFirstValue(selectedTorrent, ['pieces','num_pieces'], '—') }}
                  ({{ formatBytes(getFirstValue(selectedTorrent, ['piece_length','piece_size'], 0)) }})
                </strong>
              </div>

              <div>
                <span class="detail-label">Auto Managed</span>
                <strong>{{ String(getFirstValue(selectedTorrent, ['is_auto_managed','auto_managed'], getFirstValue(selectedTorrent, ['is_auto_managed'], '—'))) }}</strong>
              </div>

              <div>
                <span class="detail-label">Tracker Status</span>
                <strong>{{ getFirstValue(selectedTorrent, ['tracker_status','tracker_state','tracker_status_message','tracker_status_msg'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Seed Rank</span>
                <strong>{{ getFirstValue(selectedTorrent, ['seed_rank','seed_rank_value','seedrank'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Date Added</span>
                <strong>{{ formatDate(getFirstValue(selectedTorrent, ['time_added','date_added'], null)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Complete Seen</span>
                <strong>{{ formatDate(getFirstValue(selectedTorrent, ['last_seen_complete','complete_seen'], null)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Completed</span>
                <strong>{{ formatDate(getFirstValue(selectedTorrent, ['completed_time','time_completed'], null)) }}</strong>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'Details'" class="tab-panel details-panel-tab">
            <div class="details-grid">
              <div>
                <span class="detail-label">Name</span>
                <strong>{{ getFirstValue(selectedTorrent, ['name','torrent_name'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Hash</span>
                <strong>{{ getFirstValue(selectedTorrent, ['hash','torrent_hash','infohash'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Download Folder</span>
                <strong>{{ getFirstValue(selectedTorrent, ['download_location','download_location_path','download_folder'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Total Size</span>
                <strong>{{ formatBytes(getFirstValue(selectedTorrent, ['total_size','size','total_bytes'], 0)) }}</strong>
              </div>

              <div>
                <span class="detail-label">Total Files</span>
                <strong>{{ getFirstValue(selectedTorrent, ['total_files','num_files','file_count'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Comment</span>
                <strong>{{ getFirstValue(selectedTorrent, ['comment','comments','description'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Status</span>
                <strong>{{ getFirstValue(selectedTorrent, ['tracker_status','status','state'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Tracker</span>
                <strong>{{ getFirstValue(selectedTorrent, ['tracker_host','tracker','trackers','announce'], '—') }}</strong>
              </div>

              <div>
                <span class="detail-label">Created By</span>
                <strong>{{ getFirstValue(selectedTorrent, ['created_by','creator','created_by_user'], '—') }}</strong>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'Options'" class="tab-panel options-panel">
            <p>Options (read-only)</p>
            <div class="details-grid">
              <div>
                <span class="detail-label">Max Download</span>
                <strong>{{ selectedTorrent.max_download_speed ? formatSpeed(selectedTorrent.max_download_speed) : '—' }}</strong>
              </div>
              <div>
                <span class="detail-label">Max Upload</span>
                <strong>{{ selectedTorrent.max_upload_speed ? formatSpeed(selectedTorrent.max_upload_speed) : '—' }}</strong>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'Files'" class="tab-panel files-panel">
            <div v-if="tabLoading.Files">Loading files…</div>
            <div v-else>
              <ul>
                <li v-for="(f, idx) in files || selectedTorrent.files || []" :key="idx">
                  {{ f.path || f[0] }} — {{ formatBytes(f.length || f[1] || 0) }}
                </li>
              </ul>
            </div>
          </div>

          <div v-show="activeTab.value === 'Peers'" class="tab-panel peers-panel">
            <div v-if="tabLoading.Peers">Loading peers…</div>
            <div v-else>
              <ul>
                <li v-for="(p, idx) in peers || selectedTorrent.peers || []" :key="idx">
                  {{ p.ip || p.host || p.address }} — {{ p.client || p.client_name || p.client_version || 'peer' }}
                </li>
              </ul>
            </div>
          </div>

          <div v-show="activeTab === 'Trackers'" class="tab-panel trackers-panel">
            <div v-if="tabLoading.Trackers">Loading trackers…</div>
            <div v-else>
              <ul>
                <li v-for="(t, idx) in trackers || selectedTorrent.trackers || []" :key="idx">
                  {{ t.url || t[0] || t.tracker }} — {{ t.status || t[1] || '—' }}
                </li>
              </ul>
            </div>
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

<style scoped>
/* Active state for sidebar buttons */
.sidebar-button.active {
  background-color: var(--accent, #2563eb);
  color: #fff;
  border-left: 4px solid rgba(255,255,255,0.12);
}

.sidebar-button {
  transition: background-color 120ms ease, color 120ms ease;
}

.details-panel {
  width: 360px;
  border-left: 1px solid rgba(0,0,0,0.06);
  background: #ffffff;
  color: #111827;
  overflow: auto;
}

/* Layout: sidebar | content | details */
.torrent-page {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.sidebar {
  flex: 0 0 220px;
  max-width: 220px;
}

.content-shell {
  flex: 1 1 0;
  min-width: 0; /* allow child overflow handling */
}

.details-panel {
  flex: 0 0 360px;
  max-height: calc(100vh - 120px);
  position: sticky;
  top: 8px;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.details-tabs {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}

.details-tab {
  background: transparent;
  border: none;
  color: #374151;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.details-tab.active {
  background: rgba(37,99,235,0.08);
  color: #0f172a;
  box-shadow: inset 0 -2px 0 var(--accent, #2563eb);
}

.details-body { padding: 12px; }
.tab-panel { display: block; }
.details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

.files-panel ul, .peers-panel ul, .trackers-panel ul { list-style: none; margin: 0; padding: 0; }
.files-panel li, .peers-panel li, .trackers-panel li { padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); color: #374151; }
</style>


<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

// Child components
import Peers from "./Peers.vue";
import Trackers from "./Trackers.vue";
import FileTree from "./FileTree.vue";

const props = defineProps({
    torrentId: String
});

const client = new DelugeClient();

// Main data objects
const details = ref(null);
const files = ref([]);
const peers = ref([]);
const trackers = ref([]);

// Fetch all torrent details
async function loadDetails() {
    await client.login();

  details.value = await client.getTorrentStatus(props.torrentId);
  try {
    console.log('getTorrentStatus result for', props.torrentId, details.value);
    console.log(JSON.stringify(details.value, null, 2));
  } catch (e) {
    // ignore
  }
    files.value = await client.getTorrentFiles(props.torrentId);
    peers.value = await client.getTorrentPeers(props.torrentId);

    const trackerData = await client.getTorrentTrackers(props.torrentId);
    trackers.value = trackerData.trackers || [];
}

// Action buttons
async function pause() {
    await client.pauseTorrent(props.torrentId);
    await loadDetails();
}

async function resume() {
    await client.resumeTorrent(props.torrentId);
    await loadDetails();
}

async function remove() {
    await client.removeTorrent(props.torrentId);
    // TODO: emit event to close details panel
}

async function removeData() {
    await client.removeTorrentAndData(props.torrentId);
    // TODO: emit event to close details panel
}

const torrentDL = ref(0);
const torrentUL = ref(0);

async function applyTorrentLimits() {
    await client.setTorrentSpeedLimits(
        props.torrentId,
        torrentDL.value * 1024,
        torrentUL.value * 1024
    );
    await loadDetails();
}

async function queueTop() {
    await client.queueTop(props.torrentId);
    await loadDetails();
}

async function queueUp() {
    await client.queueUp(props.torrentId);
    await loadDetails();
}

async function queueDown() {
    await client.queueDown(props.torrentId);
    await loadDetails();
}

async function queueBottom() {
    await client.queueBottom(props.torrentId);
    await loadDetails();
}

onMounted(loadDetails);

// Formatting helpers
const formatBytes = (v) => {
  const bytes = Number(v ?? 0);
  if (!Number.isFinite(bytes) || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB','MB','GB','TB'];
  let size = bytes / 1024; let i = 0;
  while (size >= 1024 && i < units.length-1) { size /= 1024; i++; }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatSpeed = (v) => {
  if (v == null) return '—';
  const n = Number(v || 0);
  return `${formatBytes(n)}/s`;
};

const formatDate = (secs) => {
  if (!secs && secs !== 0) return '—';
  try {
    const d = new Date(Number(secs) * 1000);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  } catch (e) { return '—'; }
};

const formatMaybe = (v) => (v === null || v === undefined) ? '—' : String(v);
</script>

<template>
  <div class="torrent-details" v-if="details">

    <h2>{{ details.name }}</h2>

    <!-- Action Buttons -->
    <div class="actions">
      <button @click="pause">Pause</button>
      <button @click="resume">Resume</button>
      <button @click="remove">Remove</button>
      <button class="danger" @click="removeData">Remove + Delete Data</button>
    </div>

    <!-- Per-Torrent Speed Limits -->
    <div class="torrent-limits">
      <h3>Speed Limits</h3>
    
      <label>
        Download (KB/s):
        <input type="number" v-model="torrentDL" />
      </label>
    
      <label>
        Upload (KB/s):
        <input type="number" v-model="torrentUL" />
      </label>
    
      <button @click="applyTorrentLimits">Apply</button>
    </div>

    <!-- Queue Controls -->
    <div class="queue-controls">
      <h3>Queue Position</h3>
    
      <button @click="queueTop">Top</button>
      <button @click="queueUp">Up</button>
      <button @click="queueDown">Down</button>
      <button @click="queueBottom">Bottom</button>
    </div>

    <!-- Stats -->
    <div class="stats">
      <p><strong>Progress:</strong> {{ details.progress != null ? Number(details.progress).toFixed(1) + '%' : '—' }}</p>
      <p><strong>Download (payload):</strong> {{ formatSpeed(details.download_payload_rate ?? details.download_speed) }}</p>
      <p><strong>Upload (payload):</strong> {{ formatSpeed(details.upload_payload_rate ?? details.upload_speed) }}</p>
      <p><strong>ETA:</strong> {{ details.eta != null ? details.eta : '—' }}</p>
      <p><strong>Ratio:</strong> {{ details.ratio != null ? Number(details.ratio).toFixed(2) : '—' }}</p>
      <p><strong>Seeds:</strong> {{ formatMaybe(details.num_seeds) }} (total_seeds: {{ formatMaybe(details.total_seeds) }})</p>
      <p><strong>Peers:</strong> {{ formatMaybe(details.num_peers) }} (total_peers: {{ formatMaybe(details.total_peers) }})</p>
      <p><strong>Total Size:</strong> {{ details.total_size ? formatBytes(details.total_size) : '—' }}</p>
      <p><strong>Total Done:</strong> {{ details.total_done ? formatBytes(details.total_done) : '—' }}</p>
      <p><strong>Total Uploaded:</strong> {{ details.total_uploaded ? formatBytes(details.total_uploaded) : '—' }}</p>
      <p><strong>Total Wanted:</strong> {{ details.total_wanted ? formatBytes(details.total_wanted) : '—' }}</p>
      <p><strong>Total Remaining:</strong> {{ details.total_remaining ? formatBytes(details.total_remaining) : '—' }}</p>
      <p><strong>Download Location:</strong> {{ details.download_location || details.download_location_path || '—' }}</p>
      <p><strong>Queue Position:</strong> {{ formatMaybe(details.queue) }}</p>
      <p><strong>Max Download Speed:</strong> {{ details.max_download_speed ? formatSpeed(details.max_download_speed) : '—' }}</p>
      <p><strong>Max Upload Speed:</strong> {{ details.max_upload_speed ? formatSpeed(details.max_upload_speed) : '—' }}</p>
      <p><strong>Time Added:</strong> {{ formatDate(details.time_added) }}</p>
      <p><strong>Completed Time:</strong> {{ formatDate(details.completed_time) }}</p>
      <p><strong>Time Since Transfer:</strong> {{ formatMaybe(details.time_since_transfer) }}</p>
      <p><strong>Last Seen Complete:</strong> {{ formatDate(details.last_seen_complete) }}</p>
      <p><strong>Distributed Copies:</strong> {{ formatMaybe(details.distributed_copies) }}</p>
      <p><strong>Auto Managed:</strong> {{ details.is_auto_managed != null ? String(details.is_auto_managed) : '—' }}</p>
      <p><strong>Tracker Host:</strong> {{ formatMaybe(details.tracker_host) }}</p>
      <p><strong>Seeds/Peers Ratio:</strong> {{ formatMaybe(details.seeds_peers_ratio) }}</p>
      <p><strong>Trackers:</strong> {{ trackers.length }}</p>
      <p><strong>Peers (live):</strong> {{ peers.length }}</p>
      <p><strong>Files:</strong> {{ files.length }}</p>
    </div>

    <!-- File Tree -->
    <FileTree :torrentId="props.torrentId" />

    <!-- Peers -->
    <Peers :torrentId="props.torrentId" />

    <!-- Trackers -->
    <Trackers :torrentId="props.torrentId" />

  </div>
</template>

<style scoped>
.torrent-details {
  padding: 1rem;
}
.stats p {
  margin: 0.2rem 0;
}
.actions {
  margin: 1rem 0;
  display: flex;
  gap: 0.5rem;
}
.actions button {
  padding: 0.4rem 0.8rem;
  border: none;
  background: #e5e7eb;
  cursor: pointer;
  border-radius: 4px;
}
.actions button:hover {
  background: #d1d5db;
}
.actions .danger {
  background: #ef4444;
  color: white;
}
.actions .danger:hover {
  background: #dc2626;
}
.torrent-limits {
  margin: 1rem 0;
}
.torrent-limits input {
  margin-left: 0.5rem;
  width: 80px;
}
.queue-controls button {
  margin-right: 0.5rem;
}
</style>

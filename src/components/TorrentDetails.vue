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
      <p><strong>Progress:</strong> {{ details.progress.toFixed(1) }}%</p>
      <p><strong>Download:</strong> {{ (details.download_speed / 1024).toFixed(1) }} KB/s</p>
      <p><strong>Upload:</strong> {{ (details.upload_speed / 1024).toFixed(1) }} KB/s</p>
      <p><strong>ETA:</strong> {{ details.eta }}</p>
      <p><strong>Ratio:</strong> {{ details.ratio.toFixed(2) }}</p>
      <p><strong>Seeds:</strong> {{ details.num_seeds }}</p>
      <p><strong>Peers:</strong> {{ details.num_peers }}</p>
      <p><strong>Total Size:</strong> {{ (details.total_size / 1024 / 1024).toFixed(2) }} MB</p>
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

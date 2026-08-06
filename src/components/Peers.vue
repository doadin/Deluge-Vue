<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

const props = defineProps({
    torrentId: String
});

const client = new DelugeClient();
const peers = ref([]);

onMounted(async () => {
    await client.login();
    peers.value = await client.getTorrentPeers(props.torrentId);
});
</script>

<template>
  <div class="peers">
    <h3>Peers</h3>

    <table>
      <thead>
        <tr>
          <th>IP</th>
          <th>Client</th>
          <th>Progress</th>
          <th>DL Speed</th>
          <th>UL Speed</th>
          <th>Seed?</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="peer in peers" :key="peer.ip">
          <td>{{ peer.ip }}</td>
          <td>{{ peer.client }}</td>
          <td>{{ (peer.progress * 100).toFixed(1) }}%</td>
          <td>{{ (peer.download_speed / 1024).toFixed(1) }} KB/s</td>
          <td>{{ (peer.upload_speed / 1024).toFixed(1) }} KB/s</td>
          <td>{{ peer.seed ? "Yes" : "No" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.peers {
  margin-top: 1rem;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 0.4rem;
  border-bottom: 1px solid #ddd;
}
thead {
  background: #f3f4f6;
}
</style>

<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

const props = defineProps({
    torrentId: String
});

const client = new DelugeClient();
const trackers = ref([]);

onMounted(async () => {
    await client.login();
    const data = await client.getTorrentTrackers(props.torrentId);
    trackers.value = data.trackers || [];
});
</script>

<template>
  <div class="trackers">
    <h3>Trackers</h3>

    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Tier</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="tracker in trackers" :key="tracker.url">
          <td>{{ tracker.url }}</td>
          <td>{{ tracker.status }}</td>
          <td>{{ tracker.tier }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.trackers {
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

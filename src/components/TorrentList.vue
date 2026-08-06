<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

const client = new DelugeClient("http://localhost:8112", "deluge");
const torrents = ref([]);

onMounted(async () => {
  await client.login();
  const data = await client.getTorrents();
  torrents.value = Object.values(data.torrents);
});
</script>

<template>
  <div>
    <h2>Torrents</h2>
    <ul>
      <li
        v-for="(t, id) in torrents"
        :key="id"
        @click="$emit('select', id)"
      >
        {{ t.name }} — {{ t.progress.toFixed(1) }}%
      </li>
    </ul>
  </div>
</template>

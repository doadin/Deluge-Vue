<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";

const client = new DelugeClient();

const available = ref([]);
const enabled = ref([]);

async function loadPlugins() {
    await client.login();
    available.value = await client.getPlugins();
    enabled.value = await client.getEnabledPlugins();
}

function isEnabled(name) {
    return enabled.value.includes(name);
}

async function toggle(name) {
    if (isEnabled(name)) {
        await client.disablePlugin(name);
        enabled.value = enabled.value.filter(p => p !== name);
    } else {
        await client.enablePlugin(name);
        enabled.value.push(name);
    }
}

onMounted(loadPlugins);
</script>

<template>
  <div class="plugins">
    <h2>Plugins</h2>

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Enabled</th>
          <th>Toggle</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="plugin in available" :key="plugin">
          <td>{{ plugin }}</td>
          <td>{{ isEnabled(plugin) ? "Yes" : "No" }}</td>
          <td>
            <button @click="toggle(plugin)">
              {{ isEnabled(plugin) ? "Disable" : "Enable" }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.plugins {
  padding: 1rem;
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
button {
  padding: 0.3rem 0.6rem;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #2563eb;
}
</style>

<script setup>
import { ref } from "vue";
import DelugeClient from "../rpc/delugeClient";

const client = new DelugeClient();

const globalDL = ref(0);
const globalUL = ref(0);

async function pauseAll() {
    await client.globalPause();
}

async function resumeAll() {
    await client.globalResume();
}

async function applyGlobalLimits() {
    await client.setGlobalSpeedLimits(
        globalDL.value * 1024,   // KB/s → bytes/s
        globalUL.value * 1024
    );
}
</script>

<template>
  <div class="global-controls">
    <h3>Global Controls</h3>

    <div class="buttons">
      <button @click="pauseAll">Pause All</button>
      <button @click="resumeAll">Resume All</button>
    </div>

    <h4>Global Speed Limits</h4>
    <div class="limits">
      <label>
        Download (KB/s):
        <input type="number" v-model="globalDL" />
      </label>

      <label>
        Upload (KB/s):
        <input type="number" v-model="globalUL" />
      </label>

      <button @click="applyGlobalLimits">Apply</button>
    </div>
  </div>
</template>

<style scoped>
.global-controls {
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f3f4f6;
  border-radius: 8px;
}
.buttons button {
  margin-right: 0.5rem;
}
.limits {
  margin-top: 0.5rem;
}
input {
  margin-left: 0.5rem;
  width: 80px;
}
</style>

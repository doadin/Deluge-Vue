<script setup>
import { ref } from "vue";
import DelugeClient from "../rpc/delugeClient";

const show = ref(false);
const magnet = ref("");
const file = ref(null);
const client = new DelugeClient();

function open() {
    show.value = true;
}

function close() {
    show.value = false;
    magnet.value = "";
    file.value = null;
}

async function addMagnetLink() {
    if (!magnet.value) return;
    await client.login();
    await client.addMagnet(magnet.value);
    close();
}

async function addTorrentFile() {
    if (!file.value) return;

    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = reader.result.split(",")[1];
        await client.login();
        await client.addTorrentFile(base64, file.value.name);
        close();
    };
    reader.readAsDataURL(file.value);
}
</script>

<template>
  <div>
    <button @click="open">Add Torrent</button>

    <div v-if="show" class="modal">
      <div class="modal-content">

        <h2>Add Torrent</h2>

        <!-- Magnet Link -->
        <div class="section">
          <h3>Magnet Link</h3>
          <input
            type="text"
            v-model="magnet"
            placeholder="magnet:?xt=urn:btih:..."
          />
          <button @click="addMagnetLink">Add Magnet</button>
        </div>

        <!-- Torrent File -->
        <div class="section">
          <h3>.torrent File</h3>
          <input
            type="file"
            @change="e => file.value = e.target.files[0]"
          />
          <button @click="addTorrentFile">Upload File</button>
        </div>

        <button class="close" @click="close">Close</button>

      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: white;
  padding: 1.5rem;
  width: 400px;
  border-radius: 8px;
}
.section {
  margin-bottom: 1rem;
}
.close {
  margin-top: 1rem;
}
</style>

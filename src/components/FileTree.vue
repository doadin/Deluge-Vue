<script setup>
import { ref, onMounted } from "vue";
import DelugeClient from "../rpc/delugeClient";
import { buildFileTree } from "../utils/buildFileTree";

const props = defineProps({
    torrentId: String
});

const client = new DelugeClient();
const tree = ref({});
const flatFiles = ref([]);

async function loadFiles() {
    await client.login();
    const files = await client.getTorrentFiles(props.torrentId);

    flatFiles.value = files;
    tree.value = buildFileTree(files);
}

function togglePriority(fileIndex, newPriority) {
    const priorities = flatFiles.value.map(f => f.priority);
    priorities[fileIndex] = newPriority;
    client.setFilePriorities(props.torrentId, priorities);
    flatFiles.value[fileIndex].priority = newPriority;
}

onMounted(loadFiles);
</script>

<template>
  <div class="file-tree">
    <h3>Files</h3>

    <ul>
      <TreeNode
        v-for="(node, name) in tree"
        :key="name"
        :name="name"
        :node="node"
        @setPriority="togglePriority"
      />
    </ul>
  </div>
</template>

<style scoped>
.file-tree {
  margin-top: 1rem;
}
ul {
  list-style: none;
  padding-left: 1rem;
}
</style>

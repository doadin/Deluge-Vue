<script setup>
const props = defineProps({
    name: String,
    node: Object
});

const emit = defineEmits(["setPriority"]);

function isFile(n) {
    return n.__file !== null;
}
</script>

<template>
  <li>
    <div class="entry">
      <strong>{{ name }}</strong>

      <!-- File -->
      <template v-if="isFile(node)">
        <span>
          — {{ (node.__file.size / 1024 / 1024).toFixed(2) }} MB
          — {{ (node.__file.progress * 100).toFixed(1) }}%
        </span>

        <select
          :value="node.__file.priority"
          @change="emit('setPriority', node.__index, Number($event.target.value))"
        >
          <option value="0">Skip</option>
          <option value="1">Normal</option>
          <option value="2">High</option>
        </select>
      </template>
    </div>

    <!-- Folder -->
    <ul v-if="Object.keys(node.__children).length">
      <TreeNode
        v-for="(child, childName) in node.__children"
        :key="childName"
        :name="childName"
        :node="child"
        @setPriority="emit('setPriority', $event[0], $event[1])"
      />
    </ul>
  </li>
</template>

<style scoped>
.entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
select {
  margin-left: 0.5rem;
}
</style>

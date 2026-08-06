<script setup>
import { useThemeStore } from "../store/theme";

const themeStore = useThemeStore();

function cycleTheme() {
  if (themeStore.theme === "light") themeStore.setTheme("dark");
  else if (themeStore.theme === "dark") themeStore.setTheme("auto");
  else themeStore.setTheme("light");
}

function label() {
  if (themeStore.theme === "light") return "Light";
  if (themeStore.theme === "dark") return "Dark";
  return "Auto";
}
</script>

<template>
  <button class="theme-toggle" @click="cycleTheme">
    Theme: {{ label() }}
  </button>
</template>

<style scoped>
.theme-toggle {
  padding: 0.4rem 0.8rem;
  background: var(--primary);
  color: var(--bg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.theme-toggle:hover {
  background: var(--primary-hover);
}
</style>

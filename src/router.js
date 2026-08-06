import { createRouter, createWebHistory } from "vue-router";
import Settings from "./components/Settings.vue";
import TorrentList from "./components/TorrentList.vue";

const routes = [
  {
    path: "/",
    component: TorrentList,
  },
  {
    path: "/settings",
    component: Settings,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

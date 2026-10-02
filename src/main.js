import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import Tonight from "./views/Tonight.vue";
import Library from "./views/Library.vue";
import Favorites from "./views/Favorites.vue";
import Settings from "./views/Settings.vue";
import Cooking from "./views/Cooking.vue";
import "./style.css";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Tonight },
    { path: "/recipes", component: Library },
    { path: "/favorites", component: Favorites },
    { path: "/me", component: Settings },
    { path: "/cook/:id", component: Cooking },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
createApp(App).use(router).mount("#app");

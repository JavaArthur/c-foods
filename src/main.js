import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import Tonight from "./views/Tonight.vue";
import "./style.css";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Tonight },
    { path: "/breakfast", component: () => import("./views/Breakfast.vue") },
    { path: "/drinks", component: () => import("./views/Drinks.vue") },
    { path: "/recipes", component: () => import("./views/Library.vue") },
    { path: "/favorites", component: () => import("./views/Favorites.vue") },
    { path: "/timers", component: () => import("./views/Timers.vue") },
    { path: "/me", component: () => import("./views/Settings.vue") },
    { path: "/cook/:id", component: () => import("./views/Cooking.vue") },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
createApp(App).use(router).mount("#app");

import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", name: "home", component: () => import("@/views/HomeView.vue"), meta: { title: "TOSCAN" } },
    { path: "/blocks", name: "blocks", component: () => import("@/views/BlocksView.vue"), meta: { title: "Blocks" } },
    {
      path: "/block/:workchain/:shard/:seqno",
      name: "block",
      component: () => import("@/views/BlockDetailView.vue"),
      meta: { title: "Block" },
    },
    { path: "/transactions", name: "transactions", component: () => import("@/views/TransactionsView.vue"), meta: { title: "Transactions" } },
    {
      path: "/tx/:account/:lt/:hash",
      name: "transaction",
      component: () => import("@/views/TransactionDetailView.vue"),
      meta: { title: "Transaction" },
    },
    { path: "/address/:address", name: "address", component: () => import("@/views/AddressView.vue"), meta: { title: "Address" } },
    { path: "/token/:address", name: "token", component: () => import("@/views/TokenDetailView.vue"), meta: { title: "Token" } },
    { path: "/agents", name: "agents", component: () => import("@/views/AgentsView.vue"), meta: { title: "Agents" } },
    { path: "/agent/:address", name: "agent", component: () => import("@/views/AgentDetailView.vue"), meta: { title: "Agent" } },
    { path: "/tasks", name: "tasks", component: () => import("@/views/TasksView.vue"), meta: { title: "Tasks" } },
    { path: "/disputes", name: "disputes", component: () => import("@/views/DisputesView.vue"), meta: { title: "Disputes" } },
    { path: "/task/:address", name: "task", component: () => import("@/views/TaskDetailView.vue"), meta: { title: "Task" } },
    { path: "/services", name: "services", component: () => import("@/views/ServicesView.vue"), meta: { title: "Services" } },
    { path: "/service/:address", name: "service", component: () => import("@/views/ServiceDetailView.vue"), meta: { title: "Service" } },
    { path: "/dispute/:address", name: "dispute", component: () => import("@/views/DisputeDetailView.vue"), meta: { title: "Dispute" } },
    { path: "/network", name: "network", component: () => import("@/views/NetworkView.vue"), meta: { title: "Network" } },
    { path: "/search", name: "search", component: () => import("@/views/SearchView.vue"), meta: { title: "Search" } },
    { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("@/views/NotFoundView.vue"), meta: { title: "Not found" } },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "Explorer";
  document.title = title === "TOSCAN" ? "TOSCAN — TOS Network Explorer" : `${title} — TOSCAN`;
});

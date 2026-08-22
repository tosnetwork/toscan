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
    { path: "/message/:hash", name: "message", component: () => import("@/views/MessageDetailView.vue"), meta: { title: "Message" } },
    { path: "/address/:address", name: "address", component: () => import("@/views/AddressView.vue"), meta: { title: "Address" } },
    { path: "/token/:address", name: "token", component: () => import("@/views/TokenDetailView.vue"), meta: { title: "Token" } },
    { path: "/assets", name: "assets", component: () => import("@/views/AssetsView.vue"), meta: { title: "Assets" } },
    { path: "/assets/activity", name: "asset-activity", component: () => import("@/views/AssetActivityView.vue"), meta: { title: "Asset activity", description: "Node-verified Jetton and NFT ownership observations on TOS Network." } },
    { path: "/domains", name: "domains", component: () => import("@/views/DomainsView.vue"), meta: { title: ".tos domains", description: "Checkpoint-bound .tos auctions, leases and record commitments." } },
    { path: "/domain/:name", name: "domain", component: () => import("@/views/DomainDetailView.vue"), meta: { title: ".tos domain" } },
    { path: "/contracts/verified", name: "verified-contracts", component: () => import("@/views/VerifiedContractsView.vue"), meta: { title: "Verified contracts", description: "Reproducible contract builds matched against deployed TOS code." } },
    { path: "/contracts/verified/:address", name: "verified-contract", component: () => import("@/views/VerificationDetailView.vue"), meta: { title: "Verified contract" } },
    { path: "/agents", name: "agents", component: () => import("@/views/AgentsView.vue"), meta: { title: "Agents" } },
    { path: "/agent/:address", name: "agent", component: () => import("@/views/AgentDetailView.vue"), meta: { title: "Agent" } },
    { path: "/tasks", name: "tasks", component: () => import("@/views/TasksView.vue"), meta: { title: "Tasks" } },
    { path: "/disputes", name: "disputes", component: () => import("@/views/DisputesView.vue"), meta: { title: "Disputes" } },
    { path: "/task/:address", name: "task", component: () => import("@/views/TaskDetailView.vue"), meta: { title: "Task" } },
    { path: "/services", name: "services", component: () => import("@/views/ServicesView.vue"), meta: { title: "Services" } },
    { path: "/economy", name: "economy", component: () => import("@/views/EconomyView.vue"), meta: { title: "Agent Economy" } },
    { path: "/staking", name: "staking", component: () => import("@/views/StakingView.vue"), meta: { title: "Staking" } },
    { path: "/staking/pool/:address", name: "staking-pool", component: () => import("@/views/NominatorPoolView.vue"), meta: { title: "Nominator Pool" } },
    { path: "/service/:address", name: "service", component: () => import("@/views/ServiceDetailView.vue"), meta: { title: "Service" } },
    { path: "/dispute/:address", name: "dispute", component: () => import("@/views/DisputeDetailView.vue"), meta: { title: "Dispute" } },
    { path: "/network", name: "network", component: () => import("@/views/NetworkView.vue"), meta: { title: "Network" } },
    { path: "/validators", name: "validators", component: () => import("@/views/ValidatorsView.vue"), meta: { title: "Validators" } },
    { path: "/validator/:publicKey", name: "validator", component: () => import("@/views/ValidatorDetailView.vue"), meta: { title: "Validator" } },
    { path: "/analytics", name: "analytics", component: () => import("@/views/AnalyticsView.vue"), meta: { title: "Analytics" } },
    { path: "/governance", name: "governance", component: () => import("@/views/GovernanceView.vue"), meta: { title: "Governance" } },
    { path: "/watchlist", name: "watchlist", component: () => import("@/views/WatchlistView.vue"), meta: { title: "Watchlist", description: "Private browser-local monitoring for TOS identities." } },
    { path: "/api-docs", name: "api-docs", component: () => import("@/views/ApiDocsView.vue"), meta: { title: "Explorer API", description: "Read-only TOSCAN projection API documentation." } },
    { path: "/diagnostics", name: "diagnostics", component: () => import("@/views/DiagnosticsView.vue"), meta: { title: "Browser diagnostics", description: "Private local rendering and performance diagnostics." } },
    { path: "/search", name: "search", component: () => import("@/views/SearchView.vue"), meta: { title: "Search" } },
    { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("@/views/NotFoundView.vue"), meta: { title: "Not found" } },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "Explorer";
  document.title = title === "TOSCAN" ? "TOSCAN — TOS Network Explorer" : `${title} — TOSCAN`;
  const description = typeof to.meta.description === "string"
    ? to.meta.description
    : "Inspect blocks, transactions, accounts, assets, validators and autonomous work on TOS Network.";
  const origin = (import.meta.env.VITE_PUBLIC_ORIGIN || window.location.origin).replace(/\/$/, "");
  const canonical = `${origin}${to.path}`;
  const setMeta = (selector: string, attribute: string, value: string) => {
    const element = document.head.querySelector<HTMLMetaElement>(selector);
    if (element) element.setAttribute(attribute, value);
  };
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", document.title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:url"]', "content", canonical);
  setMeta('meta[name="twitter:title"]', "content", document.title);
  setMeta('meta[name="twitter:description"]', "content", description);
  const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link) link.href = canonical;
});

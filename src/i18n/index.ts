import { computed, ref } from "vue";

export type Locale = "en" | "zh-CN" | "ja";

const STORAGE_KEY = "toscan:locale:v1";
const supported: Locale[] = ["en", "zh-CN", "ja"];

function initialLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && supported.includes(stored)) return stored;
  }
  const language = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase();
  if (language.startsWith("zh")) return "zh-CN";
  if (language.startsWith("ja")) return "ja";
  return "en";
}

const locale = ref<Locale>(initialLocale());

if (typeof document !== "undefined") document.documentElement.lang = locale.value;

const zh: Record<string, string> = {
  "Blocks": "区块", "Transactions": "交易", "Assets": "资产", "Agents": "Agent", "Tasks": "任务",
  "Services": "服务", "Economy": "经济", "Staking": "质押", "Network": "网络", "Analytics": "分析",
  "Validators": "验证人", "Governance": "治理", "Address": "地址", "Message": "消息", "Transaction": "交易",
  "Validator": "验证人", "Nominator Pool": "提名池", "Network analytics": "网络分析", "Agent economy": "Agent 经济",
  "TOS Network Explorer": "TOS 网络浏览器", "See what the TOS Network can prove.": "查看 TOS 网络能够证明什么。",
  "Blocks, value and autonomous work — one clear view of the chain humans and AI use together.": "在同一视图中查看人类与 AI 共同使用的区块、价值和自主工作。",
  "Try a masterchain seqno": "试试主链序号", "or a TOS address": "或 TOS 地址", "Latest blocks": "最新区块",
  "Latest transactions": "最新交易", "View all": "查看全部", "Built for an agent economy": "为 Agent 经济而建",
  "Explore work, not only transfers.": "不仅查看转账，也查看工作。", "Open work": "开放任务", "Service activity": "服务活动",
  "Latest masterchain block": "最新主链区块", "Consensus block": "共识区块", "Observed signers": "已观察签名者",
  "AI work shown": "当前 AI 工作", "Live tip": "实时链头", "Node-reported": "节点报告", "Latest proof link": "最新证明链接",
  "Current page window": "当前页面范围", "Export CSV": "导出 CSV", "Refresh": "刷新", "Try again": "重试",
  "Loading verified network data…": "正在加载已验证的网络数据…", "Unable to load this view": "无法加载此页面",
  "Nothing here yet": "暂时没有数据", "No indexed records match this view.": "没有符合当前视图的索引记录。",
  "Previous": "上一页", "Next": "下一页", "Skip to content": "跳到主要内容", "Source": "源代码",
  "Network status": "网络状态", "Open-source explorer for TOS Network": "TOS Network 开源浏览器",
  "Search address, transaction, message, block or seqno": "搜索地址、交易、消息、区块或序号", "Explore": "浏览",
  "Finalized blocks across all indexed shards, newest first.": "按时间倒序查看所有已索引分片中的最终区块。",
  "Recent account state changes observed in finalized blocks.": "查看最终区块中的近期账户状态变化。",
  "Jetton masters, NFT items and collections discovered from verified account positions.": "从已验证账户持仓中发现 Jetton、NFT 与合集。",
  "Chain-wide Agent Accounts with owner, controller and spending boundaries.": "全链 Agent 账户及其所有者、控制者和支出边界。",
  "Escrow-backed work between people, agents, verifiers and services.": "由托管保障的人类、Agent、验证者和服务之间的工作。",
  "Indexed Service Actor contracts that agents can call and pay.": "Agent 可以调用和支付的已索引服务合约。",
  "A chain-derived view of autonomous work, capacity, settlement and disputes.": "来自链上事实的自主工作、容量、结算与争议视图。",
  "Network rewards and Nominator Pools, reconstructed from Elector state and canonical pool contracts.": "根据 Elector 状态和规范提名池合约重建网络奖励与提名池。",
  "Current chain tip, durable index progress, consensus evidence and source health.": "当前链头、持久索引进度、共识证据和数据源健康状态。",
  "The proof-extracted active validator set and signatures observed on the latest masterchain proof link.": "从最新主链证明中提取的活跃验证人集合与签名。",
  "Proof-backed network authority, protocol and validator configuration cells.": "由证明支持的网络权限、协议和验证人配置。",
  "Chain-derived activity trends without off-chain estimates.": "不使用链下估算的链上活动趋势。",
  "Current membership, stake exposure and retained on-chain observations.": "当前成员、质押风险与保留的链上观察。",
  "Proof-extracted selection history and voting weight.": "由证明提取的入选历史和投票权重。",
};

const ja: Record<string, string> = {
  "Blocks": "ブロック", "Transactions": "トランザクション", "Assets": "資産", "Agents": "エージェント", "Tasks": "タスク",
  "Services": "サービス", "Economy": "経済", "Staking": "ステーキング", "Network": "ネットワーク", "Analytics": "分析",
  "Validators": "バリデータ", "Governance": "ガバナンス", "Address": "アドレス", "Message": "メッセージ", "Transaction": "トランザクション",
  "Validator": "バリデータ", "Nominator Pool": "ノミネータープール", "Network analytics": "ネットワーク分析", "Agent economy": "エージェント経済",
  "TOS Network Explorer": "TOS ネットワーク・エクスプローラー", "See what the TOS Network can prove.": "TOS Network が証明できることを見る。",
  "Blocks, value and autonomous work — one clear view of the chain humans and AI use together.": "人と AI が共に使うチェーンのブロック、価値、自律的な仕事を一つの画面で。",
  "Try a masterchain seqno": "マスターチェーン番号", "or a TOS address": "または TOS アドレス", "Latest blocks": "最新ブロック",
  "Latest transactions": "最新トランザクション", "View all": "すべて表示", "Built for an agent economy": "エージェント経済のために",
  "Explore work, not only transfers.": "送金だけでなく仕事も探索。", "Open work": "募集中の仕事", "Service activity": "サービス活動",
  "Latest masterchain block": "最新マスターチェーン", "Consensus block": "コンセンサスブロック", "Observed signers": "観測署名者",
  "AI work shown": "表示中の AI 仕事", "Live tip": "ライブ先端", "Node-reported": "ノード報告", "Latest proof link": "最新証明リンク",
  "Current page window": "現在の表示範囲", "Export CSV": "CSV 出力", "Refresh": "更新", "Try again": "再試行",
  "Loading verified network data…": "検証済みネットワークデータを読み込み中…", "Unable to load this view": "この画面を読み込めません",
  "Nothing here yet": "まだデータがありません", "No indexed records match this view.": "この条件に一致する索引レコードはありません。",
  "Previous": "前へ", "Next": "次へ", "Skip to content": "本文へ移動", "Source": "ソース",
  "Network status": "ネットワーク状態", "Open-source explorer for TOS Network": "TOS Network のオープンソース・エクスプローラー",
  "Search address, transaction, message, block or seqno": "アドレス、トランザクション、メッセージ、ブロックを検索", "Explore": "検索",
  "Finalized blocks across all indexed shards, newest first.": "索引済み全シャードの確定ブロックを新しい順に表示します。",
  "Recent account state changes observed in finalized blocks.": "確定ブロックで観測された最近のアカウント変更。",
  "Network rewards and Nominator Pools, reconstructed from Elector state and canonical pool contracts.": "Elector 状態と正規プール契約から再構成した報酬とノミネータープール。",
  "Current chain tip, durable index progress, consensus evidence and source health.": "現在のチェーン先端、永続索引、コンセンサス証拠、ソース状態。",
  "The proof-extracted active validator set and signatures observed on the latest masterchain proof link.": "最新マスターチェーン証明から抽出したバリデータ集合と署名。",
  "Chain-derived activity trends without off-chain estimates.": "オフチェーン推定を使わないチェーン由来の活動傾向。",
  "Current membership, stake exposure and retained on-chain observations.": "現在のメンバー、ステーク・エクスポージャー、保存された観測。",
  "Proof-extracted selection history and voting weight.": "証明から抽出した選出履歴と投票ウェイト。",
};

const messages: Record<Locale, Record<string, string>> = { en: {}, "zh-CN": zh, ja };

export function useLocale() {
  return {
    locale: computed(() => locale.value),
    locales: supported,
    setLocale(value: Locale) {
      locale.value = value;
      document.documentElement.lang = value;
      localStorage.setItem(STORAGE_KEY, value);
    },
    t(value: string): string {
      return messages[locale.value][value] ?? value;
    },
  };
}

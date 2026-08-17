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
  "Home": "首页", "Blockchain": "区块链", "Agent Economy": "Agent 经济", "Consensus": "共识", "Insights": "洞察",
  "Blocks": "区块", "Transactions": "交易", "Assets": "资产", "Agents": "Agent", "Tasks": "任务", "Disputes": "争议",
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
  "Network status": "网络状态", "Open-source explorer for TOS Network": "TOS Network 开源浏览器", "Live network": "网络运行中",
  "Read-only chain evidence": "只读链上证据", "Back to top": "返回顶部", "Network & consensus": "网络与共识", "Chain data": "链上数据",
  "Chain facts for people and autonomous agents.": "服务于人类与自主 Agent 的链上事实。",
  "Read-only by design. Every claim stays inside the available evidence.": "只读设计，所有结论均严格限定于现有证据。",
  "Open source": "开源", "Read only": "只读",
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
  "Current and upcoming validator membership, round timing, voting weight and staking context derived from chain evidence.": "查看由链上证据得出的当前与下一验证人集合、轮次时间、投票权重和质押背景。",
  "Proof-extracted membership, selection history and voting weight without invented operator or reward attribution.": "查看由证明提取的成员身份、入选历史和投票权重，不虚构运营者或奖励归属。",
  "Consensus evidence": "共识证据",
  "Proof-backed network authority, protocol and validator configuration cells.": "由证明支持的网络权限、协议和验证人配置。",
  "Chain-derived activity trends without off-chain estimates.": "不使用链下估算的链上活动趋势。",
  "Current membership, stake exposure and retained on-chain observations.": "当前成员、质押风险与保留的链上观察。",
  "Proof-extracted selection history and voting weight.": "由证明提取的入选历史和投票权重。",
  "Chain": "链上数据", "On-chain assets": "链上资产", "Contract evidence": "合约证据", "Personal tools": "个人工具",
  "Developers": "开发者", "Operations": "运行诊断", "On-chain governance": "链上治理", "Historical telemetry": "历史遥测",
  "Observability": "可观测性", "Staking evidence": "质押证据", "Chain-derived rewards": "链上奖励", "Accountability": "责任审查",
  "AI economy": "AI 经济", "AI service": "AI 服务", "Autonomous work": "自主工作", "Chain flow": "链路流转", "TOS economy": "TOS 经济",
  "Verified contracts": "已验证合约", "Verified contract": "已验证合约", "Asset activity": "资产动态", "Watchlist": "观察列表",
  "Explorer API": "浏览器 API", "Diagnostics": "诊断", "Browser diagnostics": "浏览器诊断", "Governance configuration": "治理配置",
  "Agent Account": "Agent 账户", "Service Actor": "服务执行体", "Task Escrow": "任务托管", "Token": "代币",
  "Reproducible build attestations matched byte-for-byte against deployed TOS code.": "与已部署 TOS 代码逐字节匹配的可复现构建证明。",
  "Compiler, source and deployment evidence for a byte-identical contract build.": "字节一致合约构建的编译器、源码与部署证据。",
  "Durably observed Jetton and NFT ownership-position changes.": "持久记录 Jetton 与 NFT 持仓位置变化。",
  "Private browser-local monitoring for the TOS identities you care about.": "仅在本浏览器中监控你关心的 TOS 身份。",
  "Read-only, evidence-bounded HTTP access to the same projection used by TOSCAN.": "通过只读 HTTP 访问 TOSCAN 使用的同一证据投影。",
  "Private, browser-local rendering errors and performance observations.": "仅在本浏览器保存渲染错误与性能观察。",
  "Balance, activity, assets and delegated authority.": "余额、活动、资产与委托权限。",
  "Node-authoritative token contract data and committed metadata.": "节点权威的代币合约数据与已提交元数据。",
  "A transaction included in finalized TOS Network history.": "已写入 TOS Network 最终历史的交易。",
  "Finalized block and its indexed transactions.": "最终区块及其已索引交易。",
  "Persistent on-chain identity, controller and autonomous spending policy.": "持久链上身份、控制者与自主支出策略。",
  "Escrow-backed work from creation through evidence, review and settlement.": "由托管保障，贯穿创建、举证、审核与结算的工作。",
  "On-chain review of a contested autonomous-work outcome.": "对有争议自主工作结果的链上审查。",
  "On-chain price, access policy, capacity and accountable request state.": "链上价格、访问策略、容量与可追责请求状态。",
  "Every indexed occurrence of this message across the transaction graph.": "该消息在交易图中的所有已索引出现记录。",
  "Account changes and message execution": "账户变化与消息执行", "Finalized masterchain and shard blocks": "已最终确认的主链与分片区块",
  "Chain tip, finality and index health": "链头、最终性与索引健康", "Reproducible source and deployed-code matches": "可复现源码与部署代码匹配",
  "Jettons, NFTs and verified positions": "Jetton、NFT 与已验证持仓", "Ownership-position observations": "持仓位置观察",
  "Private monitoring in this browser": "仅在本浏览器监控", "Public read-only endpoint reference": "公开只读接口参考",
  "Private browser health records": "浏览器本地健康记录", "Watch": "观察", "Watching": "观察中",
  "Direct search": "直接搜索", "Search suggestions": "搜索建议", "Recent searches": "最近搜索", "Searching…": "搜索中…",
  "No matching indexed identity": "没有匹配的已索引身份",
  "Preview data": "预览数据", "Explorer offline": "浏览器离线",
  "The configured TOS endpoint is unavailable. Values shown below are labelled demonstration data.": "配置的 TOS 端点不可用。以下数值均明确标记为演示数据。",
};

const ja: Record<string, string> = {
  "Home": "ホーム", "Blockchain": "ブロックチェーン", "Agent Economy": "エージェント経済", "Consensus": "コンセンサス", "Insights": "インサイト",
  "Blocks": "ブロック", "Transactions": "トランザクション", "Assets": "資産", "Agents": "エージェント", "Tasks": "タスク", "Disputes": "紛争",
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
  "Network status": "ネットワーク状態", "Open-source explorer for TOS Network": "TOS Network のオープンソース・エクスプローラー", "Live network": "ネットワーク稼働中",
  "Read-only chain evidence": "読み取り専用のチェーン証拠", "Back to top": "ページ上部へ", "Network & consensus": "ネットワークとコンセンサス", "Chain data": "チェーンデータ",
  "Chain facts for people and autonomous agents.": "人と自律エージェントのためのチェーン上の事実。",
  "Read-only by design. Every claim stays inside the available evidence.": "読み取り専用設計。すべての表示は利用可能な証拠の範囲内です。",
  "Open source": "オープンソース", "Read only": "読み取り専用",
  "Search address, transaction, message, block or seqno": "アドレス、トランザクション、メッセージ、ブロックを検索", "Explore": "検索",
  "Finalized blocks across all indexed shards, newest first.": "索引済み全シャードの確定ブロックを新しい順に表示します。",
  "Recent account state changes observed in finalized blocks.": "確定ブロックで観測された最近のアカウント変更。",
  "Network rewards and Nominator Pools, reconstructed from Elector state and canonical pool contracts.": "Elector 状態と正規プール契約から再構成した報酬とノミネータープール。",
  "Current chain tip, durable index progress, consensus evidence and source health.": "現在のチェーン先端、永続索引、コンセンサス証拠、ソース状態。",
  "The proof-extracted active validator set and signatures observed on the latest masterchain proof link.": "最新マスターチェーン証明から抽出したバリデータ集合と署名。",
  "Current and upcoming validator membership, round timing, voting weight and staking context derived from chain evidence.": "チェーン証拠から得た現在・次期バリデータ集合、ラウンド時刻、投票ウェイト、ステーキング状況。",
  "Proof-extracted membership, selection history and voting weight without invented operator or reward attribution.": "運営者や報酬の帰属を推測せず、証明から抽出した所属、選出履歴、投票ウェイトを表示します。",
  "Consensus evidence": "コンセンサス証拠",
  "Chain-derived activity trends without off-chain estimates.": "オフチェーン推定を使わないチェーン由来の活動傾向。",
  "Current membership, stake exposure and retained on-chain observations.": "現在のメンバー、ステーク・エクスポージャー、保存された観測。",
  "Proof-extracted selection history and voting weight.": "証明から抽出した選出履歴と投票ウェイト。",
  "Chain": "チェーン", "On-chain assets": "オンチェーン資産", "Contract evidence": "コントラクト証拠", "Personal tools": "個人ツール",
  "Developers": "開発者", "Operations": "運用診断", "On-chain governance": "オンチェーン・ガバナンス", "Historical telemetry": "履歴テレメトリ",
  "Observability": "可観測性", "Staking evidence": "ステーキング証拠", "Chain-derived rewards": "チェーン由来報酬", "Accountability": "説明責任",
  "AI economy": "AI 経済", "AI service": "AI サービス", "Autonomous work": "自律的な仕事", "Chain flow": "チェーンフロー", "TOS economy": "TOS 経済",
  "Verified contracts": "検証済みコントラクト", "Verified contract": "検証済みコントラクト", "Asset activity": "資産アクティビティ", "Watchlist": "ウォッチリスト",
  "Explorer API": "エクスプローラー API", "Diagnostics": "診断", "Browser diagnostics": "ブラウザー診断", "Governance configuration": "ガバナンス設定",
  "Agent Account": "エージェント口座", "Service Actor": "サービス・アクター", "Task Escrow": "タスク・エスクロー", "Token": "トークン",
  "Reproducible build attestations matched byte-for-byte against deployed TOS code.": "デプロイ済み TOS コードとバイト単位で一致する再現可能ビルド証明。",
  "Compiler, source and deployment evidence for a byte-identical contract build.": "バイト一致するコントラクト・ビルドのコンパイラ、ソース、デプロイ証拠。",
  "Durably observed Jetton and NFT ownership-position changes.": "Jetton と NFT の所有ポジション変化を永続的に記録。",
  "Private browser-local monitoring for the TOS identities you care about.": "関心のある TOS ID をこのブラウザー内だけで監視。",
  "Read-only, evidence-bounded HTTP access to the same projection used by TOSCAN.": "TOSCAN と同じ証拠投影への読み取り専用 HTTP アクセス。",
  "Private, browser-local rendering errors and performance observations.": "このブラウザーだけに保存される描画エラーと性能観測。",
  "Proof-backed network authority, protocol and validator configuration cells.": "証明に基づくネットワーク権限、プロトコル、バリデータ設定セル。",
  "Balance, activity, assets and delegated authority.": "残高、活動、資産、委任権限。",
  "Node-authoritative token contract data and committed metadata.": "ノード権威のトークン・コントラクトデータとコミット済みメタデータ。",
  "A transaction included in finalized TOS Network history.": "確定した TOS Network 履歴に含まれるトランザクション。",
  "Finalized block and its indexed transactions.": "確定ブロックと索引済みトランザクション。",
  "Persistent on-chain identity, controller and autonomous spending policy.": "永続オンチェーン ID、コントローラ、自律支出ポリシー。",
  "Escrow-backed work from creation through evidence, review and settlement.": "作成、証拠、レビュー、決済までエスクローで保護された仕事。",
  "On-chain review of a contested autonomous-work outcome.": "争われた自律作業結果のオンチェーン審査。",
  "On-chain price, access policy, capacity and accountable request state.": "オンチェーン価格、アクセスポリシー、容量、追跡可能な要求状態。",
  "Every indexed occurrence of this message across the transaction graph.": "トランザクション・グラフ上のこのメッセージの全索引記録。",
  "Account changes and message execution": "口座変更とメッセージ実行", "Finalized masterchain and shard blocks": "確定マスターチェーンとシャードブロック",
  "Chain tip, finality and index health": "チェーン先端、ファイナリティ、索引状態", "Reproducible source and deployed-code matches": "再現可能ソースとデプロイコードの一致",
  "Jettons, NFTs and verified positions": "Jetton、NFT、検証済みポジション", "Ownership-position observations": "所有ポジション観測",
  "Private monitoring in this browser": "このブラウザー内だけの監視", "Public read-only endpoint reference": "公開読み取り専用 API リファレンス",
  "Private browser health records": "ブラウザー内の健康記録", "Watch": "監視", "Watching": "監視中",
  "Direct search": "直接検索", "Search suggestions": "検索候補", "Recent searches": "最近の検索", "Searching…": "検索中…",
  "No matching indexed identity": "一致する索引 ID がありません",
  "Preview data": "プレビュー・データ", "Explorer offline": "エクスプローラーはオフライン",
  "The configured TOS endpoint is unavailable. Values shown below are labelled demonstration data.": "設定済み TOS エンドポイントを利用できません。以下の値はデモデータとして明示されています。",
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

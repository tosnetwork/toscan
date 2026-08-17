import { beforeEach, describe, expect, it } from "vitest";
import { useWatchlist, watchKey } from "./useWatchlist";

describe("browser-local watchlist", () => {
  const watchlist = useWatchlist();

  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } });
    for (const item of [...watchlist.items.value]) watchlist.remove(item.key);
    window.localStorage.clear();
  });

  it("marks a watched identity only when its evidence fingerprint changes", () => {
    watchlist.add({ kind: "address", identity: "0:abc", label: "Account", route: "/address/0:abc" });
    const key = watchKey("address", "0:abc");
    expect(watchlist.has(key)).toBe(true);
    expect(watchlist.observe(key, "balance:1")).toBe(false);
    expect(watchlist.unreadCount.value).toBe(0);
    expect(watchlist.observe(key, "balance:2")).toBe(true);
    expect(watchlist.unreadCount.value).toBe(1);
    expect(JSON.parse(window.localStorage.getItem("toscan:watchlist:v1") ?? "[]")[0]).toMatchObject({ key, unread: true });

    watchlist.markRead(key);
    expect(watchlist.unreadCount.value).toBe(0);
    watchlist.remove(key);
    expect(watchlist.items.value).toEqual([]);
  });

  it("remains usable for the current session when persistent storage is blocked", () => {
    Object.defineProperty(window.localStorage, "setItem", {
      configurable: true,
      value: () => { throw new Error("storage blocked"); },
    });

    expect(() => watchlist.add({ kind: "asset", identity: "0:def", label: "Asset", route: "/token/0:def" }))
      .not.toThrow();
    expect(watchlist.has(watchKey("asset", "0:def"))).toBe(true);
  });
});

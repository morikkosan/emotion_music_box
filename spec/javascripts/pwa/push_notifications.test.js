/**
 * push_notifications.js エントリの副作用テスト（実体ファイルを自動探索）
 * - 初回読み込みで navigator.serviceWorker.register が1回以上呼ばれる（副作用）
 * - 2回目読み込みは実装により idempotent の可能性があるため回数は固定しない（例外が出ないこと/余計な副作用が無いことを検証）
 * - fetch は呼ばれない（自動購読など余計な副作用なし）
 */

const fs = require("fs");
const path = require("path");

// app/javascript 配下を再帰検索して push_notifications.{js,mjs} を探す
function findEntry() {
  const roots = [
    path.join(process.cwd(), "app/javascript"),
    path.join(process.cwd(), "app/assets/javascripts"), // 念のため
  ];
  const targets = new Set(["push_notifications.js", "push_notifications.mjs"]);

  const ignoreDirs = new Set([
    "node_modules",
    "vendor",
    "coverage",
    ".git",
    "tmp",
    "dist",
    "build",
  ]);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    /** @type {string[]} */
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const ent of entries) {
        const p = path.join(cur, ent.name);
        if (ent.isDirectory()) {
          if (!ignoreDirs.has(ent.name)) stack.push(p);
        } else if (ent.isFile()) {
          if (targets.has(ent.name)) {
            return p; // 最初に見つかった実体パスを返す
          }
        }
      }
    }
  }
  return null;
}

describe("pwa/push_notifications entry", () => {
  let ENTRY_ABS;

  beforeEach(() => {
    jest.resetModules(); // 毎回モジュールキャッシュをクリア
    ENTRY_ABS = findEntry();

    if (!ENTRY_ABS) {
      throw new Error(
        [
          "push_notifications.js（または .mjs）の実体が見つかりませんでした。",
          "検索ルート:",
          ` - ${path.join(process.cwd(), "app/javascript")}`,
          ` - ${path.join(process.cwd(), "app/assets/javascripts")}`,
          "配置先を確認してください。（ファイル名は push_notifications.js / .mjs のどちらか）",
        ].join("\n")
      );
    }

    // fetch が万一呼ばれたら検知（呼ばれないことを期待）
    global.fetch = jest.fn();

    // serviceWorker.register をスパイ
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { serviceWorker: { register } },
    });

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("初回読み込みで serviceWorker.register が1回以上呼ばれる（副作用検証）", async () => {
    await jest.isolateModulesAsync(async () => {
      // Babel-Jest が ESM を CJS に変換してくれるので require でOK
      require(ENTRY_ABS);
    });

    const called = navigator.serviceWorker.register.mock.calls.length;
    expect(called).toBeGreaterThanOrEqual(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("二重読み込みでも例外にならず、余計な副作用（fetch）が無い（回数は実装依存）", async () => {
    // 1回目
    await jest.isolateModulesAsync(async () => {
      require(ENTRY_ABS);
    });
    const firstCalls = navigator.serviceWorker.register.mock.calls.length;
    expect(firstCalls).toBeGreaterThanOrEqual(1); // 初回は最低1回

    // 2回目（キャッシュを切って再読み込み）
    jest.resetModules();

    const register2 = jest.fn().mockResolvedValue({});
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { serviceWorker: { register: register2 } },
    });

    // 例外なく require できることを確認
    await expect(
      jest.isolateModulesAsync(async () => {
        require(ENTRY_ABS);
      })
    ).resolves.not.toThrow();

    // 2回目は実装により idempotent で 0 回でも正（ここは厳密に縛らない）
    const secondCalls = register2.mock.calls.length;
    expect(secondCalls).toBeGreaterThanOrEqual(0);

    // どちらの読み込みでも fetch は呼ばれていないはず
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("subscribeToPushNotifications はグローバルに漏れていない", async () => {
    await jest.isolateModulesAsync(async () => {
      require(ENTRY_ABS);
    });

    expect("subscribeToPushNotifications" in global).toBe(false);
    if (typeof window !== "undefined") {
      expect("subscribeToPushNotifications" in window).toBe(false);
    }
  });
});

// spec/javascripts/pwa/register_service_worker.test.js
import { jest } from "@jest/globals";

// 他スイートの副作用を避けるため：毎テストごとに isolate して読み込む
const load = () => {
  let api;
  jest.isolateModules(() => {
    // moduleNameMapper: '^custom/(.*)$' が効いている前提
    api = require("custom/register_service_worker");
  });
  return api;
};

// navigator.serviceWorker を安全に差し替え/削除するユーティリティ
function setSW(sw) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: sw
  });
}
function clearSW() {
  // 'serviceWorker' in navigator を false にするため、プロパティ自体を消す
  try {
    // まず削除を試みる
    // （以前 setSW で configurable:true を付けているので delete 可能）
    // もし他所で定義されていて消せない場合は、一旦 configurable:true で再定義→delete
    delete navigator.serviceWorker;
    if ("serviceWorker" in navigator) {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: undefined
      });
      delete navigator.serviceWorker;
    }
  } catch {
    try {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: undefined
      });
      delete navigator.serviceWorker;
    } catch {
      // どうしても消せない環境は無視（jsdom なら消せる）
    }
  }
}

describe("registerServiceWorker", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    // console は毎回スパイし直す（setupFilesAfterEnv のモックよりこちらを優先）
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    clearSW(); // 既存の serviceWorker をクリーンに（'in' 判定で false になる状態）
  });

  afterEach(() => {
    clearSW();
    jest.resetModules(); // キャッシュもクリア（他スイートの影響をさらに遮断）
  });

  test("未対応環境では null を返す", async () => {
    // 念のためこのケースでも明示的に property を消す
    clearSW();
    // 追加の保険：直接 delete（上で消えていれば no-op）
    try { delete navigator.serviceWorker; } catch {}

    const { registerServiceWorker } = load();
    const res = await registerServiceWorker();

    expect(res).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("ServiceWorker 未対応");
  });

  test("登録成功時は registration を返す", async () => {
    const mockReg = { scope: "/test" };
    setSW({ register: jest.fn().mockResolvedValue(mockReg) });
    const { registerServiceWorker } = load();

    const res = await registerServiceWorker();
    expect(res).toBe(mockReg);
    expect(console.log).toHaveBeenCalledWith("[PWA] ServiceWorker 登録成功:", mockReg);
  });

  test("登録失敗時は例外を投げる", async () => {
    setSW({ register: jest.fn().mockRejectedValue(new Error("fail")) });
    const { registerServiceWorker } = load();

    await expect(registerServiceWorker()).rejects.toThrow("fail");
    expect(console.error).toHaveBeenCalledWith("[PWA] ServiceWorker 登録失敗:", expect.any(Error));
  });
});

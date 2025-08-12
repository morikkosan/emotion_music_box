// spec/javascripts/pwa/push_subscription.vapid_convert.test.js
import { subscribeToPushNotifications } from "custom/push_subscription";

describe("subscribeToPushNotifications: VAPID applicationServerKey の変換確認", () => {
  let origVapid;
  let originalAtob;

  beforeEach(() => {
    // base64 "AQID" -> [1,2,3]
    origVapid = window.VAPID_PUBLIC_KEY;
    window.VAPID_PUBLIC_KEY = "AQID";

    // Node/Jest で atob が無い可能性に備えてモック
    originalAtob = global.atob;
    global.atob = (b64) => {
      if (b64 === "AQID") return String.fromCharCode(1, 2, 3);
      throw new Error("unexpected atob input in test: " + b64);
    };

    document.head.innerHTML = `<meta name="csrf-token" content="CSRF_TOKEN">`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    // console出力は抑制
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.VAPID_PUBLIC_KEY = origVapid;
    if (originalAtob) global.atob = originalAtob;
    jest.restoreAllMocks();
  });

  test("subscribe に渡る applicationServerKey が Uint8Array([1,2,3])", async () => {
    // subscribe をスパイして、渡された引数を直接検査する
    const subscribeSpy = jest.fn().mockResolvedValue({ endpoint: "https://example", keys: {} });

    // ready の戻り値を上書き
    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: jest.fn().mockResolvedValue(null),
              subscribe: subscribeSpy
            }
          })
        }
      },
      configurable: true,
    });

    // PushManager 存在フラグ（分岐通過用）
    Object.defineProperty(global, "window", {
      value: { ...global.window, PushManager: function() {} },
      configurable: true,
    });

    await subscribeToPushNotifications();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    const arg = subscribeSpy.mock.calls[0][0];
    expect(arg.userVisibleOnly).toBe(true);
    expect(arg.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(arg.applicationServerKey)).toEqual([1, 2, 3]);

    expect(console.log).toHaveBeenCalledWith("✅ Push通知の購読に成功しました");
  });
});

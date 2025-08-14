/**
 * comments.js のDOM/タイマー/アニメーション検証
 * - document.addEventListener("DOMContentLoaded") をスパイしてハンドラを捕捉
 * - Math.random を固定化して top のpx値を検証
 * - setInterval をフェイクタイマーで進め、コメント生成を検証
 * - gsap.to をモックし、引数（duration/ease/x）と onComplete による削除を検証
 *
 * 前提:
 *  - jest.config.js は既存設定（jsdom / setupFilesAfterEnv 等）
 *  - moduleDirectories に "<rootDir>/app/javascript" が含まれている
 *  - 本体を app/javascript/custom/comments.js に配置
 */

describe("custom/comments.js", () => {
  let capturedDOMContentLoaded;
  let addListenerSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    // DOM準備
    document.body.innerHTML = `
      <div id="comment-container" style="position:relative;"></div>
    `;
    const container = document.getElementById("comment-container");

    // jsdomだと clientHeight が 0 になりがちなので固定
    Object.defineProperty(container, "clientHeight", {
      value: 200, // 任意の高さ
      configurable: true,
    });

    // innerWidth も検証のため固定
    Object.defineProperty(window, "innerWidth", {
      value: 800,
      configurable: true,
    });

    // gsap はグローバル参照なのでテスト側で用意
    global.gsap = {
      to: jest.fn(),
    };

    // DOMContentLoaded リスナを捕捉
    capturedDOMContentLoaded = undefined;
    addListenerSpy = jest
      .spyOn(document, "addEventListener")
      .mockImplementation((event, cb) => {
        if (event === "DOMContentLoaded") {
          capturedDOMContentLoaded = cb;
        }
      });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    addListenerSpy?.mockRestore();
    delete global.gsap;
    jest.restoreAllMocks();
  });

  const importModule = () => {
    // モジュールキャッシュ隔離で確実にaddEventListenerが呼ばれるようにする
    jest.isolateModules(() => {
      require("custom/comments.js"); // ← app/javascript/custom/comments.js
    });
  };

  test("10秒ごとにコメントが生成され、gsap.to が正しい引数で呼ばれ、onCompleteで削除される", () => {
    // top の乱数を固定: clientHeight=200 → (200-20)*0.25 = 45px
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);

    importModule();
    expect(typeof capturedDOMContentLoaded).toBe("function");

    // DOMContentLoaded 発火 → setInterval セット
    capturedDOMContentLoaded();

    const container = document.getElementById("comment-container");
    expect(container.querySelector(".comment")).toBeNull();

    // 10秒経過で1回生成
    jest.advanceTimersByTime(10000);

    // 生成された要素の検証
    const comment = container.querySelector(".comment");
    expect(comment).not.toBeNull();
    expect(comment.textContent).toBe("いらいら");
    expect(comment.style.left).toBe("100%");
    expect(comment.style.top).toBe("45px"); // 乱数固定の結果

    // gsap.to が正しい引数で呼ばれているか
    expect(global.gsap.to).toHaveBeenCalledTimes(1);
    const [animEl, animOpts] = global.gsap.to.mock.calls[0];
    expect(animEl).toBe(comment);
    expect(animOpts.duration).toBe(10);
    expect(animOpts.ease).toBe("linear");
    expect(animOpts.x).toBe(-window.innerWidth - 200); // -1000

    // アニメーション完了時にDOMから削除されること
    expect(typeof animOpts.onComplete).toBe("function");
    animOpts.onComplete();
    expect(container.querySelector(".comment")).toBeNull();

    randSpy.mockRestore();
  });

  test("10秒ごとに複数回トリガされる（onCompleteを即時に呼んでリーク無しを確認）", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    // gsap.to 実行時に即 onComplete を呼ぶ（テストを軽くするため）
    global.gsap.to.mockImplementation((el, opts) => {
      if (opts && typeof opts.onComplete === "function") opts.onComplete();
    });

    importModule();
    capturedDOMContentLoaded();

    const container = document.getElementById("comment-container");

    // 1回目
    jest.advanceTimersByTime(10000);
    expect(global.gsap.to).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".comment").length).toBe(0); // 即削除

    // 2回目
    jest.advanceTimersByTime(10000);
    expect(global.gsap.to).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll(".comment").length).toBe(0);

    // 3回目
    jest.advanceTimersByTime(10000);
    expect(global.gsap.to).toHaveBeenCalledTimes(3);
    expect(container.querySelectorAll(".comment").length).toBe(0);

    randSpy.mockRestore();
  });
});

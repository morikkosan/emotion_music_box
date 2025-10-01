// spec/javascripts/globals/comments.test.js
/**
 * comments.js のDOM/タイマー/アニメーション検証（Web Animations API 版）
 * 分岐網羅ポイント:
 *  - コンテナ無しで早期 return
 *  - clientHeight=0 → window.innerHeight フォールバック
 *  - clientHeight<20 → Math.max による top=0 クランプ
 */

describe("custom/comments.js (Web Animations API)", () => {
  let capturedDOMContentLoaded;
  let addListenerSpy;
  let animateMock;

  const importModule = () => {
    jest.isolateModules(() => {
      require("custom/comments.js"); // app/javascript/custom/comments.js
    });
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="comment-container" style="position:relative;"></div>
    `;
    const container = document.getElementById("comment-container");

    Object.defineProperty(container, "clientHeight", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      value: 800,
      configurable: true,
    });

    // Web Animations API モック
    animateMock = jest.fn().mockReturnValue({});
    Element.prototype.animate = animateMock;

    // DOMContentLoaded 捕捉
    capturedDOMContentLoaded = undefined;
    addListenerSpy = jest
      .spyOn(document, "addEventListener")
      .mockImplementation((event, cb) => {
        if (event === "DOMContentLoaded") capturedDOMContentLoaded = cb;
      });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    addListenerSpy?.mockRestore();
    jest.restoreAllMocks();
  });

  test("10秒ごとにコメントが生成され、animate が正しい引数で呼ばれ、onfinishで削除される", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);

    importModule();
    expect(typeof capturedDOMContentLoaded).toBe("function");
    capturedDOMContentLoaded();

    const container = document.getElementById("comment-container");

    // 10秒経過で1つ生成
    jest.advanceTimersByTime(10000);

    const comment = container.querySelector(".comment");
    expect(comment).not.toBeNull();
    expect(comment.textContent).toBe("いらいら");
    expect(comment.style.left).toBe("100%");
    expect(comment.style.top).toBe("45px"); // (200-20)*0.25

    // travelX は実測値で検証
    const travelX = window.innerWidth + (comment.offsetWidth || 0) + 200;

    expect(animateMock).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animateMock.mock.calls[0];
    expect(keyframes).toEqual([
      { transform: "translateX(0)" },
      { transform: `translateX(-${travelX}px)` },
    ]);
    expect(options).toMatchObject({
      duration: 10000,
      easing: "linear",
      fill: "forwards",
    });

    // onfinish → DOM から削除
    const returnedAnim = animateMock.mock.results[0].value;
    returnedAnim.onfinish?.();
    expect(container.querySelector(".comment")).toBeNull();

    randSpy.mockRestore();
  });

  test("10秒ごとに複数回トリガされる（onfinishを手動で即時呼び・リーク無し確認）", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    // ※ タイマーは使わず、各回の onfinish を手動で呼ぶ
    importModule();
    capturedDOMContentLoaded();
    const container = document.getElementById("comment-container");

    // 1回目
    jest.advanceTimersByTime(10000);
    expect(animateMock).toHaveBeenCalledTimes(1);
    animateMock.mock.results[0].value.onfinish?.();
    expect(container.querySelectorAll(".comment").length).toBe(0);

    // 2回目
    jest.advanceTimersByTime(10000);
    expect(animateMock).toHaveBeenCalledTimes(2);
    animateMock.mock.results[1].value.onfinish?.();
    expect(container.querySelectorAll(".comment").length).toBe(0);

    // 3回目
    jest.advanceTimersByTime(10000);
    expect(animateMock).toHaveBeenCalledTimes(3);
    animateMock.mock.results[2].value.onfinish?.();
    expect(container.querySelectorAll(".comment").length).toBe(0);

    randSpy.mockRestore();
  });

  test("【分岐】コンテナが存在しない場合は早期return（要素もアニメも発生しない）", () => {
    // DOM を空にして early return を通す
    document.body.innerHTML = ``;

    // リスナ捕捉をやり直す
    capturedDOMContentLoaded = undefined;
    addListenerSpy.mockImplementation((event, cb) => {
      if (event === "DOMContentLoaded") capturedDOMContentLoaded = cb;
    });

    importModule();
    expect(typeof capturedDOMContentLoaded).toBe("function");
    capturedDOMContentLoaded();

    // 進めても何も起きない
    jest.advanceTimersByTime(10000);
    expect(document.querySelector(".comment")).toBeNull();
    expect(animateMock).not.toHaveBeenCalled();
  });

  test("【分岐】clientHeight=0 のとき window.innerHeight を使う（top が fallback計算になる）", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    const container = document.getElementById("comment-container");
    Object.defineProperty(container, "clientHeight", {
      value: 0,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 600,
      configurable: true,
    });

    importModule();
    capturedDOMContentLoaded();

    jest.advanceTimersByTime(10000);

    const comment = container.querySelector(".comment");
    expect(comment).not.toBeNull();
    // top = (innerHeight - 20) * 0.5 = (600-20)*0.5 = 290
    expect(comment.style.top).toBe("290px");

    randSpy.mockRestore();
  });

  test("【分岐】clientHeight<20 のとき Math.max により top は 0 にクランプされる", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0.8);

    const container = document.getElementById("comment-container");
    Object.defineProperty(container, "clientHeight", {
      value: 10, // 10-20 = -10 → Math.max(0, -10) = 0
      configurable: true,
    });

    importModule();
    capturedDOMContentLoaded();

    jest.advanceTimersByTime(10000);

    const comment = container.querySelector(".comment");
    expect(comment).not.toBeNull();
    expect(comment.style.top).toBe("0px"); // クランプ

    randSpy.mockRestore();
  });
});

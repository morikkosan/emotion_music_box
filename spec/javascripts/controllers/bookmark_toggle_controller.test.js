// spec/javascripts/controllers/bookmark_toggle_controller.test.js
import { Application } from "@hotwired/stimulus";
import BookmarkToggleController from "../../../app/javascript/controllers/bookmark_toggle_controller";

// Stimulusを起動してコントローラを取得するヘルパー
const boot = () => {
  const app = Application.start();
  app.register("bookmark-toggle", BookmarkToggleController);
  const root = document.querySelector("[data-controller='bookmark-toggle']");
  const instance = app.getControllerForElementAndIdentifier(root, "bookmark-toggle");
  return { app, root, instance };
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  document.body.innerHTML = "";
  // ベースURL（img.srcの絶対化対策）
  window.history.replaceState({}, "", "http://localhost/");
});

describe("bookmark_toggle_controller", () => {
  test("connect: turbo:frame-load 監視を登録する（addEventListenerが呼ばれる）", () => {
    // addEventListener をスパイしたいので、先に root を作って差し替える
    const root = document.createElement("div");
    root.setAttribute("data-controller", "bookmark-toggle");

    // icon/count ターゲット
    root.innerHTML = `
      <img data-bookmark-toggle-target="icon"
           data-toggled="false"
           data-bookmarked-url="/assets/bookmarked.svg"
           data-unbookmarked-url="/assets/unbookmarked.svg"
           src="/assets/unbookmarked.svg" />
      <span data-bookmark-toggle-target="count">3</span>
    `;

    // addEventListener をモック
    const addSpy = jest.fn();
    root.addEventListener = addSpy;

    document.body.appendChild(root);
    const { instance } = boot();

    // connect() で登録されているはず
    expect(addSpy).toHaveBeenCalledWith(
      "turbo:frame-load",
      expect.any(Function)
    );

    // 念のため、発火しても例外が出ないことだけ確認
    expect(() =>
      root.dispatchEvent(new Event("turbo:frame-load", { bubbles: true }))
    ).not.toThrow();

    // cleanup
    instance?.disconnect?.();
  });

  test("toggle: 未ブックマーク(false) → ブックマーク(true) にトグル、アイコン変更とカウント+1", () => {
    document.body.innerHTML = `
      <div data-controller="bookmark-toggle">
        <img data-bookmark-toggle-target="icon"
             data-toggled="false"
             data-bookmarked-url="/assets/bookmarked.svg"
             data-unbookmarked-url="/assets/unbookmarked.svg"
             src="/assets/unbookmarked.svg" />
        <span data-bookmark-toggle-target="count">10</span>
      </div>
    `;

    const { instance } = boot();

    // 実行前の確認
    const icon = instance.iconTarget;
    const count = instance.countTarget;
    expect(icon.dataset.toggled).toBe("false");
    expect(count.innerText).toBe("10");

    // toggle 実行
    instance.toggle({});

    // アイコンが bookmarked に、toggled="true"、カウント 11
    expect(icon.dataset.toggled).toBe("true");
    expect(count.innerText).toBe("11");
    // jsdom では src は絶対URLに解決されるので contains で確認
    expect(icon.src).toContain("/assets/bookmarked.svg");

    instance.disconnect();
  });

  test("toggle: ブックマーク(true) → 未ブックマーク(false) にトグル、アイコン変更とカウント-1", () => {
    document.body.innerHTML = `
      <div data-controller="bookmark-toggle">
        <img data-bookmark-toggle-target="icon"
             data-toggled="true"
             data-bookmarked-url="/assets/bookmarked.svg"
             data-unbookmarked-url="/assets/unbookmarked.svg"
             src="/assets/bookmarked.svg" />
        <span data-bookmark-toggle-target="count">4</span>
      </div>
    `;

    const { instance } = boot();

    const icon = instance.iconTarget;
    const count = instance.countTarget;

    // toggle 実行
    instance.toggle({});

    // アイコンが unbookmarked に、toggled="false"、カウント 3
    expect(icon.dataset.toggled).toBe("false");
    expect(count.innerText).toBe("3");
    expect(icon.src).toContain("/assets/unbookmarked.svg");

    instance.disconnect();
  });

  test("toggle: countが数値文字列でなくても parseInt の挙動で更新される", () => {
    document.body.innerHTML = `
      <div data-controller="bookmark-toggle">
        <img data-bookmark-toggle-target="icon"
             data-toggled="false"
             data-bookmarked-url="/assets/bookmarked.svg"
             data-unbookmarked-url="/assets/unbookmarked.svg"
             src="/assets/unbookmarked.svg" />
        <span data-bookmark-toggle-target="count">12 票</span>
      </div>
    `;

    const { instance } = boot();

    const count = instance.countTarget;
    instance.toggle({}); // false -> true で +1

    // parseInt("12 票", 10) === 12 なので 13 になる
    expect(count.innerText).toBe("13");

    instance.disconnect();
  });
});

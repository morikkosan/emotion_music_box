// spec/javascripts/controllers/mobile_footer_controller.test.js
import { Application } from "@hotwired/stimulus";
import MobileFooterController from "controllers/mobile_footer_controller";

describe("mobile_footer_controller", () => {
  let app;

  function setPath(pathname) {
    window.history.replaceState({}, "", pathname);
  }

  function buildFooterDOM({ includeInvalidButton = false } = {}) {
    /**
     * <nav data-controller="mobile-footer">
     *   <a data-mobile-footer-target="item" data-section="home" href="/emotion_logs">Home</a>
     *   <button data-mobile-footer-target="item" data-section="search" data-href="/search">Search</button>
     *   <button data-mobile-footer-target="item" data-section="playlist" data-href="/playlists">Playlist</button>
     *   <a data-mobile-footer-target="item" data-section="mypage" href="/mypage">My</a>
     *   <a data-mobile-footer-target="item" data-section="about" href="/about">About</a>
     *   [任意] data-href も href も無い無効ボタン
     * </nav>
     */
    const nav = document.createElement("nav");
    nav.setAttribute("data-controller", "mobile-footer");

    const home = document.createElement("a");
    home.setAttribute("data-mobile-footer-target", "item");
    home.setAttribute("data-section", "home");
    home.setAttribute("href", "/emotion_logs");
    home.textContent = "Home";
    nav.appendChild(home);

    const search = document.createElement("button");
    search.setAttribute("data-mobile-footer-target", "item");
    search.setAttribute("data-section", "search");
    search.dataset.href = "/search";
    search.textContent = "Search";
    nav.appendChild(search);

    const playlist = document.createElement("button");
    playlist.setAttribute("data-mobile-footer-target", "item");
    playlist.setAttribute("data-section", "playlist");
    playlist.dataset.href = "/playlists";
    playlist.textContent = "Playlist";
    nav.appendChild(playlist);

    const my = document.createElement("a");
    my.setAttribute("data-mobile-footer-target", "item");
    my.setAttribute("data-section", "mypage");
    my.setAttribute("href", "/mypage");
    my.textContent = "My";
    nav.appendChild(my);

    const about = document.createElement("a");
    about.setAttribute("data-mobile-footer-target", "item");
    about.setAttribute("data-section", "about");
    about.setAttribute("href", "/about");
    about.textContent = "About";
    nav.appendChild(about);

    // hrefもdata-hrefも持たない無効ボタン（分岐カバー用）
    let invalidBtn = null;
    if (includeInvalidButton) {
      invalidBtn = document.createElement("button");
      invalidBtn.setAttribute("data-mobile-footer-target", "item");
      invalidBtn.setAttribute("data-section", "invalid");
      invalidBtn.textContent = "Invalid";
      nav.appendChild(invalidBtn);
    }

    document.body.appendChild(nav);
    return { nav, home, search, playlist, my, about, invalidBtn };
  }

  beforeAll(() => {
    app = Application.start();
    app.register("mobile-footer", MobileFooterController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("初期表示: URLと同じhrefのitemが active/aria-current になる", () => {
    setPath("/mypage");
    const { nav, home, my, about } = buildFooterDOM();

    app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    expect(my.classList.contains("active")).toBe(true);
    expect(my.getAttribute("aria-current")).toBe("page");

    expect(home.classList.contains("active")).toBe(false);
    expect(home.hasAttribute("aria-current")).toBe(false);
    expect(about.classList.contains("active")).toBe(false);
  });

  test("/emotion_logs 系で完全一致なし → home をフォールバックで点灯", () => {
    setPath("/emotion_logs/123");
    const { nav, home, my } = buildFooterDOM();

    app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    expect(home.classList.contains("active")).toBe(true);
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(my.classList.contains("active")).toBe(false);
  });

  test("onClick: 任意のitemを即時 active にする（Aタグ/ボタン共通）", () => {
    setPath("/about");
    const { nav, search, my } = buildFooterDOM();
    const controller = app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    controller.onClick({ currentTarget: search });

    expect(search.classList.contains("active")).toBe(true);
    expect(search.getAttribute("aria-current")).toBe("page");
    expect(my.classList.contains("active")).toBe(false);
    expect(my.hasAttribute("aria-current")).toBe(false);
  });

  test("onSearchClick / onPlaylistClick: モーダル項目も一時的に active", () => {
    setPath("/about");
    const { nav, search, playlist } = buildFooterDOM();
    const controller = app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    controller.onSearchClick({ currentTarget: search });
    expect(search.classList.contains("active")).toBe(true);
    expect(search.getAttribute("aria-current")).toBe("page");

    controller.onPlaylistClick({ currentTarget: playlist });
    expect(playlist.classList.contains("active")).toBe(true);
    expect(playlist.getAttribute("aria-current")).toBe("page");

    // 直前に点灯させた方だけが残る
    expect(search.classList.contains("active")).toBe(false);
  });

  test("turbo:frame-load（logs_list_mobileのみ）で updateActiveFromURL が動く（効果検証）", () => {
    // 初回は /about → about が点灯
    setPath("/about");
    const { nav, my, about } = buildFooterDOM();
    app.getControllerForElementAndIdentifier(nav, "mobile-footer");
    expect(about.classList.contains("active")).toBe(true);

    // URL変更してもまだ反映されていない
    setPath("/mypage");
    expect(about.classList.contains("active")).toBe(true);

    // 対象frameからイベントを発火 → 反映される
    const frame = document.createElement("turbo-frame");
    frame.id = "logs_list_mobile";
    document.body.appendChild(frame);
    frame.dispatchEvent(new CustomEvent("turbo:frame-load", { bubbles: true }));

    expect(my.classList.contains("active")).toBe(true);
    expect(about.classList.contains("active")).toBe(false);
  });

  test("turbo:load で URLに基づいて再計算（spyではなく効果で判定）", () => {
    // 初回 /about → about が点灯
    setPath("/about");
    const { nav, my, about } = buildFooterDOM();
    app.getControllerForElementAndIdentifier(nav, "mobile-footer");
    expect(about.classList.contains("active")).toBe(true);

    // URLだけ /mypage に変更（まだ反映されない）
    setPath("/mypage");
    expect(about.classList.contains("active")).toBe(true);

    // turbo:load を document に発火 → my が点灯に切替わるはず
    document.dispatchEvent(new Event("turbo:load"));
    expect(my.classList.contains("active")).toBe(true);
    expect(about.classList.contains("active")).toBe(false);
  });

  test("disconnect() 後はイベントリスナが外れる（効果で判定）", () => {
    // 初回 /about → about が点灯
    setPath("/about");
    const { nav, my, about } = buildFooterDOM();
    const controller = app.getControllerForElementAndIdentifier(nav, "mobile-footer");
    expect(about.classList.contains("active")).toBe(true);

    // URLを /mypage に変える
    setPath("/mypage");

    // ここでリスナを外す
    controller.disconnect();

    // 発火しても切替わらない
    const frame = document.createElement("turbo-frame");
    frame.id = "logs_list_mobile";
    document.body.appendChild(frame);
    frame.dispatchEvent(new CustomEvent("turbo:frame-load", { bubbles: true }));
    document.dispatchEvent(new Event("turbo:load"));

    expect(about.classList.contains("active")).toBe(true);
    expect(my.classList.contains("active")).toBe(false);
  });

  test("clearAllActive(): active/aria-current を全削除", () => {
    setPath("/about");
    const { nav, about, my } = buildFooterDOM();
    const controller = app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    controller.setActiveElement(my);
    expect(my.classList.contains("active")).toBe(true);

    controller.clearAllActive();
    expect(my.classList.contains("active")).toBe(false);
    expect(my.hasAttribute("aria-current")).toBe(false);
    expect(about.classList.contains("active")).toBe(false);
  });

  test("updateActiveFromURL: hrefもdata-hrefも無い要素は無視される（分岐カバー）", () => {
    setPath("/about");
    const { nav, invalidBtn, about } = buildFooterDOM({ includeInvalidButton: true });

    app.getControllerForElementAndIdentifier(nav, "mobile-footer");

    // 無効ボタンには active が付いていない（=無視された）
    expect(invalidBtn.classList.contains("active")).toBe(false);
    // 正規の一致要素だけが点灯
    expect(about.classList.contains("active")).toBe(true);
  });
});

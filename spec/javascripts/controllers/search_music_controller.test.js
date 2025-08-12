// spec/javascripts/controllers/search_music_controller.test.js

// Turbo は画面遷移等をしないのでモック
jest.mock("@hotwired/turbo-rails", () => ({
  Turbo: { renderStreamMessage: jest.fn(), visit: jest.fn() }
}));

import { Application } from "@hotwired/stimulus";
import SearchMusicController from "../../../app/javascript/controllers/search_music_controller.js";
import { fireEvent, screen } from "@testing-library/dom";

let app;

// jsdom には scrollIntoView が無いので no-op モック
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    // eslint-disable-next-line no-extend-native
    Element.prototype.scrollIntoView = jest.fn();
  }
});

describe("search_music_controller", () => {
  beforeEach(() => {
    // テスト用の最小DOM（query, loading, results は必須ターゲット）
    document.body.innerHTML = `
      <div data-controller="search-music">
        <input data-search-music-target="query" value="miku">
        <div data-search-music-target="loading" style="display:none"></div>
        <div data-search-music-target="results"></div>
      </div>
    `;

    // Stimulus 起動
    app = Application.start();
    app.register("search-music", SearchMusicController);

    // ノイズ抑制（失敗ケースでの console.error を黙らせる）
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    app.stop();
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("検索成功時に fetch が正しいURLで呼ばれ、結果が描画される", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { title: "Test Song", user: { username: "User" }, permalink_url: "http://example.com" }
      ]
    });

    const controller = app.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller]"),
      "search-music"
    );

    await controller.search();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/soundcloud\/search\?q=miku/),
      expect.any(Object)
    );
    expect(screen.getByText(/Test Song/)).toBeInTheDocument();
    expect(screen.getByText(/User/)).toBeInTheDocument();
  });

  test("検索失敗時に alert が呼ばれる", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Bad Request" })
    });
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    const controller = app.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller]"),
      "search-music"
    );

    await controller.search();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("検索に失敗しました"));
  });

  test("空文字で search() を呼ぶと alert が出る（入力チェック）", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    const controller = app.getControllerForElementAndIdentifier(
      document.querySelector("[data-controller]"),
      "search-music"
    );

    controller.queryTarget.value = "   ";
    await controller.search();

    expect(alertSpy).toHaveBeenCalledWith("検索ワードを入力してください");
  });

  test("ページネーション: 次へ→前へ でページ番号が変わり描画される", async () => {
    // 20件ダミーデータ（perPage=10 → 2ページ）
    const items = Array.from({ length: 20 }).map((_, i) => ({
      title: `Song${i + 1}`,
      user: { username: `User${i + 1}` },
      permalink_url: `http://example.com/${i + 1}`,
      id: i + 1
    }));

    const el = document.querySelector("[data-controller]");
    const controller = app.getControllerForElementAndIdentifier(el, "search-music");

    controller.searchResults = items;
    controller.currentPage = 1;
    controller.renderPage();

    expect(screen.getByText("ページ 1 / 2")).toBeInTheDocument();

    // Stimulus の自動バインドを使わない運用なので、手動でバインドしてクリック
    const nextBtn = screen.getByText("次へ");
    nextBtn.addEventListener("click", controller.nextPage.bind(controller));
    await fireEvent.click(nextBtn);
    expect(screen.getByText("ページ 2 / 2")).toBeInTheDocument();

    const prevBtn = screen.getByText("前へ");
    prevBtn.addEventListener("click", controller.prevPage.bind(controller));
    await fireEvent.click(prevBtn);
    expect(screen.getByText("ページ 1 / 2")).toBeInTheDocument();
  });

  test("select → confirm: 入力に値が入り、fetchAndSwap が正しいURLで呼ばれる", async () => {
    const el = document.querySelector("[data-controller]");
    // confirm で参照される audio/track ターゲットを追加
    el.insertAdjacentHTML("beforeend", `
      <input data-search-music-target="audio">
      <input data-search-music-target="track">
    `);

    const controller = app.getControllerForElementAndIdentifier(el, "search-music");

    controller.searchResults = [{
      title: "Pick Me",
      user: { username: "Singer" },
      permalink_url: "http://example.com/pick",
      id: 99
    }];
    controller.currentPage = 1;
    controller.renderPage();

    const dispatchSpy = jest.spyOn(window, "dispatchEvent");

    // 「選択or視聴」ボタンに select を手動バインドしてからクリック
    const selectBtn = screen.getByText("選択or視聴");
    selectBtn.addEventListener("click", () => controller.select({ target: selectBtn }));
    await fireEvent.click(selectBtn);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));

    // fetchAndSwap をスパイ化（最後の呼び出しで検証）
    const swapSpy = jest.spyOn(controller, "fetchAndSwap").mockResolvedValue();

    // 生成された「この曲にする」を手動バインドしてクリック
    const confirmBtn = screen.getByText("この曲にする");
    confirmBtn.addEventListener("click", controller.confirm.bind(controller));
    await fireEvent.click(confirmBtn);

    // 値が入っていること
    expect(controller.audioTarget.value).toBe("http://example.com/pick");
    expect(controller.trackTarget.value).toBe("Pick Me - Singer");

    // URLは encodeURIComponent 済み（空白は %20）。最後の呼び出しで検証
    // 呼ばれていること（回数は環境で変わることがあるので最後の呼び出しで検証）
expect(swapSpy).toHaveBeenCalled();
expect(swapSpy).toHaveBeenLastCalledWith(
  expect.stringMatching(
    /\/emotion_logs\/form_switch\.turbo_stream\?music_url=http%3A%2F%2Fexample\.com%2Fpick&track_name=Pick%20Me%20-%20Singer/
  )
);

  });
});

// spec/javascripts/sample/mock_apis.test.js

describe("Global API mocks", () => {
  test("fetch をモックして JSON を返す", async () => {
    const mockJson = { ok: true, items: [1, 2, 3] };

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockJson
      });

    const res = await fetch("/api/dummy");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual(mockJson);

    fetchSpy.mockRestore();
  });

  test("window.alert を監視する", () => {
    const spy = jest.spyOn(window, "alert").mockImplementation(() => {});
    window.alert("通知テスト");
    expect(spy).toHaveBeenCalledWith("通知テスト");
    spy.mockRestore();
  });

  test("window.Swal.fire をモックして確認", async () => {
    const spy = jest.spyOn(window.Swal, "fire");
    await window.Swal.fire({ title: "OK?" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual({ title: "OK?" });
    spy.mockRestore();
  });
});

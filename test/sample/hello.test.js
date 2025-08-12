test("Hello World テスト", () => {
  document.body.innerHTML = `<div id="greet">Hello World</div>`;
  const el = document.getElementById("greet");
  expect(el).not.toBeNull();
  expect(el.textContent).toBe("Hello World");
});
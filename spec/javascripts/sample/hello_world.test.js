// spec/javascripts/sample/hello_world.test.js
import { getByText } from "@testing-library/dom";
import { renderHTML } from "../helpers/dom";

describe("Hello World smoke test", () => {
  test("DOM に 'Hello World' が表示される", () => {
    renderHTML(`
      <main>
        <h1 id="title">Hello World</h1>
      </main>
    `);
    const title = getByText(document.body, "Hello World");
    expect(title).toBeInTheDocument();
    expect(title.id).toBe("title");
  });
});

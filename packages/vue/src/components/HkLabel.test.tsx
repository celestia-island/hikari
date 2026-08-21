import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkLabel from "./HkLabel";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkLabel", () => {
  it("renders plain text through the text prop inside the label shell", () => {
    const c = mount(h(HkLabel, { text: "Remember login" }));
    const label = c.querySelector(".hk-label") as HTMLElement;
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Remember login");
    expect(label.className).toContain("hk-label-md");
  });

  it("renders rich content through the default slot", () => {
    const c = mount(
      h(HkLabel, () => [
        "I have read and agree to the ",
        h("a", { onClick: () => {} }, "User Agreement"),
      ]),
    );
    const label = c.querySelector(".hk-label") as HTMLElement;
    expect(label.textContent).toBe("I have read and agree to the User Agreement");
    expect(label.querySelector("a")).not.toBeNull();
  });

  it("prefers the default slot over the text prop", () => {
    const c = mount(
      h(HkLabel, { text: "plain" }, () => ["rich"]),
    );
    expect((c.querySelector(".hk-label") as HTMLElement).textContent).toBe("rich");
  });

  it("maps the size prop to a shell modifier", () => {
    const c = mount(h(HkLabel, { text: "x", size: "sm" }));
    expect((c.querySelector(".hk-label") as HTMLElement).className).toContain("hk-label-sm");
  });

  it("renders nothing when there is no text and no slot", () => {
    const c = mount(h(HkLabel));
    expect(c.querySelector(".hk-label")).toBeNull();
  });
});

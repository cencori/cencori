import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinueToTensor } from "../continue-to-tensor";

const CALLBACK = "tensor://auth/callback?code=c&state=s";
const props = { challenge: "a".repeat(43), redirectUri: "tensor://auth/callback", state: "s".repeat(43) };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function stubAuthorize() {
  const fetch = vi.fn(async () => ({
    json: async () => ({ callback_url: CALLBACK }),
    ok: true,
    status: 200,
  }));
  vi.stubGlobal("fetch", fetch);
  const assign = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
  return { assign, fetch };
}

async function mount() {
  await act(async () => {
    root.render(<ContinueToTensor {...props} />);
  });
  const button = container.querySelector("button");
  if (!button) throw new Error("No button rendered.");
  return button;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Continue to Tensor", () => {
  it("prepares the link on load, so the click opens the app without waiting", async () => {
    const { assign, fetch } = stubAuthorize();
    const button = await mount();
    expect(fetch).toHaveBeenCalledTimes(1);

    // Opened inside the click itself: nothing awaited between the press and the app.
    act(() => button.click());
    expect(assign).toHaveBeenCalledWith(CALLBACK);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe("Open Tensor");
  });

  it("fetches a fresh link when the prepared one has gone stale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { assign, fetch } = stubAuthorize();
    const button = await mount();

    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    await act(async () => button.click());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenCalledWith(CALLBACK);
  });
});

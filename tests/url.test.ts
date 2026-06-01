import { describe, expect, it } from "vitest";
import { isSafeHttpUrl } from "../src/url";

describe("isSafeHttpUrl", () => {
  it.each(["https://example.com/story", "http://example.com/image.jpg"])("accepts %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "/relative", "not a url"])("rejects %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(false);
  });
});

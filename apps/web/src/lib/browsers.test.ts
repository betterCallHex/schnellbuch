import { describe, expect, test as it } from "bun:test";
import { canImportDirectly, detectBrowser } from "./browsers";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const NOT_A_BRAND = "Not)A;Brand";

function signals(overrides: Partial<Parameters<typeof detectBrowser>[0]>) {
  return { brands: [], userAgent: CHROME_UA, isBrave: false, ...overrides };
}

describe("detectBrowser", () => {
  it("names a Chromium browser by its own brand", () => {
    expect(
      detectBrowser(
        signals({ brands: [NOT_A_BRAND, "Chromium", "Google Chrome"] })
      )
    ).toEqual({ name: "Chrome", engine: "chromium" });
    expect(
      detectBrowser(
        signals({ brands: ["Chromium", NOT_A_BRAND, "Microsoft Edge"] })
      )
    ).toEqual({ name: "Edge", engine: "chromium" });
    expect(
      detectBrowser(signals({ brands: ["Chromium", "Opera", NOT_A_BRAND] }))
    ).toEqual({ name: "Opera", engine: "chromium" });
  });

  it("knows Brave by navigator.brave, even when it calls itself Chrome", () => {
    expect(
      detectBrowser(
        signals({ brands: ["Chromium", "Google Chrome"], isBrave: true })
      )
    ).toEqual({ name: "Brave", engine: "chromium" });
  });

  it("leaves a Chromium browser without its own brand unnamed", () => {
    expect(
      detectBrowser(signals({ brands: [NOT_A_BRAND, "Chromium"] }))
    ).toEqual({ name: undefined, engine: "chromium" });
  });

  it("falls back to the user agent where brands aren't available", () => {
    expect(
      detectBrowser(
        signals({
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 15.1; rv:144.0) Gecko/20100101 Firefox/144.0",
        })
      )
    ).toEqual({ name: "Firefox", engine: "firefox" });
    expect(
      detectBrowser(
        signals({
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15",
        })
      )
    ).toEqual({ name: "Safari", engine: "webkit" });
    expect(
      detectBrowser(signals({ userAgent: `${CHROME_UA} OPR/122.0.0.0` }))
    ).toEqual({ name: "Opera", engine: "chromium" });
    expect(
      detectBrowser(signals({ userAgent: `${CHROME_UA} Edg/141.0.0.0` }))
    ).toEqual({ name: "Edge", engine: "chromium" });
    expect(detectBrowser(signals({}))).toEqual({
      name: "Chrome",
      engine: "chromium",
    });
  });

  it("names nothing it doesn't recognise", () => {
    expect(detectBrowser(signals({ userAgent: "curl/8.7.1" }))).toEqual({
      name: undefined,
      engine: undefined,
    });
  });
});

describe("canImportDirectly", () => {
  const chrome = { name: "Chrome", engine: "chromium" } as const;
  const unnamedChromium = { name: undefined, engine: "chromium" } as const;

  it("needs the extension in this browser", () => {
    expect(canImportDirectly("Chrome", chrome, undefined)).toBe(false);
    expect(canImportDirectly("Chrome", chrome, "chromium")).toBe(true);
  });

  it("refuses a browser this page is certainly not running in", () => {
    expect(canImportDirectly("Edge", chrome, "chromium")).toBe(false);
    expect(canImportDirectly("Firefox", chrome, "chromium")).toBe(false);
    expect(canImportDirectly("Safari", chrome, "chromium")).toBe(false);
    expect(
      canImportDirectly(
        "Firefox",
        { name: "Firefox", engine: "firefox" },
        "chromium"
      )
    ).toBe(false);
  });

  it("accepts any Chromium pick when the browser can't be told apart", () => {
    expect(canImportDirectly("Vivaldi", unnamedChromium, "chromium")).toBe(
      true
    );
    expect(canImportDirectly("Edge", unnamedChromium, "chromium")).toBe(true);
    expect(canImportDirectly("Arc", chrome, "chromium")).toBe(true);
    expect(canImportDirectly("Vivaldi", chrome, "chromium")).toBe(true);
  });

  it("matches Firefox only to the Firefox extension", () => {
    const firefox = { name: "Firefox", engine: "firefox" } as const;
    expect(canImportDirectly("Firefox", firefox, "firefox")).toBe(true);
    expect(canImportDirectly("Chrome", firefox, "firefox")).toBe(false);
  });
});

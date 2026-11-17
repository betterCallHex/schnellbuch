import { afterEach, describe, expect, test as it, vi } from "vitest";
import {
  BlockedAddressError,
  fetchPublic,
  isPublicUrl,
  readTextUpTo,
} from "./fetching";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isPublicUrl", () => {
  it("accepts web addresses on public hosts", () => {
    expect(
      [
        "https://example.com/",
        "http://93.184.215.14/page",
        "https://[2606:4700::1111]/",
        "https://172.32.0.1/",
      ].map(isPublicUrl)
    ).toEqual([true, true, true, true]);
  });

  it("refuses private networks, loopback, metadata services and local names", () => {
    expect(
      [
        "http://127.0.0.1/",
        "http://0x7f.1/",
        "http://10.1.2.3/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://100.64.0.1/",
        "http://0.0.0.0/",
        "http://224.0.0.1/",
        "http://[::1]/",
        "http://[fd00::1]/",
        "http://[fe80::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://localhost/",
        "http://printer.local/",
        "http://db.internal/",
        "http://router.home.arpa/",
        "ftp://example.com/",
        "not a url",
      ].map(isPublicUrl)
    ).toEqual(new Array(19).fill(false));
  });
});

describe("fetchPublic", () => {
  it("follows redirects between public pages", async () => {
    const requested: string[] = [];
    vi.stubGlobal("fetch", (requestedUrl: string) => {
      requested.push(requestedUrl);
      return Promise.resolve(
        requestedUrl === "https://old.example.com/"
          ? new Response(null, {
              status: 301,
              headers: { location: "/moved" },
            })
          : new Response("here")
      );
    });

    const { response, url } = await fetchPublic("https://old.example.com/", {
      timeoutMs: 1000,
    });

    expect(url).toBe("https://old.example.com/moved");
    expect(await response.text()).toBe("here");
    expect(requested).toEqual([
      "https://old.example.com/",
      "https://old.example.com/moved",
    ]);
  });

  it("stops at a redirect into a private network without requesting it", async () => {
    const requested: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      requested.push(url);
      return Promise.resolve(
        Response.redirect("http://169.254.169.254/latest/meta-data/", 302)
      );
    });

    await expect(
      fetchPublic("https://sneaky.example.com/", { timeoutMs: 1000 })
    ).rejects.toBeInstanceOf(BlockedAddressError);
    expect(requested).toEqual(["https://sneaky.example.com/"]);
  });

  it("gives up on a redirect loop", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(null, { status: 307, headers: { location: "/again" } })
      )
    );

    await expect(
      fetchPublic("https://loop.example.com/", { timeoutMs: 1000 })
    ).rejects.toThrow("redirects too many times");
  });
});

describe("readTextUpTo", () => {
  it("reads only the start of a long body", async () => {
    const body = "a".repeat(10_000);

    expect(await readTextUpTo(new Response(body), 100)).toBe("a".repeat(100));
    expect(await readTextUpTo(new Response("short"), 100)).toBe("short");
  });
});

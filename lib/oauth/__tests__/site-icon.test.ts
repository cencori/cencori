import { describe, expect, it } from "vitest";
import { iconCandidates, isPrivateAddress, sniffImage } from "../site-icon";

describe("isPrivateAddress", () => {
  it("refuses this machine, private networks and cloud metadata", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not-an-address",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "100.63.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});

describe("iconCandidates", () => {
  const page = new URL("https://app.example.com/pricing");

  it("prefers the touch icon, then larger icons, and resolves relative addresses", () => {
    const html = `
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
      <link href='https://cdn.example.com/touch.png' rel='apple-touch-icon'>
      <link rel="stylesheet" href="/site.css">`;
    expect(iconCandidates(html, page).map((url) => url.href)).toEqual([
      "https://cdn.example.com/touch.png",
      "https://app.example.com/icon-192.png",
      "https://app.example.com/favicon-32.png",
      "https://app.example.com/apple-touch-icon.png",
    ]);
  });

  it("leaves out SVG, .ico and mask icons", () => {
    const html = `
      <link rel="icon" href="/logo.svg" type="image/svg+xml">
      <link rel="shortcut icon" href="/favicon.ico">
      <link rel="mask-icon" href="/mask.png">
      <link rel="icon" type="image/svg+xml" href="/icon">`;
    expect(iconCandidates(html, page).map((url) => url.href)).toEqual(["https://app.example.com/apple-touch-icon.png"]);
  });

  it("falls back to the conventional touch icon when the page names nothing", () => {
    expect(iconCandidates("<html></html>", page).map((url) => url.href)).toEqual([
      "https://app.example.com/apple-touch-icon.png",
    ]);
  });
});

describe("sniffImage", () => {
  it("recognises PNG, JPEG and WebP by their first bytes", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.extension).toBe("png");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))?.extension).toBe("webp");
  });

  it("refuses anything else, whatever it is called", () => {
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImage(Buffer.from("<!doctype html>"))).toBeNull();
    expect(sniffImage(Buffer.from([0, 0, 1, 0]))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

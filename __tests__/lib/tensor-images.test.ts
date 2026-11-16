import { afterEach, describe, expect, it, vi } from "vitest";
import { imageFromPexels, imageFromPixabay, imageLibrary, ImageSearchUnavailable, readImageSearch, searchPexels, searchPixabay } from "@/lib/tensor-images";

const photo = {
  id: 2014422,
  width: 3024,
  height: 3024,
  url: "https://www.pexels.com/photo/brown-rocks-during-golden-hour-2014422/",
  photographer: "Joey Farina",
  photographer_url: "https://www.pexels.com/@joey",
  avg_color: "#978E82",
  src: {
    original: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg",
    large2x: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?w=1880",
    large: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?h=650",
    medium: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?h=350",
    small: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?h=130",
  },
  alt: "Brown Rocks During Golden Hour",
};

describe("reading a photo search", () => {
  it("cleans the query and keeps counts in range", () => {
    expect(readImageSearch({ query: "  quiet   bakery interior ", orientation: "portrait", count: 40 })).toEqual({
      query: "quiet bakery interior",
      orientation: "portrait",
      count: 12,
      page: 1,
    });
    expect(readImageSearch({ query: "desk", orientation: "sideways", count: 0, page: 3 })).toEqual({
      query: "desk",
      orientation: undefined,
      count: 1,
      page: 3,
    });
  });

  it("refuses an empty or overlong query", () => {
    expect(readImageSearch({ query: "   " })).toHaveProperty("error");
    expect(readImageSearch(null)).toHaveProperty("error");
    expect(readImageSearch({ query: "x".repeat(121) })).toHaveProperty("error");
  });
});

describe("Pexels' photos", () => {
  it("become Tensor's results", () => {
    expect(imageFromPexels(photo)).toEqual({
      id: "2014422",
      description: "Brown Rocks During Golden Hour",
      width: 3024,
      height: 3024,
      color: "#978E82",
      photographer: "Joey Farina",
      photographerUrl: "https://www.pexels.com/@joey",
      pageUrl: photo.url,
      src: photo.src,
    });
  });

  it("drops a photo with nothing to download", () => {
    expect(imageFromPexels({ ...photo, src: {} })).toBeNull();
    expect(imageFromPexels("nope")).toBeNull();
  });
});

describe("searching Pexels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the key and the search, and reads the photos", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ photos: [photo, { id: 1 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const images = await searchPexels({ query: "rocks", orientation: "square", count: 2, page: 1 }, "key");
    expect(images.map((image) => image.id)).toEqual(["2014422"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pexels.com/v1/search?query=rocks&per_page=2&page=1&orientation=square");
    expect((init.headers as Record<string, string>).Authorization).toBe("key");
  });

  it("says so when Pexels is out of searches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(searchPexels({ query: "rocks", count: 1, page: 1 }, "key")).rejects.toBeInstanceOf(ImageSearchUnavailable);
  });
});

const hit = {
  id: 195893,
  pageURL: "https://pixabay.com/en/blossom-bloom-flower-195893/",
  tags: "blossom, bloom, flower",
  previewURL: "https://cdn.pixabay.com/photo/2013/10/15/09/12/flower-195893_150.jpg",
  webformatURL: "https://pixabay.com/get/35bbf209e13e39d2_640.jpg",
  largeImageURL: "https://pixabay.com/get/ed6a99fd0a76647_1280.jpg",
  imageWidth: 4000,
  imageHeight: 2250,
  user_id: 48777,
  user: "Josch13",
};

describe("Pixabay's photos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("become Tensor's results", () => {
    expect(imageFromPixabay(hit)).toMatchObject({
      id: "195893",
      description: "Tagged: blossom, bloom, flower",
      width: 4000,
      height: 2250,
      photographer: "Josch13",
      photographerUrl: "https://pixabay.com/users/Josch13-48777/",
      pageUrl: hit.pageURL,
      src: { medium: hit.webformatURL, large: hit.largeImageURL, large2x: hit.largeImageURL },
    });
    expect(imageFromPixabay({ id: 1 })).toBeNull();
  });

  it("searches photos only, safely, and keeps square ones for a square search", async () => {
    const square = { ...hit, id: 2, imageWidth: 1000, imageHeight: 1000 };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ hits: [hit, square] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const images = await searchPixabay({ query: "flower", orientation: "square", count: 2, page: 1 }, "key");
    expect(images.map((image) => image.id)).toEqual(["2"]);
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ key: "key", q: "flower", image_type: "photo", safesearch: "true", per_page: "40" });
  });
});

describe("which library", () => {
  it("is Pexels when it has a key, else Pixabay, else none", () => {
    expect(imageLibrary({ PEXELS_API_KEY: "a", PIXABAY_API_KEY: "b" })?.name).toBe("Pexels");
    expect(imageLibrary({ PIXABAY_API_KEY: "b" })?.name).toBe("Pixabay");
    expect(imageLibrary({ PEXELS_API_KEY: " " })).toBeNull();
  });
});

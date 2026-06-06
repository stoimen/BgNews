import { describe, expect, it } from "vitest";
import { mapFeed, mapRtvePage, mergeSourceResults, stripHtml } from "../scripts/generate-news";
import { sources } from "../src/sources";
import type { NewsItem, NewsPayload } from "../src/types";

const source = sources[0];

describe("stripHtml", () => {
  it("removes markup and decodes common entities", () => {
    expect(stripHtml("<p>One&nbsp;&amp;&nbsp;<strong>two</strong></p>")).toBe("One & two");
  });
});

describe("mapFeed", () => {
  it("maps RSS items", () => {
    const items = mapFeed(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>RSS title</title>
            <link>https://example.com/rss</link>
            <guid>rss-id</guid>
            <pubDate>Fri, 15 May 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<p>RSS summary</p><img src="https://example.com/rss.jpg" />]]></description>
          </item>
        </channel>
      </rss>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "rss-id",
      title: "RSS title",
      summary: "RSS summary",
      link: "https://example.com/rss",
      sourceId: source.id,
      imageUrl: "https://example.com/rss.jpg",
    });
  });

  it("maps RSS media thumbnails", () => {
    const items = mapFeed(
      `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <item>
            <title><![CDATA[RSS media title]]></title>
            <link>https://example.com/media-title.html</link>
            <description><![CDATA[<img src="https://example.com/media.jpg" alt="" />RSS media summary.]]></description>
            <pubDate>Mon, 18 May 2026 12:37:41 +0300</pubDate>
            <guid isPermaLink="false">https://example.com/news/read/1</guid>
            <dc:creator>example.com</dc:creator>
            <media:thumbnail url="https://example.com/media.jpg" width="330" height="186" />
          </item>
        </channel>
      </rss>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "https://example.com/news/read/1",
      title: "RSS media title",
      summary: "RSS media summary.",
      link: "https://example.com/media-title.html",
      sourceId: source.id,
      imageUrl: "https://example.com/media.jpg",
    });
  });

  it("uses RSS enclosure image URLs even when the type is malformed", () => {
    const items = mapFeed(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Enclosure title</title>
            <link>https://news.bnt.bg/news/story-1394712news.html</link>
            <guid>https://news.bnt.bg/news/story-1394712news.html</guid>
            <pubDate>Fri, 22 May 2026 21:21:00 +0300</pubDate>
            <description>Enclosure summary</description>
            <enclosure url="https://news.bnt.bg/f/news/m/1394/8fe05fe0ba4464dbe4d5e58d33c901cf.jpeg" type="vary: User-Agent" length="x-content-type-options: nosniff"/>
          </item>
        </channel>
      </rss>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Enclosure title",
      imageUrl: "https://news.bnt.bg/f/news/m/1394/8fe05fe0ba4464dbe4d5e58d33c901cf.jpeg",
    });
  });

  it("maps Atom entries", () => {
    const items = mapFeed(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>atom-id</id>
          <title>Atom title</title>
          <link href="https://example.com/atom" />
          <updated>2026-05-15T11:00:00Z</updated>
          <summary>Atom summary</summary>
          <media:thumbnail url="https://example.com/atom.jpg" />
        </entry>
      </feed>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "atom-id",
      title: "Atom title",
      summary: "Atom summary",
      link: "https://example.com/atom",
      sourceId: source.id,
      imageUrl: "https://example.com/atom.jpg",
    });
  });

  it("maps RDF items", () => {
    const items = mapFeed(
      `<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <item rdf:about="https://example.com/rdf">
          <title>RDF title</title>
          <link>https://example.com/rdf</link>
          <dc:date>2026-05-15T12:00:00Z</dc:date>
          <description>RDF summary</description>
        </item>
      </rdf:RDF>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "https://example.com/rdf",
      title: "RDF title",
      summary: "RDF summary",
      link: "https://example.com/rdf",
      sourceId: source.id,
    });
  });
});

describe("mapRtvePage", () => {
  it("maps RTVE article cards from the news page", () => {
    const rtve = sources.find((source) => source.id === "rtve") ?? sources[0];
    const items = mapRtvePage(
      `<article class="cell" data-noi="17102641">
        <figure><img src="https://img.rtve.es/i/17102641?w=300" alt="Cuba"/></figure>
        <h3>
          <a href="https://www.rtve.es/noticias/20260606/turismo-cuba-hundimiento-salvavidas-economia/17102641.shtml">
            <span class="maintitle">Turismo en Cuba: &quot;un salvavidas&quot;</span>
          </a>
        </h3>
      </article>`,
      rtve,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "17102641",
      title: 'Turismo en Cuba: "un salvavidas"',
      link: "https://www.rtve.es/noticias/20260606/turismo-cuba-hundimiento-salvavidas-economia/17102641.shtml",
      pubDate: "2026-06-06T12:00:00.000Z",
      sourceId: "rtve",
      imageUrl: "https://img.rtve.es/i/17102641?w=300",
    });
  });
});

describe("mergeSourceResults", () => {
  const cachedBbcItem: NewsItem = {
    id: "cached",
    title: "Cached BBC",
    summary: "Cached summary",
    link: "https://www.bbc.com/news/world/cached",
    pubDate: "2026-05-23T10:00:00.000Z",
    sourceId: "bbc",
  };

  const previousPayload: NewsPayload = {
    generatedAt: "2026-05-23T10:00:00.000Z",
    sources: [...sources],
    errors: [],
    items: [cachedBbcItem],
  };

  it("uses cached items without creating a visible feed error", () => {
    const settled = sources.map((source): PromiseSettledResult<NewsItem[]> => {
      if (source.id === "bbc") {
        return { status: "rejected", reason: new Error("403 Forbidden") };
      }

      return { status: "fulfilled", value: [] };
    });

    const result = mergeSourceResults(settled, previousPayload);

    expect(result.items).toEqual([cachedBbcItem]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      {
        sourceId: "bbc",
        message: "403 Forbidden; using 1 cached items",
      },
    ]);
  });

  it("creates a visible feed error when no cached items are available", () => {
    const settled = sources.map((source): PromiseSettledResult<NewsItem[]> => {
      if (source.id === "bbc") {
        return { status: "rejected", reason: new Error("403 Forbidden") };
      }

      return { status: "fulfilled", value: [] };
    });

    const result = mergeSourceResults(settled, { ...previousPayload, items: [] });

    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([
      {
        sourceId: "bbc",
        message: "403 Forbidden",
      },
    ]);
  });
});

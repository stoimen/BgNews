import { describe, expect, it } from "vitest";
import { mapFeed, mergeSourceResults, stripHtml } from "../scripts/generate-news";
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

  it("maps Mediapool RSS items", () => {
    const items = mapFeed(
      `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <item>
            <title><![CDATA[48 килорама кокаин са хванати на "Капитан Андреево"]]></title>
            <link>https://www.mediapool.bg/48-kilorama-kokain-sa-hvanati-na-kapitan-andreevo-news383470.html</link>
            <description><![CDATA[<img src="https://www.mediapool.bg/images/383/medium_94110a265673fb2b4588f5a08e83d871.jpg" alt="" />Голяма пратка кокаин е задържана.]]></description>
            <pubDate>Mon, 18 May 2026 12:37:41 +0300</pubDate>
            <guid isPermaLink="false">https://www.mediapool.bg/news/read/383470</guid>
            <dc:creator>mediapool.bg</dc:creator>
            <media:thumbnail url="https://www.mediapool.bg/images/383/medium_94110a265673fb2b4588f5a08e83d871.jpg" width="330" height="186" />
          </item>
        </channel>
      </rss>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "https://www.mediapool.bg/news/read/383470",
      title: '48 килорама кокаин са хванати на "Капитан Андреево"',
      summary: "Голяма пратка кокаин е задържана.",
      link: "https://www.mediapool.bg/48-kilorama-kokain-sa-hvanati-na-kapitan-andreevo-news383470.html",
      sourceId: "mediapool",
      imageUrl: "https://www.mediapool.bg/images/383/medium_94110a265673fb2b4588f5a08e83d871.jpg",
    });
  });

  it("uses RSS enclosure image URLs even when the type is malformed", () => {
    const items = mapFeed(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>BNT title</title>
            <link>https://news.bnt.bg/news/story-1394712news.html</link>
            <guid>https://news.bnt.bg/news/story-1394712news.html</guid>
            <pubDate>Fri, 22 May 2026 21:21:00 +0300</pubDate>
            <description>BNT summary</description>
            <enclosure url="https://news.bnt.bg/f/news/m/1394/8fe05fe0ba4464dbe4d5e58d33c901cf.jpeg" type="vary: User-Agent" length="x-content-type-options: nosniff"/>
          </item>
        </channel>
      </rss>`,
      source,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "BNT title",
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

describe("mergeSourceResults", () => {
  const cachedMediapoolItem: NewsItem = {
    id: "cached",
    title: "Cached Mediapool",
    summary: "Cached summary",
    link: "https://www.mediapool.bg/cached-news.html",
    pubDate: "2026-05-23T10:00:00.000Z",
    sourceId: "mediapool",
  };

  const previousPayload: NewsPayload = {
    generatedAt: "2026-05-23T10:00:00.000Z",
    sources: [...sources],
    errors: [],
    items: [cachedMediapoolItem],
  };

  it("uses cached items without creating a visible feed error", () => {
    const settled = sources.map((source): PromiseSettledResult<NewsItem[]> => {
      if (source.id === "mediapool") {
        return { status: "rejected", reason: new Error("403 Forbidden") };
      }

      return { status: "fulfilled", value: [] };
    });

    const result = mergeSourceResults(settled, previousPayload);

    expect(result.items).toEqual([cachedMediapoolItem]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      {
        sourceId: "mediapool",
        message: "403 Forbidden; using 1 cached items",
      },
    ]);
  });

  it("creates a visible feed error when no cached items are available", () => {
    const settled = sources.map((source): PromiseSettledResult<NewsItem[]> => {
      if (source.id === "mediapool") {
        return { status: "rejected", reason: new Error("403 Forbidden") };
      }

      return { status: "fulfilled", value: [] };
    });

    const result = mergeSourceResults(settled, { ...previousPayload, items: [] });

    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([
      {
        sourceId: "mediapool",
        message: "403 Forbidden",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { mapFeed, stripHtml } from "../scripts/generate-news";
import { sources } from "../src/sources";

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

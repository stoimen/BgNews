import { XMLParser } from "fast-xml-parser";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const userAgent = "Mozilla/5.0 (compatible; BgNews/1.0; +https://github.com/stoimen/BgNews)";

const sources = [
  {
    id: "mediapool",
    name: "Mediapool",
    shortName: "Mediapool",
    color: "#2563eb",
    feedUrl: "https://www.mediapool.bg/rss",
  },
  {
    id: "boulevard",
    name: "Boulevard Bulgaria",
    shortName: "Boulevard",
    color: "#f97316",
    feedUrl: "https://boulevardbulgaria.bg/feed.atom",
  },
  {
    id: "bnt",
    name: "BNT News",
    shortName: "BNT",
    color: "#dc2626",
    feedUrl: "http://news.bnt.bg/bg/rss/news.xml",
  },
  {
    id: "nova",
    name: "Nova",
    shortName: "Nova",
    color: "#00a7d8",
    feedUrl: "https://nova.bg/rss/latest",
  },
  {
    id: "capital",
    name: "Capital",
    shortName: "Capital",
    color: "#0f766e",
    feedUrl: "https://www.capital.bg/rss/",
  },
  {
    id: "darik",
    name: "Darik News",
    shortName: "Darik",
    color: "#7c3aed",
    feedUrl: "https://dariknews.bg/rss.php",
  },
  {
    id: "economic",
    name: "Economic.bg",
    shortName: "Economic",
    color: "#16a34a",
    feedUrl: "https://www.economic.bg/rss/all.xml",
  },
  {
    id: "sega",
    name: "Sega",
    shortName: "Sega",
    color: "#be123c",
    feedUrl: "https://www.segabg.com/rss/hot-news",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  cdataPropName: "value",
  textNodeName: "value",
  trimValues: true,
});

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const textOf = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(textOf).find(Boolean) ?? "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.value === "string") return value.value;
  if (typeof value["#text"] === "string") return value["#text"];
  return "";
};

const stripHtml = (html = "") =>
  textOf(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const firstImageInHtml = (html = "") => {
  const match = textOf(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? undefined;
};

const mediaImage = (item) => {
  const thumbnail = item["media:thumbnail"];
  if (thumbnail?.url) return thumbnail.url;
  const content = asArray(item["media:content"]).find((entry) => entry?.url);
  if (content?.url) return content.url;
  if (item.enclosure?.url && item.enclosure?.type?.startsWith?.("image/")) return item.enclosure.url;
  return firstImageInHtml(item.description ?? item.summary ?? item.content ?? item["content:encoded"]);
};

const firstLink = (links) => {
  const link = asArray(links).find((entry) => typeof entry === "string" || entry?.href);
  if (typeof link === "string") return link;
  return link?.href ?? "";
};

const toIsoDate = (value) => {
  const date = new Date(textOf(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const mapFeed = (xml, source) => {
  const feed = parser.parse(xml);

  if (feed.feed?.entry) {
    return asArray(feed.feed.entry)
      .map((entry) => {
        const link = firstLink(entry.link);
        const summary = entry.summary ?? entry.content ?? "";
        return {
          id: textOf(entry.id) || link,
          title: stripHtml(entry.title),
          summary: stripHtml(summary),
          link,
          pubDate: toIsoDate(entry.published ?? entry.updated),
          sourceId: source.id,
          imageUrl: mediaImage(entry),
        };
      })
      .filter((item) => item.title && item.link && item.pubDate);
  }

  const items = feed.rss?.channel?.item ?? feed["rdf:RDF"]?.item;
  return asArray(items)
    .map((item) => {
      const link = textOf(item.link);
      return {
        id: textOf(item.guid) || link,
        title: stripHtml(item.title),
        summary: stripHtml(item.description ?? item["content:encoded"] ?? ""),
        link,
        pubDate: toIsoDate(item.pubDate ?? item["dc:date"]),
        sourceId: source.id,
        imageUrl: mediaImage(item),
      };
    })
    .filter((item) => item.title && item.link && item.pubDate);
};

const fetchSource = async (source) => {
  let xml;

  try {
    const response = await fetch(source.feedUrl, {
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": userAgent,
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    xml = await response.text();
  } catch {
    const { stdout } = await execFileAsync("curl", [
      "-fsSL",
      "-A",
      userAgent,
      "-H",
      "Accept: application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      source.feedUrl,
    ], {
      maxBuffer: 10 * 1024 * 1024,
    });
    xml = stdout;
  }

  const items = mapFeed(xml, source);
  if (items.length === 0) {
    throw new Error(`No items parsed from ${source.feedUrl}`);
  }

  return items;
};

const previousPayload = await readFile("public/news.json", "utf8")
  .then((content) => JSON.parse(content))
  .catch(() => null);

const settled = await Promise.allSettled(sources.map(fetchSource));
const errors = [];
const items = [];

settled.forEach((result, index) => {
  const source = sources[index];
  if (result.status === "fulfilled") {
    items.push(...result.value);
  } else {
    const cachedItems = previousPayload?.items?.filter((item) => item.sourceId === source.id) ?? [];
    items.push(...cachedItems);
    errors.push({
      sourceId: source.id,
      message: `${result.reason.message}${cachedItems.length ? `; using ${cachedItems.length} cached items` : ""}`,
    });
  }
});

items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

const payload = {
  generatedAt: new Date().toISOString(),
  sources,
  errors,
  items: items.slice(0, 120),
};

await mkdir("public", { recursive: true });
await writeFile("public/news.json", `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Generated public/news.json with ${payload.items.length} items`);
if (errors.length) {
  console.warn("Some feeds failed:", errors.map((error) => `${error.sourceId}: ${error.message}`).join("; "));
}

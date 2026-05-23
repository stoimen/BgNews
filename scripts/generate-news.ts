import { XMLParser } from "fast-xml-parser";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { sources } from "../src/sources.js";
import type { NewsItem, NewsPayload, NewsSource } from "../src/types.js";

const execFileAsync = promisify(execFile);
const userAgent = "Mozilla/5.0 (compatible; BgNews/1.0; +https://github.com/stoimen/BgNews)";
const fetchTimeoutMs = 10_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  cdataPropName: "value",
  textNodeName: "value",
  trimValues: true,
});

type XmlNode = string | number | null | undefined | XmlObject | XmlNode[];

interface XmlObject {
  [key: string]: XmlNode;
}

const isRecord = (value: unknown): value is XmlObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const textOf = (value: XmlNode): string => {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(textOf).find(Boolean) ?? "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.value === "string") return value.value;
  if (typeof value["#text"] === "string") return value["#text"];
  return "";
};

export const stripHtml = (html: XmlNode = "") =>
  textOf(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const firstImageInHtml = (html: XmlNode = "") => {
  const match = textOf(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? undefined;
};

const nodeProp = (value: XmlObject, key: string) => value[key];

const stringProp = (value: XmlObject, key: string) => {
  const prop = nodeProp(value, key);
  return typeof prop === "string" ? prop : undefined;
};

const imageUrlPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;

const looksLikeImageUrl = (url: string) => imageUrlPattern.test(url);

const mediaImage = (item: XmlObject) => {
  const thumbnail = item["media:thumbnail"];
  if (isRecord(thumbnail) && typeof thumbnail.url === "string") return thumbnail.url;
  const content = asArray(item["media:content"]).find((entry) => isRecord(entry) && typeof entry.url === "string");
  if (isRecord(content) && typeof content.url === "string") return content.url;
  const enclosure = item.enclosure;
  if (isRecord(enclosure) && typeof enclosure.url === "string") {
    const type = stringProp(enclosure, "type");
    if (type?.startsWith("image/") || looksLikeImageUrl(enclosure.url)) return enclosure.url;
  }
  return firstImageInHtml(item.description ?? item.summary ?? item.content ?? item["content:encoded"]);
};

const firstLink = (links: XmlNode) => {
  const link = asArray(links).find(
    (entry) => typeof entry === "string" || (isRecord(entry) && typeof entry.href === "string"),
  );
  if (typeof link === "string") return link;
  return isRecord(link) && typeof link.href === "string" ? link.href : "";
};

const toIsoDate = (value: XmlNode) => {
  const date = new Date(textOf(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

export const mapFeed = (xml: string, source: NewsSource): NewsItem[] => {
  const feed = parser.parse(xml) as XmlObject;
  const atomFeed = feed.feed;

  if (isRecord(atomFeed) && atomFeed.entry) {
    return asArray(atomFeed.entry)
      .filter(isRecord)
      .map((entry): NewsItem => {
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

  const rss = feed.rss;
  const rssChannel = isRecord(rss) && isRecord(rss.channel) ? rss.channel : undefined;
  const rdf = feed["rdf:RDF"];
  const items = rssChannel?.item ?? (isRecord(rdf) ? rdf.item : undefined);

  return asArray(items)
    .filter(isRecord)
    .map((item): NewsItem => {
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

const fetchWithTimeout = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": userAgent,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchWithCurl = async (url: string) => {
  const { stdout } = await execFileAsync(
    "curl",
    ["-fsSL", "-A", userAgent, "-H", "Accept: application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8", url],
    {
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return stdout;
};

const parseSourceXml = (xml: string, source: NewsSource) => {
  const items = mapFeed(xml, source);
  if (items.length === 0) {
    throw new Error(`No items parsed from ${source.feedUrl}`);
  }

  return items;
};

const fetchSource = async (source: NewsSource): Promise<NewsItem[]> => {
  let firstError: unknown;

  try {
    const response = await fetchWithTimeout(source.feedUrl);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseSourceXml(await response.text(), source);
  } catch (error) {
    firstError = error;
  }

  try {
    return parseSourceXml(await fetchWithCurl(source.feedUrl), source);
  } catch (error) {
    const primaryMessage = errorMessage(firstError);
    const fallbackMessage = errorMessage(error);
    throw new Error(`Fetch failed: ${primaryMessage}; curl fallback failed: ${fallbackMessage}`, { cause: error });
  }
};

const readPreviousPayload = async () =>
  readFile("public/news.json", "utf8")
    .then((content) => JSON.parse(content) as NewsPayload)
    .catch(() => null);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const mergeSourceResults = (
  settled: PromiseSettledResult<NewsItem[]>[],
  previousPayload: NewsPayload | null,
) => {
  const errors: NewsPayload["errors"] = [];
  const items: NewsItem[] = [];
  const warnings: NewsPayload["errors"] = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      const cachedItems = previousPayload?.items?.filter((item) => item.sourceId === source.id) ?? [];
      items.push(...cachedItems);

      const failure = {
        sourceId: source.id,
        message: `${errorMessage(result.reason)}${cachedItems.length ? `; using ${cachedItems.length} cached items` : ""}`,
      };

      if (cachedItems.length) {
        warnings.push(failure);
      } else {
        errors.push(failure);
      }
    }
  });

  return { errors, items, warnings };
};

export const generateNews = async () => {
  const previousPayload = await readPreviousPayload();
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const { errors, items, warnings } = mergeSourceResults(settled, previousPayload);

  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const payload: NewsPayload = {
    generatedAt: new Date().toISOString(),
    sources: [...sources],
    errors,
    items: items.slice(0, 120),
  };

  await mkdir("public", { recursive: true });
  await writeFile("public/news.json", `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`Generated public/news.json with ${payload.items.length} items`);
  if (warnings.length) {
    console.warn("Some feeds used cache:", warnings.map((error) => `${error.sourceId}: ${error.message}`).join("; "));
  }
  if (errors.length) {
    console.warn("Some feeds failed:", errors.map((error) => `${error.sourceId}: ${error.message}`).join("; "));
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateNews();
}

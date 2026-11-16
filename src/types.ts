import type { sources } from "./sources.js";

export type NewsSourceId = (typeof sources)[number]["id"];

export type NewsCategoryId = "bulgaria" | "world" | "economy" | "incidents" | "sport" | "culture" | "science";

export interface NewsSource {
  id: NewsSourceId;
  name: string;
  shortName: string;
  color: string;
  feedUrl: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: string;
  sourceId: NewsSourceId;
  imageUrl?: string;
  /** Topic assigned during feed generation. */
  category?: NewsCategoryId;
  /** Shared by items from different outlets that cover the same event ("<sourceId>:<lead item id>"). */
  storyId?: string;
  /** 0-100; higher means more prominent on the front page. */
  importance?: number;
}

export interface NewsPayload {
  generatedAt: string;
  sources: NewsSource[];
  errors: Array<{ sourceId: NewsSourceId; message: string }>;
  items: NewsItem[];
}

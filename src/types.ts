import type { sources } from "./sources.js";

export type NewsSourceId = (typeof sources)[number]["id"];

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
}

export interface NewsPayload {
  generatedAt: string;
  sources: NewsSource[];
  errors: Array<{ sourceId: NewsSourceId; message: string }>;
  items: NewsItem[];
}

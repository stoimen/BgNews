export type NewsSourceId =
  | "mediapool"
  | "boulevard"
  | "bnt"
  | "nova"
  | "capital"
  | "darik"
  | "economic"
  | "sega";

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

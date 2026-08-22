import { describe, expect, it } from "vitest";
import { filterItems } from "../src/news";
import type { NewsItem } from "../src/types";

const items: NewsItem[] = [
  {
    id: "1",
    title: "Economy update",
    summary: "Market news",
    link: "https://example.com/1",
    pubDate: "2026-05-15T10:00:00.000Z",
    sourceId: "bta",
  },
  {
    id: "2",
    title: "Sports",
    summary: "Football result",
    link: "https://example.com/2",
    pubDate: "2026-05-15T11:00:00.000Z",
    sourceId: "nova",
  },
];

describe("filterItems", () => {
  it("filters by source", () => {
    expect(filterItems(items, "bta", "")).toEqual([items[0]]);
  });

  it("filters by query across title and summary", () => {
    expect(filterItems(items, "all", "football")).toEqual([items[1]]);
  });

  it("combines source and query filters", () => {
    expect(filterItems(items, "bta", "football")).toEqual([]);
  });
});

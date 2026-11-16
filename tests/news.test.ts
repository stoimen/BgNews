import { describe, expect, it } from "vitest";
import {
  buildStories,
  filterItems,
  layoutStories,
  outletCount,
  relatedCoverage,
  visibleStories,
  type NewsState,
} from "../src/news";
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

const story = (
  id: string,
  sourceId: NewsItem["sourceId"],
  storyId: string,
  extra: Partial<NewsItem> = {},
): NewsItem => ({
  id,
  title: `Title ${id}`,
  summary: `Summary ${id}`,
  link: `https://example.com/${id}`,
  pubDate: "2026-11-16T08:00:00.000Z",
  sourceId,
  imageUrl: `https://example.com/${id}.jpg`,
  category: "bulgaria",
  importance: 30,
  storyId,
  ...extra,
});

const baseState: NewsState = {
  payload: null,
  selectedSource: "all",
  selectedCategory: "all",
  query: "",
  isLoading: false,
  error: null,
};

describe("buildStories", () => {
  const grouped = [
    story("a", "bnt", "bnt:a", { importance: 80, category: "world" }),
    story("b", "nova", "bnt:a", { importance: 80, category: "world" }),
    story("c", "sega", "sega:c"),
  ];

  it("shows each multi-outlet story once, led by its lead item", () => {
    const stories = buildStories(grouped);
    expect(stories).toHaveLength(2);
    expect(stories[0].lead.id).toBe("a");
    expect(relatedCoverage(stories[0]).map((item) => item.sourceId)).toEqual(["nova"]);
    expect(outletCount(stories[0])).toBe(2);
  });

  it("lets the selected outlet lead the card", () => {
    const [first] = buildStories(grouped, "nova");
    expect(first.lead.id).toBe("b");
    expect(relatedCoverage(first).map((item) => item.sourceId)).toEqual(["bnt"]);
  });

  it("works with older payloads that have no story fields", () => {
    const legacy = items.map((item) => ({ ...item }));
    const stories = buildStories(legacy);
    expect(stories).toHaveLength(2);
    expect(stories[0].category).toBe("bulgaria");
    expect(stories[0].importance).toBe(0);
  });

  it("filters stories by source, category and query", () => {
    const payload = { generatedAt: "", sources: [], errors: [], items: grouped };
    expect(visibleStories({ ...baseState, payload, selectedSource: "nova" }).map((s) => s.lead.id)).toEqual(["b"]);
    expect(visibleStories({ ...baseState, payload, selectedCategory: "world" }).map((s) => s.id)).toEqual(["bnt:a"]);
    expect(visibleStories({ ...baseState, payload, query: "summary c" }).map((s) => s.id)).toEqual(["sega:c"]);
  });
});

describe("layoutStories", () => {
  const many = buildStories([
    story("top", "bnt", "bnt:top", { importance: 95, category: "world" }),
    story("noimg", "nova", "nova:noimg", { importance: 90, imageUrl: undefined }),
    ...Array.from({ length: 8 }, (_, index) =>
      story(`s${index}`, "bta", `bta:s${index}`, {
        importance: 50 - index,
        category: index % 2 ? "sport" : "economy",
        pubDate: `2026-11-16T0${index}:00:00.000Z`,
      }),
    ),
  ]);

  it("puts the most important story with an image in the hero slot", () => {
    const layout = layoutStories(many, "front");
    expect(layout.hero?.lead.id).toBe("top");
    expect(layout.featured.map((s) => s.lead.id)).toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("groups the remaining stories into category sections on the front page", () => {
    const layout = layoutStories(many, "front");
    const shown = [layout.hero, ...layout.featured, ...layout.sections.flatMap((section) => section.stories)];
    expect(new Set(shown.map((s) => s?.id)).size).toBe(many.length);
    expect(layout.sections.map((section) => section.category.id)).toEqual(["bulgaria", "economy", "sport"]);
    expect(layout.latest).toEqual([]);
  });

  it("lists the rest by time in filtered views and everything by time in search", () => {
    const filtered = layoutStories(many, "filtered");
    expect(filtered.sections).toEqual([]);
    expect(filtered.latest.map((s) => s.lead.id)).toEqual(["noimg", "s7", "s6", "s5", "s4"]);

    const search = layoutStories(many, "search");
    expect(search.hero).toBeUndefined();
    expect(search.latest).toHaveLength(many.length);
  });

  it("skips featured stories when there are only a few", () => {
    const layout = layoutStories(many.slice(0, 3), "filtered");
    expect(layout.hero).toBeDefined();
    expect(layout.featured).toEqual([]);
  });
});

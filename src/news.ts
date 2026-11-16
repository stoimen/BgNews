import { categories } from "./stories";
import type { NewsCategoryId, NewsItem, NewsPayload, NewsSourceId } from "./types";

export interface NewsState {
  payload: NewsPayload | null;
  selectedSource: NewsSourceId | "all";
  selectedCategory: NewsCategoryId | "all";
  query: string;
  isLoading: boolean;
  error: string | null;
}

export const state: NewsState = {
  payload: null,
  selectedSource: "all",
  selectedCategory: "all",
  query: "",
  isLoading: true,
  error: null,
};

export const loadNews = async (): Promise<void> => {
  state.isLoading = true;
  state.error = null;

  try {
    const response = await fetch("./news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.payload = (await response.json()) as NewsPayload;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "Unknown error";
  } finally {
    state.isLoading = false;
  }
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("bg-BG");

const matchesQuery = (item: NewsItem, query: string) =>
  query.length === 0 || `${item.title} ${item.summary}`.toLocaleLowerCase("bg-BG").includes(query);

export const filterItems = (
  items: NewsPayload["items"],
  selectedSource: NewsState["selectedSource"],
  rawQuery: string,
) => {
  const query = normalize(rawQuery);
  return items.filter(
    (item) => (selectedSource === "all" || item.sourceId === selectedSource) && matchesQuery(item, query),
  );
};

// ---------------------------------------------------------------------------
// Stories: items from several outlets about the same event, shown once
// ---------------------------------------------------------------------------

export interface Story {
  id: string;
  /** The item shown on the card. */
  lead: NewsItem;
  /** Every item in the story, lead included. */
  members: NewsItem[];
  category: NewsCategoryId;
  importance: number;
  /** Newest publication time among the members, in ms. */
  newest: number;
}

const itemKey = (item: NewsItem) => `${item.sourceId}:${item.id}`;
const timeOf = (item: NewsItem) => new Date(item.pubDate).getTime() || 0;

/** Groups items by storyId. With a preferred source, that outlet's item leads the card. */
export const buildStories = (items: NewsItem[], preferredSource?: NewsSourceId): Story[] => {
  const groups = new Map<string, NewsItem[]>();
  for (const item of items) {
    const id = item.storyId ?? itemKey(item);
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }

  return [...groups.entries()].map(([id, members]) => {
    const lead =
      (preferredSource && members.find((item) => item.sourceId === preferredSource)) ||
      members.find((item) => itemKey(item) === id) ||
      members.find((item) => item.imageUrl) ||
      members[0];

    return {
      id,
      lead,
      members,
      category: lead.category ?? "bulgaria",
      importance: Math.max(...members.map((item) => item.importance ?? 0)),
      newest: Math.max(...members.map(timeOf)),
    };
  });
};

/** Other outlets' coverage of the same story (one link per outlet). */
export const relatedCoverage = (story: Story) => {
  const seen = new Set<string>([story.lead.sourceId]);
  return story.members.filter((item) => {
    if (seen.has(item.sourceId)) return false;
    seen.add(item.sourceId);
    return true;
  });
};

export const outletCount = (story: Story) => new Set(story.members.map((item) => item.sourceId)).size;

export const visibleStories = (current: NewsState = state) => {
  const items = current.payload?.items ?? [];
  const source = current.selectedSource;
  const query = normalize(current.query);

  return buildStories(items, source === "all" ? undefined : source).filter(
    (story) =>
      (source === "all" || story.members.some((item) => item.sourceId === source)) &&
      (current.selectedCategory === "all" || story.category === current.selectedCategory) &&
      story.members.some((item) => matchesQuery(item, query)),
  );
};

// ---------------------------------------------------------------------------
// Page layout: which stories are big and which are small
// ---------------------------------------------------------------------------

export interface CategorySection {
  category: (typeof categories)[number];
  stories: Story[];
  total: number;
}

export interface PageLayout {
  hero?: Story;
  featured: Story[];
  sections: CategorySection[];
  latest: Story[];
}

const byImportance = (a: Story, b: Story) => b.importance - a.importance || b.newest - a.newest;
const byNewest = (a: Story, b: Story) => b.newest - a.newest;

/**
 * - "front": the default view — a hero story, featured stories, then a section per category.
 * - "filtered": a source or category is selected — hero and featured, then everything else by time.
 * - "search": plain results by time.
 */
export const layoutStories = (stories: Story[], mode: "front" | "filtered" | "search"): PageLayout => {
  if (mode === "search" || stories.length === 0) {
    return { featured: [], sections: [], latest: [...stories].sort(byNewest) };
  }

  const ranked = [...stories].sort(byImportance);
  const hero = ranked.find((story) => story.lead.imageUrl) ?? ranked[0];
  const featuredCount = stories.length >= 6 ? 4 : 0;
  const featured = ranked.filter((story) => story !== hero && story.lead.imageUrl).slice(0, featuredCount);
  const shown = new Set([hero, ...featured]);
  const remaining = stories.filter((story) => !shown.has(story));

  if (mode === "filtered") {
    return { hero, featured, sections: [], latest: remaining.sort(byNewest) };
  }

  const sections = categories
    .map((category) => {
      const inCategory = remaining.filter((story) => story.category === category.id).sort(byImportance);
      return { category, stories: inCategory.slice(0, 4), total: inCategory.length };
    })
    .filter((section) => section.stories.length > 0);

  return { hero, featured, sections, latest: [] };
};

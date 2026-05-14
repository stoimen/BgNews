import type { NewsPayload, NewsSourceId } from "./types";

export interface NewsState {
  payload: NewsPayload | null;
  selectedSource: NewsSourceId | "all";
  query: string;
  isLoading: boolean;
  error: string | null;
}

export const state: NewsState = {
  payload: null,
  selectedSource: "all",
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

export const filteredItems = () => {
  const items = state.payload?.items ?? [];
  const query = state.query.trim().toLocaleLowerCase("bg-BG");

  return items.filter((item) => {
    const matchesSource = state.selectedSource === "all" || item.sourceId === state.selectedSource;
    const haystack = `${item.title} ${item.summary}`.toLocaleLowerCase("bg-BG");
    const matchesQuery = query.length === 0 || haystack.includes(query);
    return matchesSource && matchesQuery;
  });
};

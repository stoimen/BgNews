import "./styles.css";
import { filteredItems, loadNews, state } from "./news";
import type { NewsItem, NewsSource } from "./types";
import { isSafeHttpUrl } from "./url";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const relativeTime = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(isoDate));
};

const sourceById = (sourceId: string) => state.payload?.sources.find((source) => source.id === sourceId);

const renderFeedErrors = () => {
  const errors = state.payload?.errors ?? [];
  if (errors.length === 0) return "";

  const sourceNames = errors.map((error) => sourceById(error.sourceId)?.shortName ?? error.sourceId).join(", ");
  return `<div class="feed-alert" role="status">
    Some sources could not refresh: ${escapeHtml(sourceNames)}. Cached stories are shown where available.
  </div>`;
};

const renderSourceButton = (source: NewsSource | null) => {
  const id = source?.id ?? "all";
  const isSelected = state.selectedSource === id;
  const label = source?.shortName ?? "All";
  const color = source?.color ?? "#334155";

  return `<button class="source-chip${isSelected ? " selected" : ""}" data-source="${id}" aria-pressed="${isSelected}" style="--source-color: ${color}">
    ${escapeHtml(label)}
  </button>`;
};

const renderCard = (item: NewsItem) => {
  const source = sourceById(item.sourceId);
  const sourceColor = source?.color ?? "#334155";
  const sourceLabel = source?.shortName ?? item.sourceId;
  const summary = item.summary ? `<p>${escapeHtml(item.summary)}</p>` : "";
  const image =
    item.imageUrl && isSafeHttpUrl(item.imageUrl)
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="image-placeholder" aria-hidden="true"></div>`;
  const content = `<div class="card-meta">
      <span class="source-badge" style="--source-color: ${sourceColor}">${escapeHtml(sourceLabel.toUpperCase())}</span>
      <time datetime="${escapeHtml(item.pubDate)}">${relativeTime(item.pubDate)}</time>
    </div>
    <div class="card-body">
      <div class="card-copy">
        <h2>${escapeHtml(item.title)}</h2>
        ${summary}
      </div>
      <div class="thumb">${image}</div>
    </div>`;

  return `<article class="news-card">
    ${isSafeHttpUrl(item.link) ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${content}</a>` : content}
  </article>`;
};

app.innerHTML = `<main>
  <header class="topbar">
    <div>
      <p class="eyebrow">World News</p>
    </div>
    <button class="refresh-button" id="refresh" type="button" aria-label="Refresh news">
      <span aria-hidden="true">↻</span>
    </button>
  </header>

  <section class="controls" aria-label="News controls">
    <div class="search-wrap">
      <span aria-hidden="true">⌕</span>
      <input id="search" type="search" placeholder="Search stories" />
    </div>
    <div class="source-row" id="sources" aria-label="Sources"></div>
    <div id="feed-errors"></div>
    <p class="updated" id="updated" hidden></p>
  </section>

  <section class="content" id="content" aria-live="polite"></section>
</main>`;

const searchInput = document.querySelector<HTMLInputElement>("#search");
const sourceRow = document.querySelector<HTMLDivElement>("#sources");
const feedErrors = document.querySelector<HTMLDivElement>("#feed-errors");
const updated = document.querySelector<HTMLParagraphElement>("#updated");
const content = document.querySelector<HTMLElement>("#content");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");

if (!searchInput || !sourceRow || !feedErrors || !updated || !content || !refreshButton) {
  throw new Error("App controls not found");
}

const renderControls = () => {
  const payload = state.payload;
  const generated = payload
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(payload.generatedAt))
    : "";

  sourceRow.innerHTML = `${renderSourceButton(null)}
    ${(payload?.sources ?? []).map(renderSourceButton).join("")}`;
  feedErrors.innerHTML = renderFeedErrors();
  updated.textContent = generated ? `Updated ${generated}` : "";
  updated.hidden = !generated;
};

const renderContent = (items: NewsItem[]) => {
  if (state.isLoading) {
    return `<div class="state-view"><div class="spinner"></div><p>Loading news...</p></div>`;
  }

  if (state.error || !state.payload) {
    return `<div class="state-view">
      <div class="state-icon">!</div>
      <h2>Could not load news</h2>
      <p>Check the generated feed file and try again.</p>
    </div>`;
  }

  if (items.length === 0) {
    return `<div class="state-view">
      <div class="state-icon">⌕</div>
      <h2>No results</h2>
      <p>Try a different search or source.</p>
    </div>`;
  }

  return `<div class="news-list">${items.map(renderCard).join("")}</div>`;
};

const renderNewsList = () => {
  content.innerHTML = renderContent(filteredItems());
};

const render = () => {
  renderControls();
  renderNewsList();
};

sourceRow.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-source]");
  if (!button) return;

  state.selectedSource = button.dataset.source as typeof state.selectedSource;
  render();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderNewsList();
});

refreshButton.addEventListener("click", async () => {
  await loadNews();
  render();
});

render();
void loadNews().then(render);

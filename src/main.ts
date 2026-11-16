import "./styles.css";
import {
  layoutStories,
  loadNews,
  outletCount,
  relatedCoverage,
  state,
  visibleStories,
  type PageLayout,
  type Story,
} from "./news";
import { categories } from "./stories";
import type { NewsCategoryId, NewsSource } from "./types";
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
const categoryById = (id: NewsCategoryId) => categories.find((category) => category.id === id) ?? categories[0];
const sourceName = (sourceId: string) => sourceById(sourceId)?.shortName ?? sourceId;

// ---------------------------------------------------------------------------
// Story building blocks
// ---------------------------------------------------------------------------

type CardSize = "hero" | "featured" | "medium" | "compact" | "standard";

const renderMedia = (story: Story, size: CardSize) => {
  const { lead } = story;
  const category = categoryById(story.category);
  const eager = size === "hero";
  const image =
    lead.imageUrl && isSafeHttpUrl(lead.imageUrl)
      ? `<img src="${escapeHtml(lead.imageUrl)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer" />`
      : "";

  return `<figure class="media${image ? "" : " no-image"}" style="--cat: ${category.color}" aria-hidden="true">
    ${image}
    <span class="media-fallback">${escapeHtml(sourceName(lead.sourceId))}</span>
  </figure>`;
};

const renderKicker = (story: Story) => {
  const category = categoryById(story.category);
  const outlets = outletCount(story);
  const trending = outlets >= 3 ? `<span class="trending">${outlets} outlets</span>` : "";

  return `<div class="kicker">
    <span class="category-label" style="--cat: ${category.color}">${escapeHtml(category.label)}</span>
    ${trending}
  </div>`;
};

const renderByline = (story: Story) => {
  const { lead } = story;
  const source = sourceById(lead.sourceId);
  return `<div class="byline">
    <span class="source-dot" style="--source-color: ${source?.color ?? "#64748b"}"></span>
    <span class="source-name">${escapeHtml(sourceName(lead.sourceId))}</span>
    <span aria-hidden="true">·</span>
    <time datetime="${escapeHtml(lead.pubDate)}">${relativeTime(lead.pubDate)}</time>
  </div>`;
};

const renderCoverage = (story: Story, limit: number) => {
  const related = relatedCoverage(story).filter((item) => isSafeHttpUrl(item.link));
  if (related.length === 0) return "";

  const links = related
    .slice(0, limit)
    .map(
      (item) =>
        `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" style="--source-color: ${sourceById(item.sourceId)?.color ?? "#64748b"}">${escapeHtml(sourceName(item.sourceId))}</a>`,
    )
    .join("");
  const more = related.length > limit ? `<span class="coverage-more">+${related.length - limit}</span>` : "";

  return `<div class="coverage"><span class="coverage-label">Also on</span>${links}${more}</div>`;
};

const renderTitle = (story: Story, tag: "h2" | "h3") => {
  const { lead } = story;
  const title = escapeHtml(lead.title);
  const link = isSafeHttpUrl(lead.link)
    ? `<a class="story-link" href="${escapeHtml(lead.link)}" target="_blank" rel="noreferrer">${title}</a>`
    : title;
  return `<${tag} class="story-title">${link}</${tag}>`;
};

const renderSummary = (story: Story) =>
  story.lead.summary ? `<p class="story-summary">${escapeHtml(story.lead.summary)}</p>` : "";

const renderStory = (story: Story, size: CardSize) => {
  const tag = size === "hero" ? "h2" : "h3";
  const showMedia = size !== "compact" || Boolean(story.lead.imageUrl);
  const showSummary = size === "hero" || size === "medium" || size === "standard";
  const coverageLimit = size === "hero" ? 5 : size === "compact" ? 0 : 3;
  const coverage = coverageLimit ? renderCoverage(story, coverageLimit) : "";
  const outlets = outletCount(story);
  const compactBadge = size === "compact" && outlets > 1 ? `<span class="outlet-badge">${outlets} outlets</span>` : "";

  return `<article class="story story-${size}">
    ${showMedia ? renderMedia(story, size) : ""}
    <div class="story-body">
      ${size === "compact" ? "" : renderKicker(story)}
      ${renderTitle(story, tag)}
      ${showSummary ? renderSummary(story) : ""}
      <div class="story-footer">${renderByline(story)}${compactBadge}</div>
      ${coverage}
    </div>
  </article>`;
};

// ---------------------------------------------------------------------------
// Page sections
// ---------------------------------------------------------------------------

const renderTop = (layout: PageLayout) => {
  if (!layout.hero) return "";
  const featured = layout.featured.length
    ? `<div class="featured" role="list">${layout.featured
        .map((story) => `<div role="listitem">${renderStory(story, "featured")}</div>`)
        .join("")}</div>`
    : "";

  return `<section class="top-stories${featured ? "" : " solo"}" aria-label="Top stories">
    ${renderStory(layout.hero, "hero")}
    ${featured}
  </section>`;
};

const renderSections = (layout: PageLayout) =>
  layout.sections.length === 0 ? "" : `<div class="sections">${renderSectionList(layout)}</div>`;

const renderSectionList = (layout: PageLayout) =>
  layout.sections
    .map(({ category, stories, total }) => {
      const [first, ...rest] = stories;
      const more =
        total > stories.length
          ? `<button class="see-all" type="button" data-category="${category.id}">See all ${total} <span aria-hidden="true">→</span></button>`
          : "";

      return `<section class="category-section" style="--cat: ${category.color}" aria-labelledby="section-${category.id}">
        <header class="section-header">
          <h2 id="section-${category.id}">${escapeHtml(category.label)}</h2>
          ${more}
        </header>
        <div class="section-grid${rest.length ? "" : " single"}">
          ${renderStory(first, "medium")}
          ${rest.length ? `<div class="compact-list">${rest.map((story) => renderStory(story, "compact")).join("")}</div>` : ""}
        </div>
      </section>`;
    })
    .join("");

const renderLatest = (layout: PageLayout, heading: string) => {
  if (layout.latest.length === 0) return "";
  return `<section class="latest" aria-label="${escapeHtml(heading)}">
    <header class="section-header plain"><h2>${escapeHtml(heading)}</h2></header>
    <div class="story-grid">${layout.latest.map((story) => renderStory(story, "standard")).join("")}</div>
  </section>`;
};

const stateView = (icon: string, title: string, text: string) => `<div class="state-view">
  <div class="state-icon">${icon}</div>
  <h2>${title}</h2>
  <p>${text}</p>
</div>`;

const renderContent = () => {
  if (state.isLoading && !state.payload) {
    return `<div class="state-view"><div class="spinner"></div><p>Loading news...</p></div>`;
  }

  if (state.error || !state.payload) {
    return stateView("!", "Could not load news", "Check the generated feed file and try again.");
  }

  const stories = visibleStories();
  if (stories.length === 0) {
    return stateView("⌕", "No results", "Try a different search, topic or source.");
  }

  const isSearch = state.query.trim().length > 0;
  const isFront = state.selectedCategory === "all" && state.selectedSource === "all";
  const layout = layoutStories(stories, isSearch ? "search" : isFront ? "front" : "filtered");

  const heading = isSearch ? `${stories.length} result${stories.length === 1 ? "" : "s"}` : "Latest";
  return `${renderTop(layout)}${renderSections(layout)}${renderLatest(layout, heading)}`;
};

// ---------------------------------------------------------------------------
// Shell and controls
// ---------------------------------------------------------------------------

const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

app.innerHTML = `<header class="masthead">
  <div class="masthead-inner">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">BG</span>
      <div>
        <p class="brand-name">Bulgarian News</p>
        <p class="brand-date">${escapeHtml(today)}</p>
      </div>
    </div>
    <div class="search-wrap">
      <span aria-hidden="true">⌕</span>
      <input id="search" type="search" placeholder="Search stories" aria-label="Search stories" />
    </div>
    <button class="refresh-button" id="refresh" type="button" aria-label="Refresh news">
      <span aria-hidden="true">↻</span>
    </button>
  </div>
  <nav class="topic-bar" id="topics" aria-label="Topics"></nav>
</header>

<main>
  <section class="controls" aria-label="Sources">
    <div class="source-row" id="sources"></div>
    <div id="feed-errors"></div>
  </section>

  <div class="content" id="content" aria-live="polite"></div>

  <footer class="app-footer">
    <p id="updated" hidden></p>
    <p>Bulgarian News © ${new Date().getFullYear()}</p>
  </footer>
</main>`;

const searchInput = document.querySelector<HTMLInputElement>("#search");
const topicBar = document.querySelector<HTMLElement>("#topics");
const sourceRow = document.querySelector<HTMLDivElement>("#sources");
const feedErrors = document.querySelector<HTMLDivElement>("#feed-errors");
const updated = document.querySelector<HTMLParagraphElement>("#updated");
const content = document.querySelector<HTMLElement>("#content");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");

if (!searchInput || !topicBar || !sourceRow || !feedErrors || !updated || !content || !refreshButton) {
  throw new Error("App controls not found");
}

const renderTopicButton = (id: NewsCategoryId | "all", label: string, color: string) => {
  const isSelected = state.selectedCategory === id;
  return `<button class="topic${isSelected ? " selected" : ""}" data-category="${id}" aria-pressed="${isSelected}" style="--cat: ${color}">${escapeHtml(label)}</button>`;
};

const renderSourceButton = (source: NewsSource | null) => {
  const id = source?.id ?? "all";
  const isSelected = state.selectedSource === id;
  const label = source?.shortName ?? "All sources";
  const color = source?.color ?? "#334155";

  return `<button class="source-chip${isSelected ? " selected" : ""}" data-source="${id}" aria-pressed="${isSelected}" style="--source-color: ${color}">
    ${source ? '<span class="source-dot"></span>' : ""}${escapeHtml(label)}
  </button>`;
};

const renderFeedErrors = () => {
  const errors = state.payload?.errors ?? [];
  if (errors.length === 0) return "";

  const sourceNames = errors.map((error) => sourceName(error.sourceId)).join(", ");
  return `<div class="feed-alert" role="status">
    Some sources could not refresh: ${escapeHtml(sourceNames)}. Cached stories are shown where available.
  </div>`;
};

const renderControls = () => {
  const payload = state.payload;
  topicBar.innerHTML = `<div class="topic-bar-inner">${renderTopicButton("all", "Top stories", "var(--ink)")}${categories
    .map((category) => renderTopicButton(category.id, category.label, category.color))
    .join("")}</div>`;
  sourceRow.innerHTML = `${renderSourceButton(null)}${(payload?.sources ?? []).map(renderSourceButton).join("")}`;
  feedErrors.innerHTML = renderFeedErrors();

  const generated = payload
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.generatedAt))
    : "";
  updated.textContent = generated ? `Updated ${generated}` : "";
  updated.hidden = !generated;
};

const renderNews = () => {
  content.innerHTML = renderContent();
};

const render = () => {
  renderControls();
  renderNews();
};

const selectCategory = (id: NewsCategoryId | "all") => {
  state.selectedCategory = id;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

topicBar.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-category]");
  if (button) selectCategory(button.dataset.category as NewsCategoryId | "all");
});

content.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-category]");
  if (button) selectCategory(button.dataset.category as NewsCategoryId);
});

sourceRow.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-source]");
  if (!button) return;

  state.selectedSource = button.dataset.source as typeof state.selectedSource;
  render();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderNews();
});

// Broken feed images fall back to a coloured tile with the outlet name.
content.addEventListener(
  "error",
  (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "IMG") target.closest(".media")?.classList.add("no-image");
  },
  true,
);

refreshButton.addEventListener("click", async () => {
  refreshButton.classList.add("spinning");
  await loadNews();
  refreshButton.classList.remove("spinning");
  render();
});

render();
void loadNews().then(render);

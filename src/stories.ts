import type { NewsCategoryId, NewsItem } from "./types.js";

/**
 * Story analysis shared by the feed generator and the web app:
 * - categorises every item (from its URL, RSS categories, or keywords)
 * - groups items from different outlets that report the same story
 * - scores each item's importance so the UI can make some stories larger
 *
 * Everything here is deterministic and dependency-free so it can run in
 * Node during feed generation and be unit tested.
 */

export const categories: ReadonlyArray<{ id: NewsCategoryId; label: string; color: string }> = [
  { id: "bulgaria", label: "Bulgaria", color: "#0f766e" },
  { id: "world", label: "World", color: "#2563eb" },
  { id: "economy", label: "Economy", color: "#b45309" },
  { id: "incidents", label: "Incidents", color: "#b91c1c" },
  { id: "sport", label: "Sport", color: "#15803d" },
  { id: "culture", label: "Culture & Life", color: "#a21caf" },
  { id: "science", label: "Tech & Health", color: "#4f46e5" },
];

const categoryIds = new Set<string>(categories.map((category) => category.id));

export const isCategoryId = (value: unknown): value is NewsCategoryId =>
  typeof value === "string" && categoryIds.has(value);

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const stopWords = new Set(
  (
    "и в във на за с със от по до се са да е не че ще който която които което това този тази тези той тя те то при след " +
    "как още му ги си към над под без между а но или най през преди вече има няма беше бил била били може както като " +
    "също само все ако кога когато защото обаче дори само два две три първи първа нов нова нови ново година години " +
    "г ден дни часа днес утре вчера сега там тук им ни ви го я ли бъде бъдат след срещу около заради според лв млн млрд " +
    "хил евро снимки видео обновена ексклузивно край много страната"
  ).split(" "),
);

// Definite articles (-ата, -ята, -ото, -ите, -ът, -ят) and common inflections. Any remaining
// differences are handled by prefix matching in the clustering step.
const endings = ["ията", "ите", "ата", "ята", "ото", "ия", "ии", "ът", "ят", "а", "я", "и", "о", "е", "у", "ю"];

/** Very light Bulgarian stemmer: strip a common inflection ending and cap the length. */
export const stem = (word: string) => {
  let base = word;
  for (const ending of endings) {
    if (base.length - ending.length >= 4 && base.endsWith(ending)) {
      base = base.slice(0, -ending.length);
      break;
    }
  }
  return base.slice(0, 7);
};

const wordsOf = (text: string) =>
  text
    .toLocaleLowerCase("bg-BG")
    .replace(/[„“”"'«»()[\]{}.,:;!?–—\-/\\|*+=<>…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export const tokens = (text: string) =>
  new Set(
    wordsOf(text)
      .filter((word) => word.length >= 3 || /^\d{2,}$/.test(word))
      .filter((word) => !stopWords.has(word))
      .map(stem),
  );

// ---------------------------------------------------------------------------
// Categorisation
// ---------------------------------------------------------------------------

/** URL path segments that outlets use for their sections. */
const urlSections: Array<[RegExp, NewsCategoryId]> = [
  [/\/(?:news|novini)\/(?:world|sviat|balkans)\//, "world"],
  [/\/category-(?:the-war|foreign-country|world|europe)\//, "world"],
  [/\/(?:news|novini)\/(?:economy|biznes|business)\//, "economy"],
  [/\/category-(?:economy|business|biznes)\//, "economy"],
  [/\/(?:news\/)?sport\/|\/category-sport\//, "sport"],
  [/\/(?:news|novini)\/(?:lik|culture|kultura|lifestyle)\//, "culture"],
  [/\/category-(?:culture|kultura|lifestyle)\//, "culture"],
  [/\/(?:news|novini)\/(?:science|tehnologii|zdrave|health)\//, "science"],
  [/\/(?:news|novini)\/(?:bulgaria|bylgariia|obshtestvo|regions)\/|\/regioni\//, "bulgaria"],
  [/\/category-(?:bulgaria|society)\//, "bulgaria"],
];

/** Keyword stems per category. Entries starting with "=" must match a whole word. */
const keywordLists: Record<NewsCategoryId, string[]> = {
  bulgaria: [
    "българ",
    "софия",
    "пловдив",
    "варна",
    "бургас",
    "русе",
    "правителств",
    "кабинет",
    "парламент",
    "депутат",
    "министър",
    "министерск",
    "радев",
    "йотова",
    "президент",
    "герб",
    "=дпс",
    "=бсп",
    "=пп",
    "общин",
    "кмет",
    "магистрал",
    "тракия",
  ],
  world: [
    "русия",
    "руск",
    "украйн",
    "киев",
    "зеленски",
    "путин",
    "=сащ",
    "американ",
    "тръмп",
    "вашингтон",
    "китай",
    "израел",
    "газа",
    "иран",
    "турция",
    "гърци",
    "сърби",
    "румъни",
    "германи",
    "франци",
    "британ",
    "лондон",
    "брюксел",
    "нато",
    "=оон",
    "естони",
    "унгари",
    "чехи",
    "полша",
    "хути",
    "йемен",
    "тайланд",
    "индия",
    "мексик",
    "конго",
    "калифорни",
    "=папа",
    "войн",
    "дрон",
    "военн",
    "армия",
    "фронт",
    "крим",
    "черно",
  ],
  economy: [
    "икономи",
    "инфлаци",
    "бюджет",
    "банк",
    "бизнес",
    "пазар",
    "компани",
    "инвест",
    "акци",
    "борс",
    "данъ",
    "данък",
    "заплат",
    "пенси",
    "енерг",
    "горив",
    "=бвп",
    "имот",
    "кредит",
    "рейтинг",
    "цени",
    "поскъп",
    "надценк",
    "търговск",
    "nvidia",
    "енвидиа",
  ],
  incidents: [
    "катастроф",
    "инцидент",
    "пожар",
    "загина",
    "загинал",
    "почина",
    "убит",
    "=уби",
    "убийств",
    "полиц",
    "арест",
    "задържа",
    "=мвр",
    "прокурат",
    "разследв",
    "пострада",
    "блъсна",
    "блъснат",
    "обир",
    "кражб",
    "наркотиц",
    "нападна",
    "издирв",
    "трагеди",
  ],
  sport: [
    "футбол",
    "тенис",
    "=мач",
    "=мача",
    "шампион",
    "лига",
    "отбор",
    "треньор",
    "селекцион",
    "=гол",
    "олимпи",
    "=цска",
    "левски",
    "лудогорец",
    "баскетбол",
    "волейбол",
    "маратон",
    "ранглист",
    "=wta",
    "=atp",
    "=уефа",
    "=фифа",
    "формула",
    "роналд",
    "григор",
  ],
  culture: [
    "филм",
    "музик",
    "певиц",
    "певец",
    "концерт",
    "театър",
    "изложб",
    "книг",
    "артист",
    "актьор",
    "актрис",
    "евровизи",
    "грами",
    "оскар",
    "фестивал",
    "сериал",
    "принц",
    "рожден",
    "известни",
    "подкаст",
  ],
  science: [
    "наук",
    "учен",
    "космос",
    "космическ",
    "=наса",
    "технолог",
    "интелект",
    "=ai",
    "смартфон",
    "метеор",
    "астроном",
    "лекар",
    "болниц",
    "медиц",
    "болест",
    "вирус",
    "ваксин",
    "грип",
    "covid",
    "епидеми",
    "пациент",
    "ебола",
  ],
};

/** How strongly a keyword hit counts towards a category (incidents/sport are very distinctive). */
const keywordWeights: Record<NewsCategoryId, number> = {
  bulgaria: 1,
  world: 1.3,
  economy: 1.3,
  incidents: 1.4,
  sport: 1.8,
  culture: 1.5,
  science: 1.5,
};

/** Map raw RSS <category> labels (in Bulgarian or English) to our categories. */
const rssCategoryMap: Array<[RegExp, NewsCategoryId]> = [
  [/свят|world|international|чужбина|европа|балкан/i, "world"],
  [/икономи|бизнес|business|economy|пазари|финанси|имоти/i, "economy"],
  [/спорт|sport|футбол/i, "sport"],
  [/култур|culture|шоу|lifestyle|звезди|любопитно|музика|кино/i, "culture"],
  [/наука|science|технолог|tech|здраве|health/i, "science"],
  [/криминал|инцидент|crime|произшеств/i, "incidents"],
  [/българи|bulgaria|политика|politics|общество|регион/i, "bulgaria"],
];

const keywordScores = (title: string, summary: string) => {
  const titleWords = wordsOf(title);
  const summaryWords = wordsOf(summary).slice(0, 60);
  const scores = new Map<NewsCategoryId, number>();

  for (const [category, keywords] of Object.entries(keywordLists) as Array<[NewsCategoryId, string[]]>) {
    let score = 0;
    for (const keyword of keywords) {
      const exact = keyword.startsWith("=");
      const needle = exact ? keyword.slice(1) : keyword;
      const matches = (word: string) => (exact ? word === needle : word.startsWith(needle));
      if (titleWords.some(matches)) score += 2;
      else if (summaryWords.some(matches)) score += 1;
    }
    if (score > 0) scores.set(category, score * keywordWeights[category]);
  }

  return scores;
};

export interface CategorizeInput {
  title: string;
  summary: string;
  link: string;
  sourceId: string;
  rssCategories?: string[];
}

export const categorize = ({ title, summary, link, sourceId, rssCategories = [] }: CategorizeInput): NewsCategoryId => {
  if (sourceId === "economic") return "economy";

  // 1. The outlet's own section, encoded in the article URL.
  let sectionCategory: NewsCategoryId | undefined;
  for (const [pattern, category] of urlSections) {
    if (pattern.test(link)) {
      sectionCategory = category;
      break;
    }
  }

  // 2. RSS <category> labels.
  if (!sectionCategory) {
    for (const label of rssCategories) {
      const match = rssCategoryMap.find(([pattern]) => pattern.test(label));
      if (match) {
        sectionCategory = match[1];
        break;
      }
    }
  }

  const scores = keywordScores(title, summary);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best] = ranked;

  // A generic "Bulgaria"/"society" section is refined by strong keyword evidence
  // (e.g. a road crash filed under Bulgaria belongs in Incidents).
  if (sectionCategory && sectionCategory !== "bulgaria") return sectionCategory;
  if (sectionCategory === "bulgaria") {
    const bulgariaScore = scores.get("bulgaria") ?? 0;
    return best && best[0] !== "world" && best[1] >= 2.8 && best[1] > bulgariaScore * 1.5 ? best[0] : "bulgaria";
  }

  // 3. Keywords only.
  return best && best[1] >= 2 ? best[0] : "bulgaria";
};

// ---------------------------------------------------------------------------
// Clustering: the same story reported by several outlets
// ---------------------------------------------------------------------------

const clusterWindowMs = 36 * 3_600_000;

/** Hourly video bulletins and similar roundups should never be headline stories. */
export const isRoundup = (title: string) =>
  /^(новините на nova|централни новини|обедни новини|късни новини|новините от|по света и у нас|обзор)/i.test(
    title.trim(),
  );

interface Signature {
  title: Set<string>;
  full: Set<string>;
  time: number;
}

const signatureOf = (item: NewsItem): Signature => {
  const title = tokens(item.title);
  const lead = tokens(item.summary.split(/\s+/).slice(0, 40).join(" "));
  return { title, full: new Set([...title, ...lead]), time: new Date(item.pubDate).getTime() };
};

/**
 * Words are weighted by rarity across the current feed (inverse document frequency):
 * sharing "Драгоман" or "Естония" says much more than sharing "Украйна" or "бюджет".
 */
const weightOf = (signatures: Array<Signature | null>) => {
  const documentFrequency = new Map<string, number>();
  for (const signature of signatures) {
    if (!signature) continue;
    for (const token of signature.full) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  // A floor on the corpus size keeps weights meaningful when only a few items are present
  // (e.g. several feeds failed at once); with a normal feed of 120+ items it has no effect.
  const total = Math.max(signatures.length, 100);
  return (token: string) => Math.log(total / (documentFrequency.get(token) ?? 1));
};

const similar = (a: Signature, b: Signature, weight: (token: string) => number) => {
  if (Math.abs(a.time - b.time) > clusterWindowMs) return false;
  if (a.title.size === 0 || b.title.size === 0) return false;

  const sum = (values: Iterable<string>) => {
    let total = 0;
    for (const value of values) total += weight(value);
    return total;
  };

  const sharedTitle = sharedTokens(a.title, b.title);
  const sharedTitleWeight = sum(sharedTitle);
  const titleSimilarity = sharedTitleWeight / Math.min(sum(a.title), sum(b.title));
  if (sharedTitle.length >= 2 && sharedTitleWeight >= 6 && titleSimilarity >= 0.4) return true;

  // Headlines are often worded very differently; fall back to title + lead paragraph,
  // but only when the headlines already share at least one distinctive word.
  if (sharedTitleWeight < 3.5) return false;
  const sharedFullWeight = sum(sharedTokens(a.full, b.full));
  const fullSimilarity = sharedFullWeight / Math.min(sum(a.full), sum(b.full));
  return sharedFullWeight >= 16 && fullSimilarity >= 0.3;
};

/** Stems match when equal or when one is a prefix of the other ("крим" ~ "кримск", "хути" ~ "хутит"). */
const stemsMatch = (x: string, y: string) =>
  x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));

const sharedTokens = (x: Set<string>, y: Set<string>) => {
  const others = [...y];
  return [...x].filter((value) => y.has(value) || others.some((other) => stemsMatch(value, other)));
};

/** Groups item indexes so that each group is one story covered by one or more outlets. */
export const clusterStories = (items: NewsItem[]) => {
  const signatures = items.map((item) => (isRoundup(item.title) ? null : signatureOf(item)));
  const weight = weightOf(signatures);
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };

  for (let i = 0; i < items.length; i += 1) {
    const a = signatures[i];
    if (!a) continue;
    for (let j = i + 1; j < items.length; j += 1) {
      const b = signatures[j];
      if (!b || items[i].sourceId === items[j].sourceId) continue;
      if (similar(a, b, weight)) parent[find(j)] = find(i);
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), index]);
  });

  return [...groups.values()];
};

// ---------------------------------------------------------------------------
// Importance
// ---------------------------------------------------------------------------

const categoryWeight: Record<NewsCategoryId, number> = {
  bulgaria: 8,
  world: 8,
  economy: 7,
  incidents: 5,
  science: 4,
  sport: 3,
  culture: 2,
};

/** Outlets whose feed images are large enough to fill a hero slot. */
const imageQuality: Record<string, number> = {
  darik: 5,
  bta: 5,
  bnt: 4,
  boulevard: 4,
  sega: 3,
  economic: 3,
  nova: 1,
};

const coverageScore = (outlets: number) => [0, 0, 32, 48, 58, 64][Math.min(outlets, 5)];

export interface ScoredItem extends NewsItem {
  category: NewsCategoryId;
  storyId: string;
  importance: number;
}

/**
 * Adds category, storyId and importance (0-100) to every item.
 * Items in the same story share a storyId (the id of the lead item) and a score.
 */
export const analyzeStories = (
  items: Array<NewsItem & { rssCategories?: string[] }>,
  now = Date.now(),
): ScoredItem[] => {
  const categorized = items.map(({ rssCategories, ...item }) => ({
    ...item,
    category: categorize({ ...item, rssCategories }),
  }));

  const result: ScoredItem[] = [];

  for (const group of clusterStories(categorized)) {
    const members = group.map((index) => categorized[index]);
    const outlets = new Set(members.map((item) => item.sourceId)).size;
    const newest = Math.max(...members.map((item) => new Date(item.pubDate).getTime()));
    const hoursOld = Math.max(0, (now - newest) / 3_600_000);

    // The story's category is the most common one among its members; on a tie,
    // a specific topic beats the generic "Bulgaria".
    const counts = new Map<NewsCategoryId, number>();
    for (const member of members) counts.set(member.category, (counts.get(member.category) ?? 0) + 1);
    const storyCategory = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || Number(a[0] === "bulgaria") - Number(b[0] === "bulgaria"),
    )[0][0];

    // Lead = best image + most detail, so the hero card looks good.
    const lead = [...members].sort(
      (a, b) =>
        (b.imageUrl ? (imageQuality[b.sourceId] ?? 2) : 0) - (a.imageUrl ? (imageQuality[a.sourceId] ?? 2) : 0) ||
        b.summary.length - a.summary.length,
    )[0];

    const roundup = members.every((member) => isRoundup(member.title));
    const raw =
      coverageScore(outlets) +
      24 * Math.exp(-hoursOld / 10) +
      categoryWeight[storyCategory] +
      (lead.imageUrl ? 4 : 0) +
      Math.min(4, lead.summary.length / 150);
    const importance = roundup ? 0 : Math.round(Math.min(100, raw));

    for (const index of group) {
      const member = categorized[index];
      result[index] = {
        ...member,
        category: outlets > 1 ? storyCategory : member.category,
        storyId: `${lead.sourceId}:${lead.id}`,
        importance,
      };
    }
  }

  return result;
};

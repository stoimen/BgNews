import { describe, expect, it } from "vitest";
import { analyzeStories, categorize, clusterStories, isRoundup, stem, tokens } from "../src/stories";
import type { NewsItem, NewsSourceId } from "../src/types";

const now = new Date("2026-11-16T09:00:00.000Z").getTime();

let counter = 0;
const item = (sourceId: NewsSourceId, title: string, overrides: Partial<NewsItem> = {}): NewsItem => {
  counter += 1;
  return {
    id: `id-${counter}`,
    title,
    summary: "",
    link: `https://example.com/${counter}`,
    pubDate: "2026-11-16T08:00:00.000Z",
    sourceId,
    imageUrl: `https://example.com/${counter}.jpg`,
    ...overrides,
  };
};

describe("stem / tokens", () => {
  it("normalises common Bulgarian inflections", () => {
    expect(stem("бюджета")).toBe(stem("бюджет"));
    expect(stem("радева")).toBe(stem("радев"));
  });

  it("drops stop words and punctuation", () => {
    expect([...tokens("Естония затваря границата си с Русия")]).toEqual(["естон", "затвар", "границ", "руси"]);
  });
});

describe("categorize", () => {
  it("uses the outlet's section from the URL", () => {
    expect(
      categorize({ title: "Нещо", summary: "", link: "https://www.bta.bg/bg/news/sport/1-x", sourceId: "bta" }),
    ).toBe("sport");
    expect(
      categorize({
        title: "Нещо",
        summary: "",
        link: "https://www.segabg.com/hot/category-the-war/x",
        sourceId: "sega",
      }),
    ).toBe("world");
    expect(
      categorize({ title: "Нещо", summary: "", link: "https://dariknews.bg/novini/sviat/x", sourceId: "darik" }),
    ).toBe("world");
  });

  it("treats every Economic.bg story as economy", () => {
    expect(categorize({ title: "Футбол", summary: "", link: "https://economic.bg/a", sourceId: "economic" })).toBe(
      "economy",
    );
  });

  it("falls back to keywords when the URL has no section", () => {
    const base = { summary: "", link: "https://bntnews.bg/news/x.html", sourceId: "bnt" };
    expect(categorize({ ...base, title: "Григор Димитров запазва позиции в ранглистата по тенис" })).toBe("sport");
    expect(categorize({ ...base, title: "Граничен полицай блъсна с кола момиче в Драгоман, то почина" })).toBe(
      "incidents",
    );
    expect(categorize({ ...base, title: "Естония затваря всички гранични пунктове с Русия" })).toBe("world");
    expect(categorize({ ...base, title: "Пет поколения събра баба Неделя" })).toBe("bulgaria");
  });

  it("refines a generic Bulgaria section with strong keyword evidence", () => {
    expect(
      categorize({
        title: "Локомотив блъсна мъж с колело преди жп гара Казанлък",
        summary: "",
        link: "https://dariknews.bg/regioni/stara-zagora/x",
        sourceId: "darik",
      }),
    ).toBe("incidents");
  });

  it("maps RSS category labels", () => {
    expect(
      categorize({ title: "Нещо", summary: "", link: "https://nova.bg/x", sourceId: "nova", rssCategories: ["Спорт"] }),
    ).toBe("sport");
  });
});

describe("clusterStories", () => {
  const filler = Array.from({ length: 30 }, (_, index) =>
    item("bta", `Новина номер ${index} за общината и правителството ${"абвгдежзийклмнопрстуфхцчшщ"[index % 26]}`),
  );

  const groupOf = (items: NewsItem[], target: NewsItem) => {
    const groups = clusterStories(items);
    const index = items.indexOf(target);
    return groups.find((group) => group.includes(index))!.map((i) => items[i]);
  };

  it("groups different outlets reporting the same event", () => {
    const a = item("boulevard", "Пиян граничен полицай блъсна и уби момиче на 18 г. в Драгоман");
    const b = item("nova", "Граничен полицай блъсна с кола момиче в Драгоман, то почина");
    const c = item("darik", "Трагедия в Драгоман: Ученичка загина, блъсната от граничен полицай");
    const items = [...filler, a, b, c];

    expect(groupOf(items, a)).toEqual([a, b, c]);
  });

  it("matches inflected word forms", () => {
    const a = item("bnt", "Войната с хутити в Йемен: Армията отстъпи от района на Баб ел-Мандеб");
    const b = item("nova", "Хутите напредват към Аден, проправителствените сили отстъпват край Баб ел-Мандеб");
    expect(groupOf([...filler, a, b], a)).toEqual([a, b]);
  });

  it("does not group stories that only share common words", () => {
    const a = item("darik", "Две катастрофи край Перник: Движението по АМ „Струма“ е ограничено");
    const b = item("bnt", "Ремонти ограничават движението в участък от АМ „Тракия“ край Пловдив");
    expect(groupOf([...filler, a, b], a)).toEqual([a]);
  });

  it("does not group items from the same outlet or far apart in time", () => {
    const a = item("bnt", "Естония затваря всички гранични пунктове с Русия");
    const b = item("bnt", "Естония затваря всичките си гранични пунктове с Русия от 1 декември");
    const c = item("sega", "Естония затваря всички гранични пунктове с Русия", { pubDate: "2026-11-10T08:00:00.000Z" });
    expect(groupOf([...filler, a, b, c], a)).toEqual([a]);
  });

  it("never groups hourly news bulletins", () => {
    expect(isRoundup("Новините на NOVA (16.11.2026 - 9.00)")).toBe(true);
    const a = item("nova", "Новините на NOVA (16.11.2026 - 9.00)");
    const b = item("bnt", "Новините на NOVA (16.11.2026 - 9.00)");
    expect(groupOf([...filler, a, b], a)).toEqual([a]);
  });
});

describe("analyzeStories", () => {
  it("ranks stories covered by several outlets above single-outlet stories", () => {
    const single = item("bta", "Младежкият общински съвет в Стара Загора организира коледна кампания");
    const a = item("boulevard", "Естония затваря всички гранични пунктове с Русия след саботаж");
    const b = item("sega", "Естония затваря границата си с Русия");
    const c = item("bnt", "Естония затваря всичките си гранични пунктове с Русия от 1 декември");

    const [scoredSingle, scoredA, scoredB, scoredC] = analyzeStories([single, a, b, c], now);

    expect(scoredA.storyId).toBe(scoredB.storyId);
    expect(scoredB.storyId).toBe(scoredC.storyId);
    expect(scoredA.importance).toBeGreaterThan(scoredSingle.importance);
    expect(scoredA.category).toBe("world");
  });

  it("picks the item with the best image as the story lead", () => {
    const nova = item("nova", "Единадесет души загинаха при пожар на остров Пукет в Тайланд");
    const bnt = item("bnt", "Най-малко 11 души загинаха при пожар на остров Пукет в Тайланд");
    const [scored] = analyzeStories([nova, bnt], now);
    expect(scored.storyId).toBe(`bnt:${bnt.id}`);
  });

  it("gives news bulletins zero importance", () => {
    const [scored] = analyzeStories([item("nova", "Новините на NOVA (16.11.2026 - 9.00)")], now);
    expect(scored.importance).toBe(0);
  });

  it("drops raw RSS categories from the output", () => {
    const [scored] = analyzeStories([{ ...item("nova", "Мач"), rssCategories: ["Спорт"] }], now);
    expect(scored).not.toHaveProperty("rssCategories");
    expect(scored.category).toBe("sport");
  });
});

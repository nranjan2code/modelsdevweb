import type { NewsItem } from "../pipeline/types";

/**
 * News arrives deduplicated by URL, which is not the same as deduplicated by
 * story: one DeepSeek launch showed up three times on the homepage via
 * techinasia, oodaloop and caixinglobal. Readers experience that as padding.
 *
 * Items are clustered by the model they are about plus meaningful title-word
 * overlap, and the best-scored item in each cluster represents it.
 */

/** Words that carry no topical signal when comparing headlines. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "to", "of", "in", "on",
  "at", "by", "from", "as", "is", "are", "was", "were", "be", "its", "it",
  "this", "that", "new", "now", "says", "said", "ai", "model", "models",
  "launches", "launch", "announces", "announced", "unveils", "releases",
]);

function topicWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** Share this fraction of topic words and it is the same story told twice. */
const SAME_STORY = 0.5;

/**
 * Domains that cover tickers rather than technology. Tavily surfaces them
 * because they mention model names, but "American Axle & Manufacturing Stock
 * Price Up 9.3%" is not model news and its presence makes the whole feed read
 * as scraped.
 */
const OFF_TOPIC_SOURCES = new Set([
  "marketbeat.com", "tradingview.com", "seekingalpha.com", "benzinga.com",
  "fool.com", "zacks.com", "investing.com", "barchart.com", "stocktwits.com",
  "cryptobriefing.com", "coindesk.com", "cointelegraph.com", "crypto.news",
  "defenseworld.net", "etfdailynews.com", "themarketsdaily.com",
  "tickerreport.com", "modernreaders.com",
]);

const host = (s: string) => s.replace(/^www\./, "").toLowerCase();

/** Drop items from sources that cover markets rather than models. */
export function onTopic(items: NewsItem[]): NewsItem[] {
  return items.filter((i) => !OFF_TOPIC_SOURCES.has(host(i.source ?? "")));
}

export interface Story {
  lead: NewsItem;
  /** Other outlets that covered the same thing, freshest first. */
  alsoCovered: NewsItem[];
}

function freshness(item: NewsItem): number {
  const t = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Collapse items into stories. The lead is the freshest item in a cluster,
 * breaking ties on the upstream relevance score, so a wire report that broke
 * first represents the story rather than whichever aggregator was scraped last.
 */
export function toStories(rawItems: NewsItem[]): Story[] {
  const items = onTopic(rawItems);
  const clusters: { key: string | null; words: Set<string>; items: NewsItem[] }[] = [];

  for (const item of items) {
    const words = topicWords(item.title);
    const modelKey = item.modelIds?.[0] ?? null;
    const hit = clusters.find(
      (c) =>
        (modelKey != null && c.key === modelKey && overlap(c.words, words) >= SAME_STORY * 0.6) ||
        overlap(c.words, words) >= SAME_STORY,
    );
    if (hit) {
      hit.items.push(item);
      for (const w of words) hit.words.add(w);
    } else {
      clusters.push({ key: modelKey, words, items: [item] });
    }
  }

  return clusters
    .map((c) => {
      const ranked = [...c.items].sort(
        (a, b) => freshness(b) - freshness(a) || (b.score ?? 0) - (a.score ?? 0),
      );
      return { lead: ranked[0], alsoCovered: ranked.slice(1) };
    })
    .sort((a, b) => freshness(b.lead) - freshness(a.lead));
}

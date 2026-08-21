import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.MODEL_PULSE_URL ?? process.env.LLM_PULSE_URL ?? "http://localhost:3000").replace(/\/$/, "");

interface ModelSummary {
  id: string;
  name: string;
  lab: string;
  providers: number;
  best_price: { input_per_m: number; output_per_m: number; cache_read_per_m: number | null; provider: string } | null;
  context: number | null;
  max_output: number | null;
  reasoning: boolean | null;
  tool_call: boolean | null;
  structured_output: boolean | null;
  vision: boolean | null;
  open_weights: boolean | null;
  release_date: string | null;
}

interface PriceRow {
  model: string;
  provider: string;
  listing: string;
  status: string | null;
  input_per_m: number | null;
  output_per_m: number | null;
  cache_read_per_m: number | null;
  cache_write_per_m: number | null;
  reasoning_per_m: number | null;
  context: number | null;
}

async function api<T>(p: string): Promise<T> {
  const res = await fetch(`${BASE}${p}`);
  if (!res.ok) throw new Error(`${p} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function text(payload: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

const server = new McpServer({
  name: "model-pulse",
  version: "0.1.0",
});

server.registerTool(
  "search_models",
  {
    title: "Search AI models",
    description:
      "Search the Model Pulse catalog of AI models. Filter by capability, context window, price, or free-text query. Returns canonical models with best listed prices.",
    inputSchema: {
      query: z.string().optional().describe("Free-text match on model name or id"),
      min_context: z.number().optional().describe("Minimum context window in tokens"),
      max_input_price: z.number().optional().describe("Maximum best-input USD per 1M tokens"),
      tools: z.boolean().optional().describe("Require tool calling"),
      reasoning: z.boolean().optional().describe("Require reasoning support"),
      vision: z.boolean().optional().describe("Require vision/image input"),
      open_weights: z.boolean().optional().describe("Require open weights"),
      limit: z.number().default(10).describe("Max results (1-50)"),
    },
  },
  async (args) => {
    const data = await api<{ models: ModelSummary[] }>("/api/models.json");
    const q = args.query?.trim().toLowerCase();
    const out = data.models
      .filter((m) => {
        if (q && !`${m.name} ${m.id}`.toLowerCase().includes(q)) return false;
        if (args.min_context != null && (m.context ?? 0) < args.min_context) return false;
        if (args.max_input_price != null && (m.best_price == null || m.best_price.input_per_m > args.max_input_price)) return false;
        if (args.tools === true && m.tool_call !== true) return false;
        if (args.reasoning === true && m.reasoning !== true) return false;
        if (args.vision === true && m.vision !== true) return false;
        if (args.open_weights === true && m.open_weights !== true) return false;
        return true;
      })
      .sort((a, b) => (a.best_price?.input_per_m ?? Infinity) - (b.best_price?.input_per_m ?? Infinity))
      .slice(0, Math.min(Math.max(args.limit, 1), 50));
    return text({ count: out.length, models: out });
  },
);

server.registerTool(
  "get_model_prices",
  {
    title: "Compare provider prices",
    description:
      "Get every provider serving a model with per-1M-token prices. Use to find the cheapest inference provider for a specific model. IDs are path-style, e.g. openai/gpt-4o.",
    inputSchema: {
      id: z.string().describe("Canonical model id, e.g. openai/gpt-4o"),
    },
  },
  async ({ id }) => {
    const data = await api<{ prices: PriceRow[] }>("/api/prices.json");
    const rows = data.prices.filter((r) => r.model === id);
    if (rows.length === 0) {
      return text({ error: `No listings found for ${id}. Use search_models to find valid ids.` });
    }
    const live = rows.filter((r) => r.status !== "deprecated" && r.input_per_m != null);
    live.sort((a, b) => a.input_per_m! - b.input_per_m!);
    return text({ model: id, cheapest: live[0] ?? null, listings: rows });
  },
);

server.registerTool(
  "get_changes",
  {
    title: "Recent model landscape changes",
    description:
      "Recent changes in the AI model landscape: new models, price moves, deprecations, context window and capability updates.",
    inputSchema: {
      type: z
        .enum(["all", "model_added", "provider_added", "repriced", "deprecated", "context_changed", "capability_changed"])
        .default("all"),
      lab: z.string().optional().describe("Filter by lab prefix, e.g. openai"),
      limit: z.number().default(20).describe("Max events (1-100)"),
    },
  },
  async (args) => {
    interface Ev {
      id: string;
      type: string;
      date: string;
      modelName: string;
      canonicalId: string | null;
      labId: string | null;
      providerId: string | null;
      changes: { field: string; old: unknown; new: unknown }[];
    }
    const data = await api<{ events: Ev[] }>("/api/events.json");
    const out = data.events
      .filter((e) => (args.type === "all" || e.type === args.type) && (!args.lab || e.labId === args.lab))
      .slice(0, Math.min(Math.max(args.limit, 1), 100));
    return text({ count: out.length, events: out });
  },
);

server.registerTool(
  "get_news",
  {
    title: "Recent AI model news",
    description:
      "Daily news headlines about the latest and most popular AI models, fetched from news sources. Filter by free-text query or model id. Items link to the original articles.",
    inputSchema: {
      query: z.string().optional().describe("Free-text match on headline, snippet, source or model id"),
      model_id: z.string().optional().describe("Only items tagged with this canonical model id, e.g. openai/gpt-4o"),
      limit: z.number().default(10).describe("Max items (1-24)"),
    },
  },
  async (args) => {
    interface NewsItem {
      id: string;
      title: string;
      url: string;
      source: string;
      publishedAt: string | null;
      snippet: string;
      modelIds: string[];
    }
    const data = await api<{ count: number; items: NewsItem[] }>("/api/news.json");
    const q = args.query?.trim().toLowerCase();
    const out = data.items
      .filter((n) => {
        if (args.model_id && !n.modelIds.includes(args.model_id)) return false;
        if (q && !`${n.title} ${n.snippet} ${n.source} ${n.modelIds.join(" ")}`.toLowerCase().includes(q))
          return false;
        return true;
      })
      .slice(0, Math.min(Math.max(args.limit, 1), 24));
    return text({ count: out.length, fetched: data.count ? "today" : "no data", items: out });
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`model-pulse MCP server ready (${BASE})`);
}

main().catch((err) => {
  console.error("model-pulse MCP server failed:", err);
  process.exit(1);
});

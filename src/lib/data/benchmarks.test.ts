import { describe, expect, it } from "vitest";
import { getBenchmarkBoards, slugify } from "./benchmarks";

describe("slugify", () => {
  it("slugs benchmark names", () => {
    expect(slugify("SWE-Bench Verified")).toBe("swe-bench-verified");
    expect(slugify("Humanity's Last Exam")).toBe("humanity-s-last-exam");
    expect(slugify("GPQA Diamond")).toBe("gpqa-diamond");
    expect(slugify("  Aider  Polyglot ")).toBe("aider-polyglot");
  });
});

describe("benchmark identity", () => {
  it("emits one route per board and one row per canonical model", async () => {
    const boards = await getBenchmarkBoards();
    expect(new Set(boards.map((board) => board.slug)).size).toBe(boards.length);
    for (const board of boards) {
      expect(new Set(board.entries.map((entry) => entry.groupId)).size).toBe(board.entries.length);
    }
  });
});

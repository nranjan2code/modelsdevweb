import { describe, expect, it } from "vitest";
import { slugify } from "./benchmarks";

describe("slugify", () => {
  it("slugs benchmark names", () => {
    expect(slugify("SWE-Bench Verified")).toBe("swe-bench-verified");
    expect(slugify("Humanity's Last Exam")).toBe("humanity-s-last-exam");
    expect(slugify("GPQA Diamond")).toBe("gpqa-diamond");
    expect(slugify("  Aider  Polyglot ")).toBe("aider-polyglot");
  });
});

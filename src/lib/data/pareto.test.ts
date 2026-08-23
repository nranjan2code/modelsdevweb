import { describe, expect, it } from "vitest";
import { paretoFrontier, paretoPrice, type ParetoPoint } from "./pareto";

const point = (id: string, input: number, output: number, context: number): ParetoPoint => ({ id, input, output, context });

describe("paretoPrice", () => {
  it("uses the selected input/output basis and the documented 75/25 blend", () => {
    const model = point("model", 1, 5, 128_000);
    expect(paretoPrice(model, "input")).toBe(1);
    expect(paretoPrice(model, "output")).toBe(5);
    expect(paretoPrice(model, "blended")).toBe(2);
  });
});

describe("paretoFrontier", () => {
  it("removes a model dominated on both price and context", () => {
    const models = [point("winner", 1, 1, 256_000), point("dominated", 2, 2, 128_000)];
    expect(paretoFrontier(models, "input").map((model) => model.id)).toEqual(["winner"]);
  });

  it("keeps tradeoffs and equal points on the frontier", () => {
    const models = [
      point("cheap", 1, 1, 128_000),
      point("large", 2, 2, 1_000_000),
      point("large-tie", 2, 2, 1_000_000),
    ];
    expect(paretoFrontier(models, "input").map((model) => model.id)).toEqual(["cheap", "large", "large-tie"]);
  });

  it("recomputes when output pricing changes the ordering", () => {
    const models = [point("input-pick", 1, 9, 256_000), point("output-pick", 2, 2, 256_000)];
    expect(paretoFrontier(models, "input").map((model) => model.id)).toEqual(["input-pick"]);
    expect(paretoFrontier(models, "output").map((model) => model.id)).toEqual(["output-pick"]);
  });

  it("evaluates only the supplied slice", () => {
    const full = [point("global", 1, 1, 1_000_000), point("slice-pick", 2, 2, 256_000)];
    expect(paretoFrontier(full, "blended").map((model) => model.id)).toEqual(["global"]);
    expect(paretoFrontier(full.slice(1), "blended").map((model) => model.id)).toEqual(["slice-pick"]);
  });
});

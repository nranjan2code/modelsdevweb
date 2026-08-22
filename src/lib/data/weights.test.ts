import { describe, expect, it } from "vitest";
import {
  classifyAccess,
  classifyLicence,
  fmtParams,
  isFreelyUsable,
  notableCaveats,
  parametersAgreeWithName,
  summarise,
  type WeightsFacts,
} from "./weights";

const fact = (over: Partial<WeightsFacts>): WeightsFacts => ({
  groupId: "g", repoId: "org/repo", licence: null, licenceClass: "unknown",
  access: "open", parameters: null, baseModel: null, languages: [],
  cardUrl: "https://huggingface.co/org/repo", fetchedAt: "2026-08-22T00:00:00Z",
  ...over,
});

describe("classifyLicence", () => {
  it("recognises standard open-source licences", () => {
    for (const l of ["apache-2.0", "mit", "bsd-3-clause", "MIT", " Apache-2.0 "]) {
      expect(classifyLicence(l), l).toBe("permissive");
    }
  });

  it("does not call a lab's community licence permissive", () => {
    // These allow commercial use but attach conditions — calling them
    // permissive would tell someone they may ship without reading the terms.
    for (const l of ["llama3.1", "llama4", "gemma", "qwen", "deepseek"]) {
      expect(classifyLicence(l), l).toBe("community");
    }
  });

  it("catches non-commercial licences, including unlisted -nc variants", () => {
    for (const l of ["cc-by-nc-4.0", "cc-by-nc-sa-4.0", "cc-by-nc-nd-3.0"]) {
      expect(classifyLicence(l), l).toBe("non-commercial");
    }
  });

  it("treats a missing or custom licence as unknown, never as permissive", () => {
    expect(classifyLicence(null)).toBe("unknown");
    expect(classifyLicence("")).toBe("unknown");
    expect(classifyLicence("other")).toBe("unknown");
    expect(classifyLicence("some-bespoke-lab-licence")).toBe("unknown");
  });
});

describe("classifyAccess", () => {
  it("reads Hugging Face's gated field in all its forms", () => {
    expect(classifyAccess(false)).toBe("open");
    expect(classifyAccess("auto")).toBe("gated");
    expect(classifyAccess("manual")).toBe("gated");
    expect(classifyAccess(true)).toBe("gated");
    expect(classifyAccess(undefined)).toBe("unknown");
  });
});

describe("isFreelyUsable", () => {
  it("requires both a permissive licence and open access", () => {
    expect(isFreelyUsable(fact({ licenceClass: "permissive", access: "open" }))).toBe(true);
    expect(isFreelyUsable(fact({ licenceClass: "permissive", access: "gated" }))).toBe(false);
    expect(isFreelyUsable(fact({ licenceClass: "community", access: "open" }))).toBe(false);
    expect(isFreelyUsable(fact({ licenceClass: "unknown", access: "open" }))).toBe(false);
  });
});

describe("notableCaveats", () => {
  it("omits the models that need no explanation", () => {
    const rows = notableCaveats([
      fact({ groupId: "clean", licenceClass: "permissive", access: "open" }),
      fact({ groupId: "nc", licenceClass: "non-commercial" }),
    ]);
    expect(rows.map((r) => r.groupId)).toEqual(["nc"]);
  });

  it("puts the costliest surprise first", () => {
    const rows = notableCaveats([
      fact({ groupId: "gated-only", access: "gated", licenceClass: "permissive" }),
      fact({ groupId: "community", licenceClass: "community" }),
      fact({ groupId: "noncommercial", licenceClass: "non-commercial" }),
    ]);
    expect(rows[0].groupId).toBe("noncommercial");
  });
});

describe("summarise", () => {
  it("counts each axis independently", () => {
    const s = summarise([
      fact({ licenceClass: "permissive", access: "open" }),
      fact({ licenceClass: "permissive", access: "gated" }),
      fact({ licenceClass: "non-commercial", access: "open" }),
      fact({ licenceClass: "unknown", access: "open" }),
    ]);
    expect(s).toMatchObject({ total: 4, freelyUsable: 1, nonCommercial: 1, gated: 1, unclear: 1 });
  });
});

describe("fmtParams", () => {
  it("scales to the unit people actually say", () => {
    expect(fmtParams(8_030_261_248)).toBe("8B");
    expect(fmtParams(685_000_000_000)).toBe("685B");
    expect(fmtParams(2_780_000_000_000)).toBe("2.78T");
    expect(fmtParams(null)).toBeNull();
    expect(fmtParams(0)).toBeNull();
  });
});

describe("parametersAgreeWithName", () => {
  it("catches a resolve onto the wrong-size repo", () => {
    // "Apertus 70B" resolving to an 11B repo means we matched a derivative.
    expect(parametersAgreeWithName("Apertus 70B", 11_306_824_800)).toBe(false);
  });

  it("accepts a size that matches the name", () => {
    expect(parametersAgreeWithName("Qwen3 32B", 32_000_000_000)).toBe(true);
    expect(parametersAgreeWithName("Llama 3.1 8B Instruct", 8_030_261_248)).toBe(true);
  });

  it("accepts either half of a mixture-of-experts name", () => {
    expect(parametersAgreeWithName("Qwen3 235B-A22B", 235_000_000_000)).toBe(true);
    expect(parametersAgreeWithName("Qwen3 235B-A22B", 22_000_000_000)).toBe(true);
  });

  it("declines to judge when the name states no size", () => {
    expect(parametersAgreeWithName("Command A", 111_000_000_000)).toBeNull();
    expect(parametersAgreeWithName("Qwen3 32B", null)).toBeNull();
  });
});

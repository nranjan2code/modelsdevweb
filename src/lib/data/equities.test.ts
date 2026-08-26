import { describe, expect, it } from "vitest";
import { exchangeSession, EQUITY_ENTITIES, EXCHANGES, listingCount, primaryListing } from "./equities";

describe("global equity coverage", () => {
  it("counts companies once even when they have multiple listings", () => {
    expect(listingCount()).toBe(12);
    expect(EQUITY_ENTITIES.find((entity) => entity.id === "tsmc")?.listings).toHaveLength(2);
    expect(EXCHANGES.twse.sessions[0].close).toBe("13:30");
  });

  it("uses the exchange's local clock and recognizes split sessions", () => {
    const lunch = exchangeSession("hkex", new Date("2026-08-26T04:30:00.000Z"));
    expect(lunch?.state).toBe("lunch");
    expect(lunch?.localTime).toBe("12:30");
  });

  it("does not call a Sunday quote open", () => {
    const weekend = exchangeSession("nasdaq", new Date("2026-08-30T15:00:00.000Z"));
    expect(weekend?.state).toBe("weekend");
  });

  it("honors source-supplied exchange closures", () => {
    const holiday = exchangeSession("nse", new Date("2026-08-26T06:00:00.000Z"), ["2026-08-26"]);
    expect(holiday?.state).toBe("post-close");
  });

  it("uses the primary local share when a company also has an ADR", () => {
    expect(primaryListing(EQUITY_ENTITIES.find((entity) => entity.id === "tsmc")!)).toMatchObject({ ticker: "2330", exchangeId: "twse" });
  });
});

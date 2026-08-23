/**
 * Retirement is a property of a *listing*, not of a model.
 *
 * Upstream marks `status: "deprecated"` per provider endpoint, so one model is
 * routinely live at some venues and withdrawn at others — 71 tracked groups are
 * in exactly that state today. Two distinct facts follow, and collapsing them
 * loses real information:
 *
 *   - **Withdrawn here.** Anthropic still serves Claude Opus 4.1 while five of
 *     the gateways reselling it have dropped their endpoints. The model is alive;
 *     a buyer pinned to one of those gateways still has to move.
 *   - **Retired everywhere.** No live listing anywhere. The model is gone, and
 *     counting it as something a lab currently offers overstates the catalog.
 *
 * Aggregates must use the second; migration warnings must use the first. Before
 * this module the lab pages did neither: they printed `listings.length`, which
 * counts endpoint variants *and* includes withdrawn ones, so the flagship Claude
 * Opus 4.1 row advertised 22 providers against 16 that would actually sell it.
 */

import { liveListings, providerCount, type Lab, type ModelGroup } from "./index";
import type { Listing } from "../pipeline/types";

export interface Retirement {
  /** Providers still serving the model. */
  liveProviders: number;
  /** Distinct providers that have withdrawn an endpoint for it. */
  retiredProviders: string[];
  /** Deprecated listings — may exceed `retiredProviders` (endpoint variants). */
  deprecatedListings: Listing[];
  /**
   * No live listing at any provider. The model is gone, and no "models offered"
   * count may include it.
   */
  retiredEverywhere: boolean;
  /** Live somewhere, withdrawn somewhere else — the migration case. */
  partiallyRetired: boolean;
}

export function retirementOf(g: ModelGroup): Retirement {
  const deprecatedListings = g.listings.filter((l) => l.status === "deprecated");
  const live = liveListings(g);
  const liveProviderIds = new Set(live.map((l) => l.providerId));
  // A provider counts as having retired the model only if it has no live
  // endpoint left — dropping one variant while serving another is not a sunset.
  const retiredProviders = [
    ...new Set(
      deprecatedListings
        .map((l) => l.providerId)
        .filter((p) => !liveProviderIds.has(p)),
    ),
  ].sort();

  return {
    liveProviders: liveProviderIds.size,
    retiredProviders,
    deprecatedListings,
    retiredEverywhere: g.listings.length > 0 && live.length === 0,
    partiallyRetired: live.length > 0 && retiredProviders.length > 0,
  };
}

/** Models a lab (or anyone) still actually offers. */
export function activeGroups(groups: ModelGroup[]): ModelGroup[] {
  return groups.filter((g) => liveListings(g).length > 0);
}

/** Models with no live listing anywhere. */
export function retiredGroups(groups: ModelGroup[]): ModelGroup[] {
  return groups.filter((g) => g.listings.length > 0 && liveListings(g).length === 0);
}

export interface LabRetirement {
  active: number;
  retired: number;
  /** Models live somewhere but withdrawn at one or more venues. */
  partial: number;
}

export function labRetirement(groups: ModelGroup[]): LabRetirement {
  let active = 0;
  let retired = 0;
  let partial = 0;
  for (const g of groups) {
    const r = retirementOf(g);
    if (r.retiredEverywhere) retired++;
    else {
      active++;
      if (r.partiallyRetired) partial++;
    }
  }
  return { active, retired, partial };
}

/**
 * Lab counts that exclude models nobody serves any more. `Lab.modelCount` is
 * built from group membership alone, so a lab whose models have all been
 * withdrawn still reports them as tracked.
 */
export function labsWithActivity(labs: Lab[], tracked: ModelGroup[]): (Lab & LabRetirement)[] {
  const byLab = new Map<string, ModelGroup[]>();
  for (const g of tracked) {
    const arr = byLab.get(g.labId);
    if (arr) arr.push(g);
    else byLab.set(g.labId, [g]);
  }
  return labs.map((lab) => ({ ...lab, ...labRetirement(byLab.get(lab.id) ?? []) }));
}

/**
 * The provider-side view: what this venue still sells versus what it has
 * dropped. A price-sorted table that mixes the two lets a withdrawn endpoint
 * head the list as the venue's cheapest offer.
 */
export interface ProviderRetirement {
  live: Listing[];
  retired: Listing[];
  /**
   * Models this provider dropped that are still available elsewhere — the rows
   * worth a migration note rather than a tombstone.
   */
  droppedButAvailable: number;
}

export function providerRetirement(
  listings: Listing[],
  groupOf: (l: Listing) => ModelGroup | undefined,
): ProviderRetirement {
  const live: Listing[] = [];
  const retired: Listing[] = [];
  let droppedButAvailable = 0;
  for (const l of listings) {
    if (l.status === "deprecated") {
      retired.push(l);
      const g = groupOf(l);
      if (g && liveListings(g).length > 0) droppedButAvailable++;
    } else {
      live.push(l);
    }
  }
  return { live, retired, droppedButAvailable };
}

/** Live provider count for display — never `listings.length`. */
export function liveProviderCount(g: ModelGroup): number {
  return providerCount(g);
}

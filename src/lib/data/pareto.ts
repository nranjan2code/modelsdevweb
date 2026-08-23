export type ParetoBasis = "blended" | "input" | "output";

export interface ParetoPoint {
  id: string;
  input: number;
  output: number;
  context: number;
}

export function paretoPrice(point: ParetoPoint, basis: ParetoBasis): number {
  if (basis === "input") return point.input;
  if (basis === "output") return point.output;
  return (point.input * 3 + point.output) / 4;
}

/** Minimise price while maximising context. Equal points remain tied on the frontier. */
export function paretoFrontier<T extends ParetoPoint>(points: T[], basis: ParetoBasis): T[] {
  return points
    .filter((point) => !points.some((other) => {
      if (other.id === point.id) return false;
      const otherPrice = paretoPrice(other, basis);
      const pointPrice = paretoPrice(point, basis);
      return otherPrice <= pointPrice && other.context >= point.context &&
        (otherPrice < pointPrice || other.context > point.context);
    }))
    .sort((a, b) => paretoPrice(a, basis) - paretoPrice(b, basis));
}

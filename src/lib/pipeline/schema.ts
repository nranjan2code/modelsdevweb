import { z } from "zod";

export const rawEntry = z.record(z.string(), z.unknown());

export const rawProvider = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  doc: z.string().nullable().optional(),
  npm: z.string().nullable().optional(),
  api: z.string().nullable().optional(),
  env: z.array(z.string()).optional(),
  models: z.record(z.string(), rawEntry).optional(),
});

export const rawApi = z.record(z.string(), rawProvider);

export const rawModels = z.record(z.string(), rawEntry);

export type RawApi = z.infer<typeof rawApi>;
export type RawModels = z.infer<typeof rawModels>;

import { z } from "zod";

export const originInferenceSchema = z.object({
    origin: z.string(),
    subRegion: z.string().nullable(),
    cuisineStyle: z.string().nullable(),
    reason: z.string(),
}).strict();

export type OriginInferenceOutput = z.infer<typeof originInferenceSchema>;

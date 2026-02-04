import { Queue } from "bullmq";

import { QUEUE_NAMES, originInferenceJobOptions } from "../config";

import { getBullClient } from "@/server/redis/bullmq";
import type { OriginInferenceJobData } from "@/types";

let originInferenceQueue: Queue<OriginInferenceJobData> | null = null;

export function createOriginInferenceQueue(): Queue<OriginInferenceJobData> {
    if (originInferenceQueue) return originInferenceQueue;

    originInferenceQueue = new Queue<OriginInferenceJobData>(QUEUE_NAMES.ORIGIN_INFERENCE, {
        connection: getBullClient(),
        defaultJobOptions: originInferenceJobOptions,
    });

    return originInferenceQueue;
}

import type { Queue } from "bullmq";

import { QUEUE_NAMES, originInferenceJobOptions } from "../config";

// import { getQueues } from "@/server/queue/registry";
import { createLogger } from "@/server/logger";
import { isAIEnabled } from "@/config/server-config-loader";
import type { OriginInferenceJobData, AddOriginInferenceJobResult } from "@/types";

const log = createLogger("queue:origin-inference:producer");

/**
 * Add an origin inference job to the queue.
 *
 * Checks if AI is enabled before queueing.
 */
export async function addOriginInferenceJob(
    queue: Queue<OriginInferenceJobData>,
    data: OriginInferenceJobData
): Promise<AddOriginInferenceJobResult> {
    const aiEnabled = await isAIEnabled();

    if (!aiEnabled) {
        log.info({ recipeId: data.recipeId }, "AI disabled, skipping origin inference job");

        return { status: "skipped", reason: "disabled" };
    }

    // Use underscore instead of colon to avoid BullMQ validation error "Custom Id cannot contain :"
    const jobId = `origin-inference_${data.recipeId}`;

    const existingJob = await queue.getJob(jobId);

    if (existingJob) {
        const state = await existingJob.getState();

        // If job is already processing or waiting, don't add duplicate
        if (state === "active" || state === "waiting" || state === "delayed" || state === "prioritized") {
            log.info({ recipeId: data.recipeId, jobId, state }, "Origin inference job already exists");
            return { status: "duplicate", existingJobId: existingJob.id || jobId };
        }

        // If job is completed or failed, remove it so we can re-run
        // This allows manual re-triggering via the UI
        await existingJob.remove();
        log.info({ recipeId: data.recipeId, jobId, state }, "Removed existing origin inference job to re-run");
    }

    const job = await queue.add(QUEUE_NAMES.ORIGIN_INFERENCE, data, {
        ...originInferenceJobOptions,
        jobId,
    });

    log.info({ recipeId: data.recipeId, jobId: job.id }, "Origin inference job added to queue");

    return { status: "queued", job };
}

/*
 * Convenience wrapper to add origin inference job using the registry.
 * REMOVED to prevent circular dependency with registry.ts
 */
// export async function queueOriginInference(
//     data: OriginInferenceJobData
// ): Promise<AddOriginInferenceJobResult> {
//     const queues = getQueues();
// 
//     return addOriginInferenceJob(queues.originInference, data);
// }

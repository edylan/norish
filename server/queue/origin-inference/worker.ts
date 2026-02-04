import type { Job } from "bullmq";

import { QUEUE_NAMES, baseWorkerOptions, WORKER_CONCURRENCY, STALLED_INTERVAL } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";
import { getRecipeFull, db } from "@/server/db";
import { recipes } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { inferOriginForRecipe } from "@/server/ai/origin-inferrer";
import { getOriginInferenceMode, getRecipePermissionPolicy } from "@/config/server-config-loader";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";
import { emitByPolicy } from "@/server/trpc/helpers";
import type { OriginInferenceJobData } from "@/types";

const log = createLogger("worker:origin-inference");

/**
 * Process a single origin inference job.
 */
export async function processOriginInferenceJob(job: Job<OriginInferenceJobData>): Promise<void> {
    const { recipeId } = job.data;
    log.info({ jobId: job.id, recipeId }, "Processing origin inference job");

    // Notify user that origin inference is starting
    const policy = await getRecipePermissionPolicy();
    const { userId, householdKey } = job.data;

    emitByPolicy(
        recipeEmitter,
        policy.view,
        { userId, householdKey },
        "processingToast",
        {
            recipeId,
            titleKey: "processingOrigin",
            severity: "default",
        }
    );

    const mode = await getOriginInferenceMode();
    if (mode === "disabled") {
        log.info({ recipeId }, "Origin inference is disabled, skipping");
        return;
    }

    // Fetch recipe data for analysis
    const recipe = await getRecipeFull(recipeId);
    if (!recipe) {
        log.error({ recipeId }, "Recipe not found for origin inference");
        return;
    }

    // Prep data for AI
    const analysisData = {
        title: recipe.name,
        description: recipe.description,
        ingredients: recipe.recipeIngredients.map((ri) =>
            `${ri.amount || ""} ${ri.unit || ""} ${ri.ingredientName}`.trim()
        ),
    };

    // Call AI
    const result = await inferOriginForRecipe(analysisData);

    if (!result.success) {
        log.error({ recipeId, error: result.error, code: result.code }, "Failed to infer origin with AI");

        // Distinguish between transient and permanent errors
        // Permanent errors should NOT throw, so the job completes (and doesn't retry)
        const PERMANENT_ERRORS = ["AI_DISABLED", "INVALID_INPUT", "EMPTY_RESPONSE", "MODEL_NOT_FOUND"];

        if (result.code && PERMANENT_ERRORS.includes(result.code)) {
            log.warn({ recipeId, code: result.code }, "Permanent failure in origin inference - not retrying");
            return;
        }

        // For other errors (transient), throw to trigger BullMQ retry
        throw new Error(result.error);
    }

    const { origin, subRegion, cuisineStyle, reason } = result.data;

    // Update recipe in database
    await db
        .update(recipes)
        .set({
            origin,
            originSubRegion: subRegion,
            cuisineStyle,
            originReason: reason,
            updatedAt: new Date()
        })
        .where(eq(recipes.id, recipeId));

    // Notify user

    emitByPolicy(
        recipeEmitter,
        policy.view,
        { userId, householdKey },
        "originInferenceCompleted",
        { recipeId }
    );

    emitByPolicy(
        recipeEmitter,
        policy.view,
        { userId, householdKey },
        "processingToast",
        {
            recipeId,
            titleKey: "originComplete",
            severity: "success",
        }
    );

    log.info({ recipeId, origin }, "Origin inference completed and saved");
}

/**
 * Handle job failure.
 */
async function handleJobFailed(job: Job<OriginInferenceJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;
    log.error({ jobId: job.id, recipeId: job.data.recipeId, error: error.message }, "Origin inference job failed");
}

/**
 * Start the origin inference worker.
 */
export async function startOriginInferenceWorker(): Promise<void> {
    await createLazyWorker<OriginInferenceJobData>(
        QUEUE_NAMES.ORIGIN_INFERENCE,
        processOriginInferenceJob,
        {
            connection: getBullClient(),
            ...baseWorkerOptions,
            stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.ORIGIN_INFERENCE],
            concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.ORIGIN_INFERENCE],
        },
        handleJobFailed
    );
}

export async function stopOriginInferenceWorker(): Promise<void> {
    await stopLazyWorker(QUEUE_NAMES.ORIGIN_INFERENCE);
}

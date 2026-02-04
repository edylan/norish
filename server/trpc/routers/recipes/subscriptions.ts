import { router } from "../../trpc";
import { createPolicyAwareSubscription } from "../../helpers";

import { recipeEmitter } from "./emitter";

const onCreated = createPolicyAwareSubscription(recipeEmitter, "created", "recipe created");
const onImportStarted = createPolicyAwareSubscription(
  recipeEmitter,
  "importStarted",
  "recipe import started"
);
const onImported = createPolicyAwareSubscription(recipeEmitter, "imported", "recipe imported");
const onUpdated = createPolicyAwareSubscription(recipeEmitter, "updated", "recipe updated");
const onDeleted = createPolicyAwareSubscription(recipeEmitter, "deleted", "recipe deleted");
const onConverted = createPolicyAwareSubscription(recipeEmitter, "converted", "recipe converted");
const onFailed = createPolicyAwareSubscription(recipeEmitter, "failed", "recipe failed");
const onNutritionStarted = createPolicyAwareSubscription(
  recipeEmitter,
  "nutritionStarted",
  "nutrition estimation started"
);
const onAutoTaggingStarted = createPolicyAwareSubscription(
  recipeEmitter,
  "autoTaggingStarted",
  "auto-tagging started"
);
const onAutoTaggingCompleted = createPolicyAwareSubscription(
  recipeEmitter,
  "autoTaggingCompleted",
  "auto-tagging completed"
);
const onAllergyDetectionStarted = createPolicyAwareSubscription(
  recipeEmitter,
  "allergyDetectionStarted",
  "allergy detection started"
);
const onAllergyDetectionCompleted = createPolicyAwareSubscription(
  recipeEmitter,
  "allergyDetectionCompleted",
  "allergy detection completed"
);
const onOriginInferenceStarted = createPolicyAwareSubscription(
  recipeEmitter,
  "originInferenceStarted",
  "origin inference started"
);
const onOriginInferenceCompleted = createPolicyAwareSubscription(
  recipeEmitter,
  "originInferenceCompleted",
  "origin inference completed"
);
const onProcessingToast = createPolicyAwareSubscription(
  recipeEmitter,
  "processingToast",
  "processing toast"
);
const onRecipeBatchCreated = createPolicyAwareSubscription(
  recipeEmitter,
  "recipeBatchCreated",
  "recipe batch created"
);

export const recipesSubscriptions = router({
  onCreated,
  onImportStarted,
  onImported,
  onUpdated,
  onDeleted,
  onConverted,
  onFailed,
  onNutritionStarted,
  onAutoTaggingStarted,
  onAutoTaggingCompleted,
  onAllergyDetectionStarted,
  onAllergyDetectionCompleted,
  onOriginInferenceStarted,
  onOriginInferenceCompleted,
  onProcessingToast,
  onRecipeBatchCreated,
});

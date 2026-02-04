
import { db } from "@/server/db";
import { recipes, recipeIngredients, ingredients } from "@/server/db/schema";
import { eq, count } from "drizzle-orm";
import { inferOriginForRecipe } from "@/server/ai/origin-inferrer";
import { isAIEnabled, getOriginInferenceMode } from "@/config/server-config-loader";
import { createLogger } from "@/server/logger";

const log = createLogger("script:infer-all-origins");

async function main() {
    console.log("Starting batch origin inference...");

    // 1. Check if AI and Origin Inference are enabled
    const aiEnabled = await isAIEnabled();
    const inferenceMode = await getOriginInferenceMode();

    if (!aiEnabled) {
        console.error("❌ AI features are disabled. Please enable them in the Admin Settings before running this script.");
        process.exit(1);
    }

    if (inferenceMode === "disabled") {
        console.error("❌ Origin Inference is disabled. Please enable it in the Admin Settings (AI -> Origin Inference) before running this script.");
        process.exit(1);
    }

    console.log("✅ AI and Origin Inference are enabled.");

    // 2. Ensure Schema is ready by trying to select the new columns
    try {
        await db.select({
            origin: recipes.origin,
            originSubRegion: recipes.originSubRegion,
            cuisineStyle: recipes.cuisineStyle,
            originReason: recipes.originReason
        }).from(recipes).limit(1);
        console.log("✅ Database schema appears to be up to date.");
    } catch (error) {
        console.error("❌ Database schema validation failed. It seems the new columns (origin, originSubRegion, cuisineStyle, originReason) are missing.");
        console.error("Please run migration scripts before proceeding.");
        console.error("Error details:", error);
        process.exit(1);
    }

    // 3. Fetch all recipes (basic info only first to avoid relation issues)
    const allRecipes = await db.select({
        id: recipes.id,
        name: recipes.name,
        description: recipes.description,
    }).from(recipes);

    console.log(`Found ${allRecipes.length} recipes to process.`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (const recipe of allRecipes) {
        // Fetch ingredients for this recipe manually to be robust against schema relation errors
        const riRows = await db.select({
            amount: recipeIngredients.amount,
            unit: recipeIngredients.unit,
            name: ingredients.name
        })
            .from(recipeIngredients)
            .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
            .where(eq(recipeIngredients.recipeId, recipe.id));

        const ingredientsList = riRows.map(ri =>
            `${ri.amount || ""} ${ri.unit || ""} ${ri.name || ""}`.trim()
        ).filter(Boolean);

        if (ingredientsList.length === 0) {
            console.log(`⚠️ Skipping recipe "${recipe.name}" (ID: ${recipe.id}): No ingredients found.`);
            skipCount++;
            continue;
        }

        console.log(`\nInsert processing for: "${recipe.name}"...`);

        try {
            const result = await inferOriginForRecipe({
                title: recipe.name,
                description: recipe.description,
                ingredients: ingredientsList
            });

            if (result.success) {
                const { origin, subRegion, cuisineStyle, reason } = result.data;

                await db.update(recipes).set({
                    origin,
                    originSubRegion: subRegion,
                    cuisineStyle,
                    originReason: reason,
                    updatedAt: new Date()
                }).where(eq(recipes.id, recipe.id));

                console.log(`   ✅ Inferred: ${origin} (${subRegion})`);
                console.log(`   📝 Reason: ${reason}`);
                successCount++;
            } else {
                console.error(`   ❌ Failed: ${result.error} (Code: ${result.code})`);
                failCount++;
            }

        } catch (err) {
            console.error(`   ❌ Exception: ${err}`);
            failCount++;
        }
    }

    console.log("\n===========================================");
    console.log("Batch Processing Complete");
    console.log("===========================================");
    console.log(`Total Recipes: ${allRecipes.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped: ${skipCount}`);

    process.exit(0);
}

main().catch(err => {
    console.error("Unhandled script error:", err);
    process.exit(1);
});

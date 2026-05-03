import { and, eq, isNull } from "drizzle-orm";
import { db, rawDb } from "./client";
import { applyMigrations } from "./apply-migrations";
import { categories, users } from "./schema";
import { categoryTemplate, type CategoryTemplate } from "../domain/category-template";
import { createId } from "../lib/ids";
import { hashPassword } from "../lib/password";
import { nowIso } from "../lib/time";

type SeedUserInput = {
  login: string;
  displayName: string;
  password: string;
};

applyMigrations(rawDb);

function readSeedUsers(): SeedUserInput[] {
  const firstLogin = process.env.SEED_USER_1_LOGIN;
  const firstDisplayName = process.env.SEED_USER_1_DISPLAY_NAME;
  const firstPassword = process.env.SEED_USER_1_PASSWORD;
  const secondLogin = process.env.SEED_USER_2_LOGIN;
  const secondDisplayName = process.env.SEED_USER_2_DISPLAY_NAME;
  const secondPassword = process.env.SEED_USER_2_PASSWORD;

  if (
    !firstLogin ||
    !firstDisplayName ||
    !firstPassword ||
    !secondLogin ||
    !secondDisplayName ||
    !secondPassword
  ) {
    throw new Error(
      "Missing seed env vars. Set SEED_USER_1_LOGIN, SEED_USER_1_DISPLAY_NAME, SEED_USER_1_PASSWORD, SEED_USER_2_LOGIN, SEED_USER_2_DISPLAY_NAME and SEED_USER_2_PASSWORD.",
    );
  }

  return [
    { login: firstLogin, displayName: firstDisplayName, password: firstPassword },
    { login: secondLogin, displayName: secondDisplayName, password: secondPassword },
  ];
}

async function upsertUser(input: SeedUserInput) {
  const existing = db.select().from(users).where(eq(users.login, input.login)).get();

  if (existing) {
    return existing;
  }

  const now = nowIso();
  const user = {
    id: createId("usr"),
    login: input.login,
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
    baseCurrency: "PLN",
    createdAt: now,
    updatedAt: now,
  };

  db.insert(users).values(user).run();
  return user;
}

function seedCategoryTree(userId: string, items: CategoryTemplate[], parentId: string | null) {
  items.forEach((item, index) => {
    const existing = db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
          eq(categories.name, item.name),
          eq(categories.type, item.type),
        ),
      )
      .get();

    const categoryId = existing?.id ?? createId("cat");
    const now = nowIso();

    if (!existing) {
      db.insert(categories)
        .values({
          id: categoryId,
          userId,
          parentId,
          name: item.name,
          type: item.type,
          sortOrder: index,
          isSystem: true,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    if (item.children?.length) {
      seedCategoryTree(userId, item.children, categoryId);
    }
  });
}

for (const seedUser of readSeedUsers()) {
  const user = await upsertUser(seedUser);
  seedCategoryTree(user.id, categoryTemplate, null);
}

console.log("Seed completed.");

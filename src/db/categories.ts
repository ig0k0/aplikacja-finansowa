import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { categories, type Category } from "./schema";

export function listCategoriesForUser(userId: string): Category[] {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

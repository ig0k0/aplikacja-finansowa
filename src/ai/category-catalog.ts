import type { Category } from "@/db/schema";

export function categoriesForPromptByType(categories: Category[], transactionType: string) {
  const byId = new Map(categories.map((category) => [category.id, category]));

  function pathFor(id: string) {
    const parts: string[] = [];
    let current = byId.get(id);

    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    return parts.join(" > ");
  }

  return categories
    .filter((category) => category.type === transactionType && !category.isArchived)
    .map((category) => ({ id: category.id, path: pathFor(category.id) }));
}

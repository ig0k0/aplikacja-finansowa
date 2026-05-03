export type CategoryTemplate = {
  name: string;
  type: "income" | "expense" | "investment";
  children?: CategoryTemplate[];
};

export const categoryTemplate: CategoryTemplate[] = [
  {
    name: "Przychody",
    type: "income",
    children: [
      { name: "Wynagrodzenie", type: "income" },
      { name: "Zarobek z platform sprzedazowych", type: "income" },
      { name: "Obligacje", type: "income" },
      { name: "Akcje", type: "income" },
      { name: "Prezent", type: "income" },
    ],
  },
  {
    name: "Wydatki",
    type: "expense",
    children: [
      { name: "Jedzenie w domu", type: "expense" },
      { name: "Jedzenie w pracy", type: "expense" },
    ],
  },
  {
    name: "Transport",
    type: "expense",
    children: [
      { name: "Karta miejska/bilety", type: "expense" },
      { name: "Taxi", type: "expense" },
      { name: "Hulajnoga", type: "expense" },
    ],
  },
  {
    name: "Elektronika",
    type: "expense",
    children: [
      { name: "Sprzet elektroniczny", type: "expense" },
      { name: "Oprogramowanie", type: "expense" },
      { name: "Subskrypcje", type: "expense" },
    ],
  },
  {
    name: "Zdrowie i higiena",
    type: "expense",
    children: [
      { name: "Leki", type: "expense" },
      { name: "Fryzjer", type: "expense" },
      { name: "Kosmetyki", type: "expense" },
      { name: "Lekarze", type: "expense" },
      { name: "Inne", type: "expense" },
    ],
  },
  {
    name: "Ubrania",
    type: "expense",
    children: [
      { name: "Ubrania zwykle", type: "expense" },
      { name: "Ubrania sportowe", type: "expense" },
      { name: "Buty", type: "expense" },
      { name: "Dodatki", type: "expense" },
    ],
  },
  {
    name: "Nauka",
    type: "expense",
    children: [
      { name: "Studia czesne", type: "expense" },
      { name: "Kursy informatyka", type: "expense" },
      { name: "Kursy inne", type: "expense" },
    ],
  },
  {
    name: "Rozrywka",
    type: "expense",
    children: [
      { name: "Sport i silownia", type: "expense" },
      { name: "Kino", type: "expense" },
      { name: "Koncerty", type: "expense" },
      { name: "Ksiazki", type: "expense" },
      { name: "Wyjscia ze znajomymi", type: "expense" },
    ],
  },
  {
    name: "Inwestycje",
    type: "investment",
    children: [
      { name: "ETF", type: "investment" },
      { name: "Akcje", type: "investment" },
      { name: "Obligacje", type: "investment" },
      { name: "Krypto", type: "investment" },
      { name: "IKE/IKZE", type: "investment" },
      { name: "Gotowka", type: "investment" },
    ],
  },
];

export function countCategoryTemplateItems(items = categoryTemplate): number {
  return items.reduce(
    (count, item) => count + 1 + countCategoryTemplateItems(item.children ?? []),
    0,
  );
}

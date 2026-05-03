export function formatCurrencyMinor(amountMinor: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amountMinor / 100);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL").format(new Date(`${date}T00:00:00`));
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

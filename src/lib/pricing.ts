export function calculatePricePerLiter(priceSek: number, volumeCl: number): number {
  if (volumeCl <= 0) {
    return 0;
  }

  return priceSek / (volumeCl / 100);
}

export function formatSek(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPricePerLiter(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} kr/liter`;
}

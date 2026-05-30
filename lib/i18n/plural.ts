// Russian plural selection — picks one / few / many for a count.
// e.g. pluralRu(1, окно) → "окно", pluralRu(3, …) → "окна", pluralRu(5, …) → "окон".
export function pluralRu(
  n: number,
  forms: { one: string; few: string; many: string },
): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few;
  return forms.many;
}

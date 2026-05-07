export const normalizeSearchText = (value: string): string =>
  value.toLowerCase().replace(/[_\-\s]+/g, "");

export const fuzzyMatch = (text: string, query: string): boolean => {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (normalizedText.includes(normalizedQuery)) return true;

  let index = 0;
  for (let i = 0; i < normalizedText.length && index < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[index]) index += 1;
  }
  return index === normalizedQuery.length;
};

export const fuzzyMatchAny = (texts: Array<string | null | undefined>, query: string): boolean =>
  texts.some((text) => typeof text === "string" && fuzzyMatch(text, query));


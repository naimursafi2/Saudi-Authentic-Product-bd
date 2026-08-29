import type { Product } from "@/types/product";

export function getSearchableText(product: Product) {
  return [
    product.name,
    product.tagline,
    product.description,
    product.origin,
    product.categories.map((category) => category.name).join(" "),
    product.highlights.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function rankProductMatches(products: Product[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return products.slice(0, 5);

  return products
    .map((product) => {
      const searchableText = getSearchableText(product);
      const name = product.name.toLowerCase();
      const tagline = product.tagline.toLowerCase();
      const origin = product.origin.toLowerCase();
      const categoryNames = product.categories.map((category) =>
        category.name.toLowerCase(),
      );
      const tokens = [
        product.name,
        ...product.categories.map((category) => category.name),
        ...product.highlights,
        product.tagline,
      ]
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

      let score = 0;
      const isSingleLetter = normalizedQuery.length === 1;

      if (name === normalizedQuery) score += 500;
      if (name.startsWith(normalizedQuery)) score += isSingleLetter ? 220 : 260;
      if (name.includes(normalizedQuery)) score += isSingleLetter ? 140 : 170;

      if (tagline === normalizedQuery) score += 180;
      if (tagline.startsWith(normalizedQuery))
        score += isSingleLetter ? 80 : 120;
      if (tagline.includes(normalizedQuery)) score += isSingleLetter ? 30 : 60;

      if (origin === normalizedQuery) score += 100;
      if (origin.includes(normalizedQuery)) score += isSingleLetter ? 15 : 30;
      if (searchableText.includes(normalizedQuery))
        score += isSingleLetter ? 20 : 35;

      for (const categoryName of categoryNames) {
        if (categoryName === normalizedQuery) score += 300;
        else if (categoryName.startsWith(normalizedQuery))
          score += isSingleLetter ? 200 : 220;
        else if (categoryName.includes(normalizedQuery))
          score += isSingleLetter ? 65 : 90;
      }

      for (const token of tokens) {
        if (token === normalizedQuery) score += 250;
        else if (token.startsWith(normalizedQuery))
          score += isSingleLetter ? 100 : 140;
        else if (token.includes(normalizedQuery))
          score += isSingleLetter ? 10 : 30;
      }

      const queryIndex = name.indexOf(normalizedQuery);
      if (queryIndex >= 0) score += Math.max(0, 30 - queryIndex);

      return { product, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product)
    .slice(0, 8);
}

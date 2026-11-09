function normalizeWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\p{P}]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function wordErrorRate(expectedText, actualText) {
  const expected = normalizeWords(expectedText);
  const actual = normalizeWords(actualText);

  if (expected.length === 0) return null;

  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);

  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    const current = [expectedIndex];

    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      const substitutionCost =
        expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1;

      current[actualIndex] = Math.min(
        current[actualIndex - 1] + 1,
        previous[actualIndex] + 1,
        previous[actualIndex - 1] + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[actual.length] / expected.length;
}

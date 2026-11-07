/**
 * Normalizes user text input for comparison (lowercase, trim, collapse spaces, unify apostrophes).
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['`‘’ʻʼ]/g, "'")
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes the Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = normalizeText(a);
  const s2 = normalizeText(b);

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = Array.from({ length: s1.length + 1 }, () =>
    new Array<number>(s2.length + 1).fill(0)
  );

  for (let i = 0; i <= s1.length; i++) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[s1.length]![s2.length]!;
}

export interface AnswerCheckResult {
  isCorrect: boolean;
  isExact: boolean;
  distance: number;
  matchedVariant: string;
}

/**
 * Checks whether user's typed answer matches expected translation(s) with typo tolerance.
 * Supports slash-separated synonyms like "maosh / oylik".
 */
export function checkTypedAnswer(
  userInput: string,
  expectedAnswer: string
): AnswerCheckResult {
  const cleanUser = normalizeText(userInput);
  if (!cleanUser) {
    return {
      isCorrect: false,
      isExact: false,
      distance: expectedAnswer.length,
      matchedVariant: expectedAnswer,
    };
  }

  // Split variants separated by "/" or "," and strip parenthetical hints
  const rawVariants = expectedAnswer
    .replace(/\([^)]*\)/g, "")
    .split(/[\/,]/)
    .map((v) => v.trim())
    .filter(Boolean);

  const variants =
    rawVariants.length > 0 ? rawVariants : [expectedAnswer.trim()];

  let bestDistance = Infinity;
  let bestVariant = variants[0]!;

  for (const variant of variants) {
    const cleanVariant = normalizeText(variant);
    const dist = levenshteinDistance(cleanUser, cleanVariant);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestVariant = variant;
    }
  }

  const targetLen = normalizeText(bestVariant).length;
  const maxAllowedDistance =
    targetLen <= 4 ? 0 : targetLen <= 7 ? 1 : 2;

  return {
    isCorrect: bestDistance <= maxAllowedDistance,
    isExact: bestDistance === 0,
    distance: bestDistance,
    matchedVariant: bestVariant,
  };
}

/**
 * Shuffles an array using Fisher-Yates algorithm.
 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

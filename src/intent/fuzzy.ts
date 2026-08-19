/**
 * Fuzzy string matching for EKG-AI's semantic parser.
 *
 * Used to tolerate minor spelling/typo variance when resolving raw tokens
 * against known vocabulary (lexemes, senses, capability names) without
 * silently guessing across unrelated words.
 */

/**
 * Levenshtein edit distance between two strings, operating on Unicode
 * codepoints (not UTF-16 code units) so multi-byte characters count as a
 * single character each.
 *
 * Uses a single rolling row buffer (Uint16Array) instead of a full 2D
 * matrix for O(min(a,b)) space.
 */
export function levenshtein(a: string, b: string): number {
  const ac = [...a];
  const bc = [...b];

  // Ensure `bc` is the shorter sequence so the row buffer is as small as possible.
  const [shorter, longer] = bc.length <= ac.length ? [bc, ac] : [ac, bc];

  const n = shorter.length;
  if (longer.length === 0) return n;

  const row = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= longer.length; i++) {
    let prevDiag = row[0];
    row[0] = i;
    const longerChar = longer[i - 1];
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      if (longerChar === shorter[j - 1]) {
        row[j] = prevDiag;
      } else {
        row[j] = Math.min(
          prevDiag + 1, // substitution
          row[j - 1] + 1, // insertion
          row[j] + 1, // deletion
        );
      }
      prevDiag = temp;
    }
  }

  return row[n];
}

/**
 * Find the closest candidate to `token` by Levenshtein distance.
 *
 * Rejects matches whose distance is disproportionate to the token's length
 * (distance / max(token.length, 1) > 0.4) so short words don't fuzz into
 * other unrelated short words. Returns undefined if nothing qualifies
 * within `maxDistance` and the proportional threshold.
 */
export function bestFuzzyMatch(
  token: string,
  candidates: Iterable<string>,
  maxDistance = 2,
): { candidate: string; distance: number } | undefined {
  const tokenLength = [...token].length;
  const proportionalLimit = Math.max(tokenLength, 1);

  let best: { candidate: string; distance: number } | undefined;

  for (const candidate of candidates) {
    const distance = levenshtein(token, candidate);
    if (distance > maxDistance) continue;
    if (distance / proportionalLimit > 0.3) continue;
    if (!best || distance < best.distance || (distance === best.distance && candidate.length > best.candidate.length)) {
      best = { candidate, distance };
    }
  }

  return best;
}

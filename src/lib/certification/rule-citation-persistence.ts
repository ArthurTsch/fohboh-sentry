export function uniqueRuleCitationsByRuleId<T extends { ruleId: string }>(
  citations: readonly T[],
  previouslyPersisted: ReadonlySet<string> = new Set(),
) {
  const seen = new Set(previouslyPersisted);

  return citations.filter((citation) => {
    if (seen.has(citation.ruleId)) {
      return false;
    }
    seen.add(citation.ruleId);
    return true;
  });
}

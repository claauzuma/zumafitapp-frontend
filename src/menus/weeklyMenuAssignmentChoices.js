function assignmentIdentity(assignment = {}) {
  const snapshot = assignment?.menuSnapshot || assignment?.snapshot || assignment || {};
  return String(
    assignment?.menuId || snapshot.baseId || snapshot.id || snapshot.name || ""
  ).trim().toLowerCase();
}

export function isSameMenuAssignment(left, right) {
  const leftId = assignmentIdentity(left);
  const rightId = assignmentIdentity(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

export function primaryMenuAssignment(assignment) {
  if (!assignment) return null;
  return assignment.primaryMenu || assignment;
}

export function assignmentWithPrimary(primaryMenu, alternatives = [], maxAlternatives = 10) {
  if (!primaryMenu) return null;
  const seen = new Set([assignmentIdentity(primaryMenu)]);
  const cleanAlternatives = (Array.isArray(alternatives) ? alternatives : [])
    .filter((alternative) => alternative?.menuSnapshot?.name || alternative?.menuId)
    .filter((alternative) => {
      const identity = assignmentIdentity(alternative);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .slice(0, maxAlternatives);
  return {
    ...primaryMenu,
    primaryMenu,
    alternatives: cleanAlternatives,
  };
}

export function addMenuAlternative(current, alternative, maxAlternatives = 10) {
  const primary = primaryMenuAssignment(current);
  if (!primary) return assignmentWithPrimary(alternative, [], maxAlternatives);
  return assignmentWithPrimary(
    primary,
    [...(Array.isArray(current?.alternatives) ? current.alternatives : []), alternative],
    maxAlternatives
  );
}

export function replacePrimaryMenu(current, nextPrimary, maxAlternatives = 10) {
  const previousPrimary = primaryMenuAssignment(current);
  const alternatives = Array.isArray(current?.alternatives) ? current.alternatives : [];
  return assignmentWithPrimary(
    nextPrimary,
    previousPrimary && !isSameMenuAssignment(previousPrimary, nextPrimary)
      ? [previousPrimary, ...alternatives]
      : alternatives,
    maxAlternatives
  );
}

export function promoteMenuAlternative(current, alternativeIndex, maxAlternatives = 10) {
  const previousPrimary = primaryMenuAssignment(current);
  const alternatives = Array.isArray(current?.alternatives) ? current.alternatives : [];
  const nextPrimary = alternatives[alternativeIndex];
  if (!nextPrimary) return current;
  const remaining = alternatives.filter((_, index) => index !== alternativeIndex);
  return assignmentWithPrimary(
    nextPrimary,
    previousPrimary ? [previousPrimary, ...remaining] : remaining,
    maxAlternatives
  );
}

export function compactEquivalentActivity(items = []) {
  const grouped = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const pending = item?.event === "client_equivalent_pending_approval";
    const key = pending
      ? `pending:${item?.id || index}`
      : [item?.event, item?.metadata?.date, item?.metadata?.mealName].map((value) => String(value || "")).join("|");
    const previous = grouped.get(key);
    grouped.set(key, previous ? { ...previous, occurrences: previous.occurrences + 1 } : { ...item, occurrences: 1 });
  });
  return [...grouped.values()];
}

export function equivalentActivitySummary(items = []) {
  const source = Array.isArray(items) ? items : [];
  return {
    pending: source.filter((item) => item?.event === "client_equivalent_pending_approval").length,
    attention: source.filter((item) => item?.event === "client_equivalent_needs_attention").length,
    consumed: source.filter((item) => item?.event === "client_equivalent_consumed").length,
    created: source.filter((item) => item?.event === "client_equivalent_created").length,
  };
}

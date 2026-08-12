export function menuWeekCacheOwner(user = {}) {
  return String(user?.id || user?._id || user?.email || "anonymous")
    .trim()
    .toLowerCase();
}

export function menuWeekCacheKey(start, owner = "anonymous") {
  return `${String(owner || "anonymous").trim().toLowerCase()}::${String(start || "current")}`;
}

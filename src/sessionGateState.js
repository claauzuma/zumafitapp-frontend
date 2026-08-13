export function shouldShowInitialSessionLoader(query = {}) {
  return !query.data && (query.isPending === true || query.isFetching === true);
}

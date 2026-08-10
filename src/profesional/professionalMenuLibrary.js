export function defaultProfessionalMenuScope(permissions = {}) {
  return permissions.canUseGlobalMenuTemplates === true ? "all" : "mine";
}

export function isCoachOwnedLibraryMenu(menu = {}, userId = "") {
  return (
    String(menu.ownerType || "").trim().toLowerCase() === "coach" &&
    String(menu.ownerId || "").trim() === String(userId || "").trim()
  );
}

export function ownProfessionalMenus(menus = [], userId = "") {
  return menus.filter((menu) => isCoachOwnedLibraryMenu(menu, userId));
}

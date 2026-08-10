import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultProfessionalMenuScope,
  ownProfessionalMenus,
} from "./professionalMenuLibrary.js";
import { queryKeys } from "../queryClient.js";

test("abre la vista combinada cuando el plan permite biblioteca global", () => {
  assert.equal(defaultProfessionalMenuScope({ canUseGlobalMenuTemplates: true }), "all");
  assert.equal(defaultProfessionalMenuScope({ canUseGlobalMenuTemplates: false }), "mine");
});

test("las plantillas admin no consumen el cupo de menus propios", () => {
  const menus = [
    { id: "own", ownerType: "coach", ownerId: "coach-1" },
    { id: "admin", ownerType: "admin", ownerId: "admin-1" },
    { id: "other", ownerType: "coach", ownerId: "coach-2" },
  ];

  assert.deepEqual(ownProfessionalMenus(menus, "coach-1").map((menu) => menu.id), ["own"]);
});

test("Todos, Mis menus y Biblioteca ZumaFit tienen caches independientes", () => {
  const all = queryKeys.menusBase({ scope: "all", estado: "activo" });
  const mine = queryKeys.menusBase({ scope: "mine", estado: "activo" });
  const global = queryKeys.menusBase({ scope: "global", estado: "activo" });

  assert.notDeepEqual(all, mine);
  assert.notDeepEqual(all, global);
  assert.notDeepEqual(mine, global);
  assert.equal(all[1].scope, "all");
  assert.equal(mine[1].scope, "mine");
  assert.equal(global[1].scope, "global");
});

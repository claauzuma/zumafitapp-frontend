import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTrackingDraftProposals,
  buildTrackingQuantityCalculationRequest,
  createTrackingFoodDraft,
  createTrackingRegisteredReplacementDraft,
  hasTrackingDraftQuantity,
  hasTrackingDraftPhysicallyValidQuantity,
  isTrackingFoodQuantityPhysicallyValid,
  isTrackingDraftAutomatic,
  isTrackingDraftCalculated,
  isTrackingRegisteredReplacementDraft,
  loadTrackingDraftState,
  markTrackingDraftAutomatic,
  markTrackingDraftManual,
  partitionTrackingDraftConfirmations,
  saveTrackingDraftState,
  TRACKING_QUANTITY_MODE_CALORIE_FILL,
  TRACKING_QUANTITY_MODE_CONSTRAINED,
  TRACKING_QUANTITY_MODE_OPTIONS,
  trackingDraftCalculationPayload,
  trackingDraftConfirmationRequestId,
  trackingDateDrafts,
  trackingDateDraftTotals,
  trackingDateDraftProjectedDelta,
  trackingDraftKey,
  trackingDraftStorageKey,
  trackingDraftStorageOwner,
  trackingDraftsNutritionTotals,
  trackingDraftsProjectedDelta,
  trackingDraftsQuantityMode,
  trackingDraftsReplacedTotals,
  trackingDraftProposals,
  trackingDraftsReadyToConfirm,
  trackingFoodExplicitlyAllowsFractionalQuantity,
  trackingFoodRequiresWholeQuantity,
  restoreTrackingMealDrafts,
  updateTrackingDraftsQuantityMode,
  updateTrackingFoodDraftQuantity,
  withoutTrackingMealDrafts,
} from "./trackingQuantityDrafts.js";

const rice = { id: "rice", nombre: "Arroz", unidad: "g", kcal: 340, proteina: 7, carbs: 76, grasas: 1 };
const chicken = { id: "chicken", nombre: "Pollo", unidad: "g", kcal: 165, proteina: 31, carbs: 0, grasas: 3.6 };
const banana = { id: "banana", nombre: "Banana", unidad: "g", kcal: 89, proteina: 1.1, carbs: 23, grasas: 0.3 };

test("separa cantidades fijas y alimentos pendientes para el motor existente", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
    createTrackingFoodDraft(banana, "", "draft-banana"),
  ];
  const payload = trackingDraftCalculationPayload(drafts);

  assert.equal(payload.fixedFoods.length, 1);
  assert.equal(payload.fixedFoods[0].foodId, "rice");
  assert.equal(payload.fixedFoods[0].quantity, 100);
  assert.equal(payload.fixedFoods[0].kcal, 340);
  assert.deepEqual(payload.pendingFoods.map((food) => food.foodId), ["chicken", "banana"]);
  assert.equal(payload.fixedTotals.kcal, 340);
});

test("un alimento pendiente no tiene nutricion ni queda listo para confirmar", () => {
  const pending = createTrackingFoodDraft(chicken, "", "draft-chicken");
  assert.equal(hasTrackingDraftQuantity(pending), false);
  assert.equal(isTrackingDraftAutomatic(pending), true);
  assert.equal(trackingDraftsReadyToConfirm([pending]), false);

  const manual = updateTrackingFoodDraftQuantity(pending, 150);
  assert.equal(manual.status, "manual");
  assert.equal(isTrackingDraftAutomatic(manual), false);
  assert.equal(hasTrackingDraftQuantity(manual), true);
  assert.equal(trackingDraftsReadyToConfirm([manual]), true);
});

test("permite alternar una cantidad existente entre fija y automatica", () => {
  const manual = createTrackingFoodDraft(rice, 100, "draft-rice");
  const automatic = markTrackingDraftAutomatic(manual);
  const payload = trackingDraftCalculationPayload([automatic]);

  assert.equal(isTrackingDraftAutomatic(automatic), true);
  assert.equal(payload.fixedFoods.length, 0);
  assert.equal(payload.pendingFoods.length, 1);
  assert.equal(payload.pendingFoods[0].currentQuantity, 100);
  assert.equal(trackingDraftsNutritionTotals([automatic]).kcal, 0);
  assert.equal(trackingDraftsReadyToConfirm([automatic]), false);
  assert.equal(markTrackingDraftManual(automatic).mode, "manual");
});

test("un pendiente sin cantidad puede pasar de Auto a Manual para editarse", () => {
  const automatic = createTrackingFoodDraft(chicken, "", "draft-chicken");
  const manual = markTrackingDraftManual(automatic);
  const stillManualWhenEmpty = updateTrackingFoodDraftQuantity(manual, "");

  assert.equal(isTrackingDraftAutomatic(manual), false);
  assert.equal(manual.status, "manual");
  assert.equal(isTrackingDraftAutomatic(stillManualWhenEmpty), false);
  assert.equal(trackingDraftsReadyToConfirm([stillManualWhenEmpty]), false);
});

test("convierte un registro confirmado en reemplazo Auto sin duplicar su proyeccion", () => {
  const registeredChicken = {
    id: "log-chicken-817",
    alimentoId: "chicken",
    nombreSnapshot: "Pechuga de pollo",
    cantidad: 817,
    unidad: "g",
    kcal: 899,
    proteina: 163.4,
    carbs: 0,
    grasas: 60,
  };
  const replacement = createTrackingRegisteredReplacementDraft(
    registeredChicken,
    "replace-chicken"
  );

  assert.equal(isTrackingRegisteredReplacementDraft(replacement), true);
  assert.equal(replacement.replacesLogId, "log-chicken-817");
  assert.equal(replacement.registeredQuantity, 817);
  assert.equal(isTrackingDraftAutomatic(replacement), true);
  assert.deepEqual(trackingDraftsReplacedTotals([replacement]), {
    kcal: 899,
    proteina: 163.4,
    carbs: 0,
    grasas: 60,
  });
  assert.deepEqual(trackingDraftsProjectedDelta([replacement]), {
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
  });
  assert.equal(trackingDraftCalculationPayload([replacement]).pendingFoods[0].foodId, "chicken");
  assert.equal(createTrackingRegisteredReplacementDraft({
    ...registeredChicken,
    alimentoId: "",
  }), null);

  const manualReplacement = updateTrackingFoodDraftQuantity(
    markTrackingDraftManual(replacement),
    817
  );
  assert.equal(trackingDraftsProjectedDelta([manualReplacement]).kcal, 0);
});

test("la proyeccion diaria resta el registro reemplazado y suma solo la nueva propuesta", () => {
  const key = trackingDraftKey("2026-07-27", "snack");
  const replacement = createTrackingRegisteredReplacementDraft({
    id: "log-chicken",
    alimentoId: "chicken",
    nombreSnapshot: "Pechuga de pollo",
    cantidad: 100,
    unidad: "g",
    kcal: 165,
    proteina: 31,
    carbs: 0,
    grasas: 3.6,
  }, "replace-chicken");
  const calculated = applyTrackingDraftProposals([replacement], [{
    food: replacement.food,
    quantity: 120,
    unit: "g",
  }]);
  const draftsByMeal = { [key]: calculated };

  assert.equal(trackingDateDraftTotals(draftsByMeal, "2026-07-27").kcal, 198);
  assert.equal(trackingDateDraftProjectedDelta(draftsByMeal, "2026-07-27").kcal, 33);
});

test("al confirmar separa reemplazos de registros y alimentos realmente nuevos", () => {
  const replacement = createTrackingRegisteredReplacementDraft({
    id: "log-chicken",
    alimentoId: "chicken",
    nombreSnapshot: "Pechuga de pollo",
    cantidad: 817,
    unidad: "g",
    kcal: 899,
    proteina: 163.4,
    carbs: 0,
    grasas: 60,
  }, "replace-chicken");
  const almonds = createTrackingFoodDraft({
    id: "almonds",
    nombre: "Almendras",
    unidad: "Unidad",
    kcal: 7,
    proteina: 0.25,
    carbs: 0.15,
    grasas: 0.6,
  }, 2, "new-almonds");
  const proposals = trackingDraftProposals([replacement, almonds], [{
    foodId: "chicken",
    nombre: "Pechuga de pollo",
    quantity: 800,
    unit: "g",
  }]);
  const partition = partitionTrackingDraftConfirmations([replacement, almonds], proposals);

  assert.equal(partition.replacements.length, 1);
  assert.equal(partition.replacements[0].draft.replacesLogId, "log-chicken");
  assert.equal(partition.additions.length, 1);
  assert.equal(partition.additions[0].draft.foodId, "almonds");
});

test("combina la cantidad fija con las propuestas calculadas sin duplicarla", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
    createTrackingFoodDraft(banana, "", "draft-banana"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "chicken", nombre: "Pollo", quantity: 80, unit: "g", kcal: 132 },
    { foodId: "banana", nombre: "Banana", quantity: 45, unit: "g", kcal: 40 },
  ]);

  assert.equal(proposals.length, 3);
  assert.equal(proposals.filter((proposal) => proposal.food.id === "rice").length, 1);
  assert.equal(proposals.find((proposal) => proposal.food.id === "rice").quantity, 100);
  assert.equal(proposals.find((proposal) => proposal.food.id === "chicken").quantity, 80);
  assert.equal(proposals.find((proposal) => proposal.food.id === "banana").quantity, 45);
});

test("aplica la propuesta al borrador sin registrar ni modificar cantidades fijas", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "chicken", nombre: "Pollo", quantity: 80, unit: "g", kcal: 132 },
  ]);
  const applied = applyTrackingDraftProposals(drafts, proposals);

  assert.equal(applied[0], drafts[0]);
  assert.equal(applied[0].quantity, 100);
  assert.equal(applied[0].status, "manual");
  assert.equal(applied[1].quantity, 80);
  assert.equal(applied[1].status, "calculated");
  assert.equal(isTrackingDraftAutomatic(applied[1]), true);
  assert.equal(isTrackingDraftCalculated(applied[1]), true);
  assert.equal(trackingDraftsReadyToConfirm(applied), true);
  assert.equal(trackingDraftsNutritionTotals(applied).kcal, 472);
  const finalProposals = trackingDraftProposals(applied, []);
  assert.equal(finalProposals.length, 2);
  assert.equal(finalProposals.find((proposal) => proposal.food.id === "chicken").quantity, 80);
  assert.equal(finalProposals.find((proposal) => proposal.food.id === "chicken").fixed, false);
});

test("conserva la unidad original del alimento al preparar el snapshot final", () => {
  const egg = { id: "egg", nombre: "Huevo", unidad: "unidad", kcal: 78, proteina: 6, carbs: 0.6, grasas: 5 };
  const proposals = trackingDraftProposals(
    [createTrackingFoodDraft(egg, "", "draft-egg")],
    [{ foodId: "egg", nombre: "Huevo", quantity: 2, unit: "g", kcal: 156 }]
  );

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].quantity, 2);
  assert.equal(proposals[0].unit, "unidad");
});

test("dos homónimos simultáneos se emparejan por ID y nunca por conveniencia de nombre", () => {
  const byUnit = { id: "same-unit", nombre: "Tostadita igual", unidad: "Unid", kcal: 10 };
  const byGrams = { id: "same-grams", nombre: "Tostadita igual", unidad: "Grs", kcal: 2 };
  const drafts = [
    createTrackingFoodDraft(byUnit, "", "draft-unit"),
    createTrackingFoodDraft(byGrams, "", "draft-grams"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "same-grams", nombre: "Tostadita igual", quantity: 20, unit: "Grs" },
    { foodId: "same-unit", nombre: "Tostadita igual", quantity: 2, unit: "Unid" },
  ]);

  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].food.id, "same-unit");
  assert.equal(proposals[0].quantity, 2);
  assert.equal(proposals[0].unit, "Unid");
  assert.equal(proposals[1].food.id, "same-grams");
  assert.equal(proposals[1].quantity, 20);
  assert.equal(proposals[1].unit, "Grs");

  const mismatched = trackingDraftProposals(
    [createTrackingFoodDraft(byUnit, "", "draft-mismatch")],
    [{ foodId: "different-id", nombre: "Tostadita igual", quantity: 99, unit: "Unid" }]
  );
  assert.deepEqual(mismatched, []);
});

test("conserva la precisión real de macros por unidad en el payload de cálculo", () => {
  const almonds = {
    id: "almonds",
    nombre: "Almendras",
    unidad: "Unid",
    macroBasis: "perUnit",
    kcal: 7.15,
    proteina: 0.26,
    carbs: 0.155,
    grasas: 0.61,
    porcionMin: 1,
    porcionMax: 3,
    multiplo: 1,
  };
  const payload = trackingDraftCalculationPayload([
    createTrackingFoodDraft(almonds, "", "draft-almonds"),
  ]);

  assert.deepEqual(payload.pendingFoods[0], {
    foodId: "almonds",
    name: "Almendras",
    unit: "Unid",
    source: "pending",
    currentQuantity: null,
    kcalPerUnitOrGram: 7.15,
    proteinPerUnitOrGram: 0.26,
    carbsPerUnitOrGram: 0.155,
    fatPerUnitOrGram: 0.61,
    categoria: "",
    minGramos: 1,
    maxGramos: 3,
    stepGramos: 1,
  });
});

test("aísla borradores por fecha y comida y calcula el proyectado una sola vez", () => {
  const firstDate = "2026-07-26";
  const secondDate = "2026-07-27";
  const breakfastRice = createTrackingFoodDraft(rice, 100, "rice-breakfast");
  const dinnerChicken = createTrackingFoodDraft(chicken, 100, "chicken-dinner");
  const tomorrowBanana = createTrackingFoodDraft(banana, 100, "banana-tomorrow");
  const draftsByMeal = {
    [trackingDraftKey(firstDate, "breakfast")]: [breakfastRice],
    [trackingDraftKey(firstDate, "dinner")]: [dinnerChicken],
    [trackingDraftKey(secondDate, "breakfast")]: [tomorrowBanana],
  };

  assert.deepEqual(trackingDateDrafts(draftsByMeal, firstDate), [breakfastRice, dinnerChicken]);
  assert.deepEqual(trackingDateDraftTotals(draftsByMeal, firstDate), {
    kcal: 505,
    proteina: 38,
    carbs: 76,
    grasas: 4.6,
  });
  assert.equal(trackingDateDraftTotals(draftsByMeal, secondDate).kcal, 89);
  assert.equal(trackingDateDraftTotals(draftsByMeal, "2026-07-28").kcal, 0);
});

test("los borradores nuevos usan calorie_fill y los legacy sin campo conservan constrained", () => {
  const newDraft = createTrackingFoodDraft(chicken, "", "draft-new");
  const legacyDraft = {
    id: "draft-legacy",
    foodId: chicken.id,
    name: chicken.nombre,
    food: chicken,
    quantity: 250,
    mode: "automatic",
    status: "calculated",
  };

  assert.equal(newDraft.trackingQuantityMode, TRACKING_QUANTITY_MODE_CALORIE_FILL);
  assert.equal(trackingDraftsQuantityMode([newDraft]), TRACKING_QUANTITY_MODE_CALORIE_FILL);
  assert.equal(trackingDraftsQuantityMode([legacyDraft]), TRACKING_QUANTITY_MODE_CONSTRAINED);
  assert.equal(trackingDraftsQuantityMode([]), TRACKING_QUANTITY_MODE_CALORIE_FILL);
});

test("el selector expone sólo los dos valores y textos explícitos de producto", () => {
  assert.deepEqual(
    TRACKING_QUANTITY_MODE_OPTIONS.map(({ value, label }) => ({ value, label })),
    [
      { value: "constrained", label: "Respetar porciones" },
      { value: "calorie_fill", label: "Completar calorías" },
    ]
  );
});

test("fecha y comida conservan su método sin copiarlo a otro borrador", () => {
  const modesByDraftKey = {
    [trackingDraftKey("2026-07-27", "almuerzo")]: updateTrackingDraftsQuantityMode(
      [createTrackingFoodDraft(chicken, "", "today-lunch")],
      TRACKING_QUANTITY_MODE_CONSTRAINED
    ),
    [trackingDraftKey("2026-07-27", "cena")]: [
      createTrackingFoodDraft(rice, "", "today-dinner"),
    ],
    [trackingDraftKey("2026-07-28", "almuerzo")]: [
      createTrackingFoodDraft(banana, "", "tomorrow-lunch"),
    ],
  };

  assert.equal(
    trackingDraftsQuantityMode(modesByDraftKey["2026-07-27:almuerzo"]),
    TRACKING_QUANTITY_MODE_CONSTRAINED
  );
  assert.equal(
    trackingDraftsQuantityMode(modesByDraftKey["2026-07-27:cena"]),
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
  assert.equal(
    trackingDraftsQuantityMode(modesByDraftKey["2026-07-28:almuerzo"]),
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
});

test("cambiar el método conserva alimentos, cantidades, estados y propuesta previa", () => {
  const pendingDrafts = [createTrackingFoodDraft(chicken, "", "draft-chicken")];
  const drafts = applyTrackingDraftProposals(
    pendingDrafts,
    trackingDraftProposals(pendingDrafts, [
      { foodId: "chicken", nombre: "Pollo", quantity: 487, unit: "g", kcal: 803.55 },
    ]),
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
  const changed = updateTrackingDraftsQuantityMode(
    drafts,
    TRACKING_QUANTITY_MODE_CONSTRAINED
  );

  assert.equal(changed.length, 1);
  assert.equal(changed[0].quantity, 487);
  assert.equal(changed[0].status, "calculated");
  assert.equal(changed[0].mode, "automatic");
  assert.equal(changed[0].trackingQuantityMode, TRACKING_QUANTITY_MODE_CONSTRAINED);
  assert.equal(
    changed[0].calculatedWithTrackingQuantityMode,
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
});

test("editar un Calculado lo vuelve Manual y el próximo payload recalcula sólo los Auto", () => {
  const calculated = applyTrackingDraftProposals(
    [
      createTrackingFoodDraft(chicken, "", "draft-chicken"),
      createTrackingFoodDraft(banana, "", "draft-banana"),
    ],
    [
      { foodId: "chicken", nombre: "Pollo", quantity: 500, unit: "g", kcal: 825 },
      { foodId: "banana", nombre: "Banana", quantity: 80, unit: "g", kcal: 71.2 },
    ],
    TRACKING_QUANTITY_MODE_CALORIE_FILL
  );
  const edited = calculated.map((draft) => (
    draft.id === "draft-chicken"
      ? updateTrackingFoodDraftQuantity(draft, 350)
      : draft
  ));
  const payload = trackingDraftCalculationPayload(edited);

  assert.equal(edited[0].mode, "manual");
  assert.equal(edited[0].status, "manual");
  assert.equal(edited[0].quantity, 350);
  assert.equal(payload.fixedFoods.length, 1);
  assert.equal(payload.fixedFoods[0].foodId, "chicken");
  assert.equal(payload.fixedFoods[0].quantity, 350);
  assert.deepEqual(payload.pendingFoods.map((food) => food.foodId), ["banana"]);
});

test("el request de Tracking envía el modo exacto y activa min/max sólo en constrained", () => {
  const calorieFill = buildTrackingQuantityCalculationRequest({
    date: "2026-07-27",
    target: { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 },
    trackingQuantityMode: TRACKING_QUANTITY_MODE_CALORIE_FILL,
    fixedFoods: [{ foodId: "rice", quantity: 100 }],
    pendingFoods: [{ foodId: "chicken" }],
  });
  const constrained = buildTrackingQuantityCalculationRequest({
    trackingQuantityMode: TRACKING_QUANTITY_MODE_CONSTRAINED,
  });
  const unknown = buildTrackingQuantityCalculationRequest({
    trackingQuantityMode: "sin_limites",
  });

  assert.equal(calorieFill.trackingQuantityMode, "calorie_fill");
  assert.equal(calorieFill.mode, "kcalProteina");
  assert.equal(calorieFill.generationType, "selectedOnly");
  assert.equal(calorieFill.options.usarMinMax, false);
  assert.equal(constrained.trackingQuantityMode, "constrained");
  assert.equal(constrained.options.usarMinMax, true);
  assert.equal(unknown.trackingQuantityMode, "constrained");
});

test("las unidades discretas rechazan fracciones por semántica y no por nombre", () => {
  const discreteFoods = [
    { id: "egg", nombre: "Huevo", unidad: "Unid", kcal: 78 },
    { id: "bread", nombre: "Pan", unidad: "rodaja", kcal: 92 },
    { id: "generic", nombre: "Alimento cualquiera", unidad: "pieza", kcal: 55 },
  ];

  discreteFoods.forEach((food, index) => {
    assert.equal(trackingFoodRequiresWholeQuantity(food, food.unidad), true);
    assert.equal(isTrackingFoodQuantityPhysicallyValid(food, food.unidad, 1.5), false);
    const draft = createTrackingFoodDraft(food, 1.5, `discrete-${index}`);
    assert.equal(draft.quantity, "");
    assert.equal(isTrackingDraftAutomatic(draft), true);
    assert.equal(trackingDraftsReadyToConfirm([draft]), false);
  });
});

test("una unidad discreta sólo acepta fracciones con un flag estructural explícito", () => {
  const fractionalByRootFlag = {
    id: "root-fraction",
    nombre: "Porción divisible",
    unidad: "porción",
    allowFractionalQuantity: true,
    kcal: 120,
  };
  const fractionalByRawFlag = {
    id: "raw-fraction",
    nombre: "Envase divisible",
    unidad: "envase",
    raw: { fractionalUnitsAllowed: true },
    kcal: 180,
  };

  [fractionalByRootFlag, fractionalByRawFlag].forEach((food, index) => {
    assert.equal(trackingFoodExplicitlyAllowsFractionalQuantity(food), true);
    assert.equal(trackingFoodRequiresWholeQuantity(food, food.unidad), false);
    assert.equal(isTrackingFoodQuantityPhysicallyValid(food, food.unidad, 1.5), true);
    const draft = createTrackingFoodDraft(food, 1.5, `fractional-${index}`);
    assert.equal(draft.quantity, 1.5);
    assert.equal(hasTrackingDraftPhysicallyValidQuantity(draft), true);
    assert.equal(trackingDraftsReadyToConfirm([draft]), true);
  });
});

test("gramos y mililitros se reconocen estructuralmente como cantidades continuas", () => {
  const oil = { id: "oil", nombre: "Aceite", unidad: "ml", kcal: 8.8 };
  const riceByGrams = { id: "rice-grams", nombre: "Arroz", unidad: "Grs", kcal: 3.4 };

  assert.equal(trackingFoodRequiresWholeQuantity(oil, oil.unidad), false);
  assert.equal(trackingFoodRequiresWholeQuantity(riceByGrams, riceByGrams.unidad), false);
  assert.equal(isTrackingFoodQuantityPhysicallyValid(oil, oil.unidad, 10.5), true);
  assert.equal(isTrackingFoodQuantityPhysicallyValid(riceByGrams, riceByGrams.unidad, 80.25), true);
});

test("un borrador legacy discreto fraccionario no queda confirmable ni suma al proyectado", () => {
  const invalidLegacyDraft = {
    id: "legacy-half-unit",
    foodId: "egg",
    name: "Huevo",
    unit: "Unid",
    food: { id: "egg", nombre: "Huevo", unidad: "Unid", kcal: 78 },
    quantity: 1.5,
    mode: "manual",
    status: "manual",
  };

  assert.equal(hasTrackingDraftQuantity(invalidLegacyDraft), true);
  assert.equal(hasTrackingDraftPhysicallyValidQuantity(invalidLegacyDraft), false);
  assert.equal(trackingDraftsReadyToConfirm([invalidLegacyDraft]), false);
  assert.equal(trackingDraftsNutritionTotals([invalidLegacyDraft]).kcal, 0);
  assert.equal(trackingDraftCalculationPayload([invalidLegacyDraft]).fixedFoods.length, 0);
});

test("oculta el borrador al confirmar y lo restaura sin pisar cambios posteriores", () => {
  const key = trackingDraftKey("2026-07-27", "cena");
  const rollbackDrafts = [
    createTrackingFoodDraft(rice, 100, "rice-confirming"),
    createTrackingFoodDraft(chicken, 200, "chicken-confirming"),
  ];
  const otherKey = trackingDraftKey("2026-07-27", "almuerzo");
  const original = {
    [key]: rollbackDrafts,
    [otherKey]: [createTrackingFoodDraft(banana, 90, "banana-other-meal")],
  };

  const hidden = withoutTrackingMealDrafts(original, key);
  assert.equal(hidden[key], undefined);
  assert.deepEqual(hidden[otherKey], original[otherKey]);
  assert.deepEqual(original[key], rollbackDrafts);

  const editedWhileSaving = updateTrackingFoodDraftQuantity(rollbackDrafts[0], 125);
  const withNewChanges = {
    ...hidden,
    [key]: [
      editedWhileSaving,
      createTrackingFoodDraft(banana, 60, "banana-added-during-save"),
    ],
  };
  const restored = restoreTrackingMealDrafts(withNewChanges, key, rollbackDrafts);

  assert.deepEqual(restored[key].map((draft) => draft.id), [
    "rice-confirming",
    "chicken-confirming",
    "banana-added-during-save",
  ]);
  assert.equal(restored[key][0].quantity, 125);
  assert.equal(restored[key][1].quantity, 200);
  assert.deepEqual(restored[otherKey], original[otherKey]);
});

test("persiste borradores y feedback por usuario, fecha y comida hasta descartarlos", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const owner = trackingDraftStorageOwner({ _id: "CLIENT-123", email: "otro@correo.com" });
  const dinnerKey = trackingDraftKey("2026-07-27", "cena");
  const lunchKey = trackingDraftKey("2026-07-28", "almuerzo");
  const draftsByMeal = {
    [dinnerKey]: [createTrackingFoodDraft(chicken, 817, "persisted-chicken")],
    [lunchKey]: [createTrackingFoodDraft(rice, "", "persisted-rice")],
  };
  const feedbackByMeal = {
    [dinnerKey]: { type: "warning", title: "Macros limitados", message: "Faltan grasas." },
    "2026-07-29:sin-borrador": { type: "error", message: "No debe persistir solo." },
  };

  assert.equal(owner, "client-123");
  assert.match(trackingDraftStorageKey(owner), /client-123$/);
  assert.equal(saveTrackingDraftState(storage, owner, { draftsByMeal, feedbackByMeal }), true);

  const restored = loadTrackingDraftState(storage, owner);
  assert.deepEqual(restored.draftsByMeal, draftsByMeal);
  assert.deepEqual(restored.feedbackByMeal, {
    [dinnerKey]: feedbackByMeal[dinnerKey],
  });
  assert.deepEqual(loadTrackingDraftState(storage, "otro-cliente"), {
    draftsByMeal: {},
    feedbackByMeal: {},
  });

  assert.equal(saveTrackingDraftState(storage, owner, {}), true);
  assert.equal(values.has(trackingDraftStorageKey(owner)), false);
});

test("un reemplazo Manual-Auto sobrevive la recarga y cancelar conserva el registro original", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const owner = "client-replacement";
  const key = trackingDraftKey("2026-07-27", "snack");
  const original = {
    id: "log-chicken",
    alimentoId: "chicken",
    nombreSnapshot: "Pechuga de pollo",
    cantidad: 817,
    unidad: "g",
    kcal: 899,
    proteina: 163.4,
    carbs: 0,
    grasas: 60,
  };
  const replacement = createTrackingRegisteredReplacementDraft(original, "replace-chicken");

  assert.equal(saveTrackingDraftState(storage, owner, {
    draftsByMeal: { [key]: [replacement] },
  }), true);
  const restored = loadTrackingDraftState(storage, owner);
  assert.deepEqual(restored.draftsByMeal[key][0], replacement);
  assert.equal(restored.draftsByMeal[key][0].replacesLogId, original.id);
  assert.equal(restored.draftsByMeal[key][0].registeredQuantity, original.cantidad);

  const discarded = withoutTrackingMealDrafts(restored.draftsByMeal, key);
  assert.equal(Object.prototype.hasOwnProperty.call(discarded, key), false);
  assert.equal(original.cantidad, 817);
  assert.equal(original.kcal, 899);
});

test("ignora storage corrupto o de otra versión sin romper Tracking", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const owner = "client-corrupt";
  const key = trackingDraftStorageKey(owner);

  values.set(key, "{contenido inválido");
  assert.deepEqual(loadTrackingDraftState(storage, owner), {
    draftsByMeal: {},
    feedbackByMeal: {},
  });

  values.set(key, JSON.stringify({ version: 999, draftsByMeal: { x: [{}] } }));
  assert.deepEqual(loadTrackingDraftState(storage, owner), {
    draftsByMeal: {},
    feedbackByMeal: {},
  });
});

test("la confirmación conserva el mismo requestId tras recargar y cambia al editar", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "stable-rice"),
    createTrackingFoodDraft(chicken, 817, "stable-chicken"),
  ];
  const restored = JSON.parse(JSON.stringify(drafts));
  const first = trackingDraftConfirmationRequestId("2026-07-27", "snack", drafts);
  const afterReload = trackingDraftConfirmationRequestId("2026-07-27", "snack", restored);
  const edited = drafts.map((draft) => (
    draft.id === "stable-chicken"
      ? updateTrackingFoodDraftQuantity(draft, 300)
      : draft
  ));

  assert.equal(afterReload, first);
  assert.notEqual(
    trackingDraftConfirmationRequestId("2026-07-27", "snack", edited),
    first
  );
  assert.notEqual(
    trackingDraftConfirmationRequestId("2026-07-28", "snack", drafts),
    first
  );
  assert.ok(first.length <= 120);
});

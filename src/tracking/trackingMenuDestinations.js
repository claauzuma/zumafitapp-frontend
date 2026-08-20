import { assignmentFlexibleCalories } from "../menus/menuAssignmentCompatibility.js";
import { flexibleMarginTotals } from "../menus/flexibleMarginTracking.js";


function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function positive(value) {
  return Math.max(
    0,
    number(value)
  );
}


function normalizeType(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}


/*
 * Lleva distintas formas de escribir una comida
 * a una identidad lógica común.
 *
 * Ej:
 *
 * "Cena"
 * "cena"
 * "Comida Cena"
 *
 * => "cena"
 */


function canonicalMealType(value = "") {
  const normalized =
    normalizeType(value);

  /*
   * IMPORTANTE:
   *
   * El backend de FoodLogs solamente admite:
   *
   * desayuno
   * almuerzo
   * merienda
   * cena
   * snack
   * otra
   *
   * Por eso esta función NUNCA debe devolver
   * tokens arbitrarios como:
   *
   * lunch
   * dinner
   * meal_2
   * comida
   * preentreno
   * etc.
   */

  if (!normalized) {
    return "otra";
  }


  /*
   * DESAYUNO
   */
  if (
    normalized.includes("desay") ||
    normalized === "breakfast"
  ) {
    return "desayuno";
  }


  /*
   * ALMUERZO
   */
  if (
    normalized.includes("almuer") ||
    normalized === "lunch"
  ) {
    return "almuerzo";
  }


  /*
   * MERIENDA
   */
  if (
    normalized.includes("meriend") ||
    normalized === "tea" ||
    normalized === "afternoon_snack"
  ) {
    return "merienda";
  }


  /*
   * CENA
   */
  if (
    normalized.includes("cena") ||
    normalized === "dinner" ||
    normalized === "supper"
  ) {
    return "cena";
  }


  /*
   * SNACK / COLACIÓN
   */
  if (
    normalized.includes("snack") ||
    normalized.includes("colacion")
  ) {
    return "snack";
  }


  /*
   * Pre/Post entreno u otros tipos personalizados
   * hoy no existen como MEAL_TYPE en FoodLogs.
   *
   * No perdemos la etiqueta visible:
   * destination.label puede seguir diciendo
   * "Pre entreno", etc.
   *
   * Técnicamente Tracking lo guarda como "otra".
   */
  return "otra";
}



function normalizeTotals(value = {}) {
  const source =
    value?.totales ||
    value?.totals ||
    value ||
    {};

  return {
    kcal: positive(
      source?.kcal ??
      source?.calorias ??
      source?.calories
    ),

    proteina: positive(
      source?.proteina ??
      source?.proteinas ??
      source?.protein ??
      source?.p
    ),

    carbs: positive(
      source?.carbs ??
      source?.carbohidratos ??
      source?.carbohydrates ??
      source?.c
    ),

    grasas: positive(
      source?.grasas ??
      source?.grasa ??
      source?.fat ??
      source?.g
    ),
  };
}


function normalizeTarget(value = {}) {
  const source =
    value?.target ||
    value?.objetivo ||
    value ||
    {};

  return normalizeTotals(source);
}


function hasTotals(value = {}) {
  const totals =
    normalizeTotals(value);

  return Boolean(
    totals.kcal > 0 ||
    totals.proteina > 0 ||
    totals.carbs > 0 ||
    totals.grasas > 0
  );
}


function menuMealId(
  meal = {},
  index = 0
) {
  return String(
    meal?.id ||
    meal?._id ||
    meal?.mealId ||
    meal?.nombre ||
    meal?.name ||
    `meal-${index + 1}`
  );
}


function menuMealLabel(
  meal = {},
  index = 0
) {
  return String(
    meal?.label ||
    meal?.nombre ||
    meal?.name ||
    `Comida ${index + 1}`
  );
}


function menuMealType(
  meal = {},
  index = 0
) {
  return canonicalMealType(
    meal?.type ||
    meal?.mealType ||
    meal?.tipo ||
    meal?.tipoComida ||
    meal?.mealSlotType ||
    menuMealLabel(
      meal,
      index
    )
  );
}


/*
 * =========================================
 * META PURA POR COMIDA
 * =========================================
 *
 * IMPORTANTE:
 *
 * Para las metas sin propuesta concreta
 * necesitamos una identidad estable.
 *
 * MenuPlan ya utiliza planned-meal-X
 * como fallback cuando la meta no tiene ID.
 */
function plannedMealId(
  meal = {},
  index = 0
) {
  return String(
    meal?.id ||
    `planned-meal-${index + 1}`
  );
}


function plannedMealMatchId(
  meal = {}
) {
  return String(
    meal?.id ||
    meal?.mealId ||
    meal?._id ||
    ""
  );
}


function plannedMealLabel(
  meal = {},
  index = 0
) {
  return String(
    meal?.label ||
    meal?.name ||
    meal?.nombre ||
    `Comida ${index + 1}`
  );
}


function plannedMealType(
  meal = {},
  index = 0
) {
  return canonicalMealType(
    meal?.type ||
    meal?.mealType ||
    meal?.tipo ||
    meal?.tipoComida ||
    plannedMealLabel(
      meal,
      index
    )
  );
}


function safeExecutionId(value = "") {
  return String(value || "")
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )
    .slice(0, 68);
}


function menuTargetExecutionId(
  value = ""
) {
  return `menu_target_${safeExecutionId(
    value
  )}`;
}


function dailyTargetExecutionId(
  day = {}
) {
  const date =
    String(
      day?.date ||
      day?.fecha ||
      "day"
    );

  return `daily_target_${safeExecutionId(
    date
  )}`;
}


/*
 * Devuelve las metas por comida
 * configuradas para el día.
 */
function mealTargetPlanMeals(
  day = {}
) {
  const plan =
    day?.mealTargetPlan ||
    null;

  if (
    !plan ||
    plan?.mode !== "per_meal" ||
    !Array.isArray(plan?.meals)
  ) {
    return [];
  }

  return plan.meals;
}


/*
 * =========================================
 * MATCH:
 * comida concreta <-> meta por comida
 * =========================================
 *
 * Orden:
 *
 * 1. ID
 * 2. tipo lógico
 * 3. nombre
 * 4. posición, pero sólo cuando es seguro
 *
 * Esto es fundamental para casos mixtos:
 *
 * Menú:
 * - Desayuno concreto
 * - Cena concreta
 *
 * Metas:
 * - Desayuno
 * - Almuerzo
 * - Cena
 *
 * Almuerzo NO puede pegarse accidentalmente
 * sobre Cena sólo por posición.
 */
function findPlannedMealMatch(
  plannedMeals = [],
  menuMeal = {},
  menuMealIndex = 0,
  menuMealsCount = 0
) {
  if (!plannedMeals.length) {
    return null;
  }

  const currentId =
    menuMealId(
      menuMeal,
      menuMealIndex
    );

  const currentType =
    menuMealType(
      menuMeal,
      menuMealIndex
    );

  const currentLabel =
    normalizeType(
      menuMealLabel(
        menuMeal,
        menuMealIndex
      )
    );


  /*
   * 1. ID exacto
   */
  const byIdIndex =
    plannedMeals.findIndex(
      (candidate) => {
        const candidateId =
          plannedMealMatchId(
            candidate
          );

        return Boolean(
          candidateId &&
          candidateId === currentId
        );
      }
    );

  if (byIdIndex >= 0) {
    return {
      index: byIdIndex,
      meal:
        plannedMeals[
          byIdIndex
        ],
      matchedBy: "id",
    };
  }


  /*
   * 2. Tipo lógico
   */
  if (currentType) {
    const byTypeIndex =
      plannedMeals.findIndex(
        (
          candidate,
          candidateIndex
        ) => {
          const candidateType =
            plannedMealType(
              candidate,
              candidateIndex
            );

          return Boolean(
            candidateType &&
            candidateType ===
              currentType
          );
        }
      );

    if (byTypeIndex >= 0) {
      return {
        index: byTypeIndex,
        meal:
          plannedMeals[
            byTypeIndex
          ],
        matchedBy: "type",
      };
    }
  }


  /*
   * 3. Nombre normalizado
   */
  if (currentLabel) {
    const byLabelIndex =
      plannedMeals.findIndex(
        (
          candidate,
          candidateIndex
        ) =>
          normalizeType(
            plannedMealLabel(
              candidate,
              candidateIndex
            )
          ) === currentLabel
      );

    if (byLabelIndex >= 0) {
      return {
        index: byLabelIndex,
        meal:
          plannedMeals[
            byLabelIndex
          ],
        matchedBy: "label",
      };
    }
  }


  /*
   * 4. Posición.
   *
   * Sólo usamos posición libremente si
   * ambos conjuntos tienen la misma cantidad.
   *
   * Esto conserva compatibilidad con planes
   * viejos que no tenían buenos IDs/tipos,
   * pero evita matches peligrosos en mixtos.
   */
  const byIndex =
    plannedMeals[
      menuMealIndex
    ];

  if (
    byIndex &&
    plannedMeals.length ===
      menuMealsCount
  ) {
    return {
      index: menuMealIndex,
      meal: byIndex,
      matchedBy: "index",
    };
  }


  return null;
}


/*
 * Devuelve la opción de menú
 * realmente activa ese día.
 *
 * Puede ser:
 *
 * - menú principal
 * - alternativa completa seleccionada
 */
function activeMenuAssignment(
  day = {}
) {
  const assignment =
    day?.assignment ||
    {};

  const primary =
    assignment?.primaryMenu ||
    null;

  const alternatives =
    Array.isArray(
      assignment?.alternatives
    )
      ? assignment.alternatives
      : [];

  const selectedAlternativeIndex =
    Number(
      day
        ?.tracking
        ?.selectedAlternative
        ?.index
    );

  if (
    Number.isInteger(
      selectedAlternativeIndex
    ) &&
    selectedAlternativeIndex >= 0 &&
    alternatives[
      selectedAlternativeIndex
    ]
  ) {
    return {
      entry:
        alternatives[
          selectedAlternativeIndex
        ],

      kind: "alternative",

      index:
        selectedAlternativeIndex,
    };
  }

  if (!primary) {
    return null;
  }

  return {
    entry: primary,
    kind: "primary",
    index: null,
  };
}


/*
 * =========================================
 * RESULTADO VACÍO ESTÁNDAR
 * =========================================
 */
function emptyDestinationResult() {
  return {
    hasMenu: false,

    hasMealTargets: false,

    hasDailyTarget: false,

    menuChoice: null,

    freeCalories: null,

    dailyTarget: null,

    meals: [],

    destinations: [],
  };
}


/*
 * =========================================
 * BUILDER PRINCIPAL
 * =========================================
 *
 * CASOS SOPORTADOS:
 *
 * A. Menú concreto.
 *
 * B. Metas puras por comida.
 *
 * C. Mixto:
 *    algunas propuestas +
 *    algunas metas puras.
 *
 * D. Sólo objetivo diario.
 *
 * E. Calorías libres.
 */
export function buildTrackingMenuDestinations(
  menuTrackingDay = null
) {
  if (!menuTrackingDay) {
    return emptyDestinationResult();
  }


  /*
   * =========================================
   * INFORMACIÓN BASE
   * =========================================
   */

  const activeChoice =
    activeMenuAssignment(
      menuTrackingDay
    );

  const snapshot =
    activeChoice
      ?.entry
      ?.menuSnapshot ||
    {};

  const menuMeals =
    Array.isArray(
      snapshot?.meals
    )
      ? snapshot.meals
      : Array.isArray(
          snapshot?.comidas
        )
        ? snapshot.comidas
        : [];

  const plannedMeals =
    mealTargetPlanMeals(
      menuTrackingDay
    );


  const completedIds =
    new Set(
      Array.isArray(
        menuTrackingDay
          ?.tracking
          ?.completedMenuMealIds
      )
        ? menuTrackingDay
            .tracking
            .completedMenuMealIds
            .map(String)
        : []
    );

  const targetIds =
    new Set(
      Array.isArray(
        menuTrackingDay
          ?.tracking
          ?.targetMealIds
      )
        ? menuTrackingDay
            .tracking
            .targetMealIds
            .map(String)
        : []
    );


  /*
   * Vamos guardando qué metas del coach
   * ya quedaron representadas por una
   * comida concreta.
   *
   * Las restantes serán "meal_target".
   */
  const matchedPlannedIndexes =
    new Set();


  /*
   * =========================================
   * A) COMIDAS CONCRETAS DEL MENÚ
   * =========================================
   */

  const menuMealDestinations =
    menuMeals
      .map(
        (
          meal,
          mealIndex
        ) => {
          const id =
            menuMealId(
              meal,
              mealIndex
            );

          const completed =
            completedIds.has(
              id
            );

          const targetMode =
            targetIds.has(
              id
            );


          /*
           * Buscamos si además existe
           * una meta del coach para
           * esta misma comida.
           */
          const plannedMatch =
            findPlannedMealMatch(
              plannedMeals,
              meal,
              mealIndex,
              menuMeals.length
            );

          if (plannedMatch) {
            matchedPlannedIndexes.add(
              plannedMatch.index
            );
          }


          /*
           * Si hay meta por comida:
           * usamos ESA meta.
           *
           * Si no:
           * usamos la nutrición de
           * la propuesta concreta.
           */
          const target =
            plannedMatch
              ? normalizeTarget(
                  plannedMatch.meal
                )
              : normalizeTotals(
                  meal
                );


          return {
            kind:
              "menu_meal",

            menuMealId:
              id,

            mealIndex,

            label:
              menuMealLabel(
                meal,
                mealIndex
              ),

            type:
              menuMealType(
                meal,
                mealIndex
              ),

            status:
              targetMode
                ? "target"
                : "pending",

            targetMode,

            completed,

            /*
             * Cuando está Pendiente y
             * elegimos este destino,
             * Tracking debe convertirlo
             * al modo Por meta.
             *
             * Éste es el comportamiento
             * que YA funciona hoy.
             */
            activatesTargetMode:
              !targetMode,

            nativeTarget:
              false,

            target,

            executionId:
              menuTargetExecutionId(
                id
              ),

            plannedTarget:
              plannedMatch
                ?.meal ||
              null,

            plannedTargetIndex:
              plannedMatch
                ?.index ??
              null,

            meal,
          };
        }
      )
      .filter(
        (destination) =>
          !destination.completed
      );


  /*
   * =========================================
   * B) METAS PURAS DEL COACH
   * =========================================
   *
   * Son metas que NO tienen una propuesta
   * concreta equivalente en el menú.
   *
   * Ej:
   *
   * Almuerzo
   * 894 kcal
   * P56 / C115 / G23
   *
   * pero sin alimentos propuestos.
   *
   * Ya nacieron siendo "Por meta".
   * NO deben tocar targetMealIds.
   */

  const pureMealTargetDestinations =
    plannedMeals
      .map(
        (
          plannedMeal,
          plannedIndex
        ) => {
          if (
            matchedPlannedIndexes.has(
              plannedIndex
            )
          ) {
            return null;
          }

          const id =
            plannedMealId(
              plannedMeal,
              plannedIndex
            );

          return {
            kind:
              "meal_target",

            /*
             * Lo dejamos disponible también
             * como identidad genérica para
             * componentes que hoy esperan
             * menuMealId.
             *
             * Pero su kind diferencia
             * claramente la persistencia.
             */
            menuMealId:
              id,

            mealTargetId:
              id,

            mealIndex:
              plannedIndex,

            label:
              plannedMealLabel(
                plannedMeal,
                plannedIndex
              ),

            type:
              plannedMealType(
                plannedMeal,
                plannedIndex
              ),

            status:
              "target",

            targetMode:
              true,

            completed:
              false,

            /*
             * CLAVE:
             *
             * Esta meta NO necesita ser
             * agregada a targetMealIds.
             *
             * Ya nació como meta.
             */
            activatesTargetMode:
              false,

            nativeTarget:
              true,

            target:
              normalizeTarget(
                plannedMeal
              ),

            executionId:
              menuTargetExecutionId(
                id
              ),

            plannedTarget:
              plannedMeal,

            plannedTargetIndex:
              plannedIndex,

            /*
             * Dejamos la meta como meal
             * para compatibilidad visual.
             */
            meal:
              plannedMeal,
          };
        }
      )
      .filter(Boolean);


  /*
   * =========================================
   * C) UNIÓN SIN DUPLICADOS
   * =========================================
   */

  const availableMeals = [
    ...menuMealDestinations,
    ...pureMealTargetDestinations,
  ];


  /*
   * =========================================
   * OBJETIVO DIARIO
   * =========================================
   */

  const dayTarget =
    normalizeTarget(
      menuTrackingDay?.target ||
      menuTrackingDay?.objetivo ||
      {}
    );


  /*
   * IMPORTANTE:
   *
   * El fallback diario aparece SOLAMENTE
   * cuando el día NO tiene estructura
   * de comidas.
   *
   * Es decir:
   *
   * - sin comidas concretas
   * - sin metas por comida
   * - sí existe meta diaria
   *
   * No aparece sólo porque todas las
   * comidas estén completadas.
   *
   * Eso evitaría saltarse una comida Hecha
   * registrando después contra el día.
   */

  const hasMealStructure =
    menuMeals.length > 0 ||
    plannedMeals.length > 0;

  const dailyTarget =
    !hasMealStructure &&
    hasTotals(dayTarget)
      ? {
          kind:
            "daily_target",

          id:
            "daily_target",

          label:
            "Objetivo diario",

          status:
            "target",

          targetMode:
            true,

          nativeTarget:
            true,

          activatesTargetMode:
            false,

          available:
            true,

          target:
            dayTarget,

          executionId:
            dailyTargetExecutionId(
              menuTrackingDay
            ),
        }
      : null;


  /*
   * =========================================
   * D) CALORÍAS LIBRES
   * =========================================
   *
   * Solamente tienen sentido cuando existe
   * una asignación concreta de menú.
   *
   * Conservamos exactamente el criterio
   * anterior.
   */

  let freeCalories =
    null;

  if (activeChoice?.entry) {
    const menuTotals =
      normalizeTotals(
        snapshot?.totals ||
        {}
      );

    const flexibleBaseKcal =
      positive(
        assignmentFlexibleCalories(
          activeChoice.entry,

          menuTrackingDay
            ?.target ||
          {},

          {
            kcal:
              menuTotals.kcal,

            protein:
              menuTotals.proteina,

            proteina:
              menuTotals.proteina,

            carbs:
              menuTotals.carbs,

            fat:
              menuTotals.grasas,

            grasas:
              menuTotals.grasas,
          }
        )
      );

    const flexibleConsumed =
      normalizeTotals(
        flexibleMarginTotals(
          menuTrackingDay
        )
      );

    const flexibleRemainingKcal =
      Math.max(
        0,

        flexibleBaseKcal -
        flexibleConsumed.kcal
      );

    freeCalories =
      flexibleBaseKcal > 0
        ? {
            kind:
              "free",

            id:
              "flexible_margin",

            label:
              "Calorías libres",

            baseKcal:
              flexibleBaseKcal,

            consumedKcal:
              flexibleConsumed.kcal,

            remainingKcal:
              flexibleRemainingKcal,

            consumedTotals:
              flexibleConsumed,

            available:
              flexibleRemainingKcal >
              0.5,

            dailyTarget:
              dayTarget,
          }
        : null;
  }


  /*
   * =========================================
   * LISTA GENERAL
   * =========================================
   */

  const destinations = [
    ...(freeCalories?.available
      ? [freeCalories]
      : []),

    ...availableMeals,

    ...(dailyTarget
      ? [dailyTarget]
      : []),
  ];


  /*
   * =========================================
   * RESULTADO
   * =========================================
   */

  return {
    hasMenu:
      Boolean(
        activeChoice?.entry
      ),

    hasMealTargets:
      plannedMeals.length > 0,

    hasDailyTarget:
      Boolean(
        dailyTarget
      ),

    menuChoice:
      activeChoice?.entry
        ? {
            kind:
              activeChoice.kind,

            index:
              activeChoice.index,

            menuId:
              String(
                activeChoice
                  .entry
                  ?.menuId ||
                activeChoice
                  .entry
                  ?.id ||
                ""
              ),

            name:
              snapshot?.nombre ||
              snapshot?.name ||
              "Menú",
          }
        : null,

    freeCalories,

    dailyTarget,

    meals:
      availableMeals,

    destinations,
  };
}

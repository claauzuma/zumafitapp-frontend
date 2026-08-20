import {
  buildMenuItemSnapshot,
} from "../nutricion/nutricionUtils.js";


function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function round(value) {
  return Math.round(
    number(value) * 10
  ) / 10;
}


function totalsFrom(value = {}) {
  const source =
    value?.totals ||
    value?.totales ||
    value ||
    {};

  return {
    kcal: round(
      source?.kcal ??
      source?.calorias ??
      source?.calories
    ),

    proteina: round(
      source?.proteina ??
      source?.proteinas ??
      source?.protein ??
      source?.p
    ),

    carbs: round(
      source?.carbs ??
      source?.carbohidratos ??
      source?.carbohydrates ??
      source?.c
    ),

    grasas: round(
      source?.grasas ??
      source?.grasa ??
      source?.fat ??
      source?.g
    ),
  };
}


function addTotals(left = {}, right = {}) {
  const a = totalsFrom(left);
  const b = totalsFrom(right);

  return {
    kcal: round(a.kcal + b.kcal),
    proteina: round(
      a.proteina + b.proteina
    ),
    carbs: round(
      a.carbs + b.carbs
    ),
    grasas: round(
      a.grasas + b.grasas
    ),
  };
}


function subtractTotals(
  left = {},
  right = {}
) {
  const a = totalsFrom(left);
  const b = totalsFrom(right);

  return {
    kcal: round(a.kcal - b.kcal),

    proteina: round(
      a.proteina - b.proteina
    ),

    carbs: round(
      a.carbs - b.carbs
    ),

    grasas: round(
      a.grasas - b.grasas
    ),
  };
}


function positiveTotals(value = {}) {
  const totals = totalsFrom(value);

  return {
    kcal: Math.max(
      0,
      totals.kcal
    ),

    proteina: Math.max(
      0,
      totals.proteina
    ),

    carbs: Math.max(
      0,
      totals.carbs
    ),

    grasas: Math.max(
      0,
      totals.grasas
    ),
  };
}


function sumItems(items = []) {
  return (
    Array.isArray(items)
      ? items
      : []
  ).reduce(
    (sum, item) =>
      addTotals(
        sum,
        totalsFrom(item)
      ),

    {
      kcal: 0,
      proteina: 0,
      carbs: 0,
      grasas: 0,
    }
  );
}


/*
 * Este ID tiene que terminar siendo
 * compartido también por MenuPlan.
 *
 * Por ahora nos sirve para localizar
 * consumos Por meta existentes.
 */
export function menuTargetExecutionId(
  menuMealId = ""
) {
  const safe =
    String(
      menuMealId ||
      "meal"
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      )
      // El backend limita mealId a 80: "menu_target_" ocupa 12.
      .slice(0, 68) ||
    "meal";

  return `menu_target_${safe}`;
}


/*
 * Convierte el alimento que está
 * esperando destino en kcal/macros
 * reales para esa cantidad.
 */

function trackingRegistrationState(
  registration = null
) {
  const items =
    Array.isArray(registration?.items)
      ? registration.items
      : [];

  const normalizedItems =
    items.length
      ? items
      : registration?.food
        ? [
            {
              food: registration.food,
              quantity: registration.quantity,
              unit: registration.unit,
              hasEnteredQuantity:
                registration.hasEnteredQuantity,
            },
          ]
        : [];

  let knownTotals = {
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
  };

  let pendingAutoCount = 0;

  normalizedItems.forEach((item) => {
    const quantity =
      Number(item?.quantity);

    const resolved =
      item?.hasEnteredQuantity &&
      Number.isFinite(quantity) &&
      quantity > 0;

    /*
     * Sin cantidad = AUTO todavía pendiente.
     */
    if (!resolved) {
      pendingAutoCount += 1;
      return;
    }

    const snapshot =
      buildMenuItemSnapshot(
        item.food,
        quantity,
        item.unit ||
          item.food?.unidad ||
          item.food?.unit ||
          "g"
      );

    knownTotals =
      addTotals(
        knownTotals,
        totalsFrom(snapshot)
      );
  });

  return {
    items:
      normalizedItems,

    knownTotals,

    pendingAutoCount,

    hasAutoPending:
      pendingAutoCount > 0,
  };
}

export function trackingRegistrationTotals(
  registration = null
) {
  const state =
    trackingRegistrationState(
      registration
    );

  if (
    !state.items.length ||
    state.hasAutoPending
  ) {
    /*
     * Si hay AUTO pendiente,
     * todavía no existe un total final.
     */
    return null;
  }

  return totalsFrom(
    state.knownTotals
  );
}


function macroExcess({
  target,
  remaining,
  candidate,
  key,
} = {}) {
  /*
   * Si esa comida no tiene meta
   * configurada para este macro,
   * NO decimos que se excedió.
   */
  if (
    number(target?.[key]) <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    round(
      number(candidate?.[key]) -
      Math.max(
        0,
        number(remaining?.[key])
      )
    )
  );
}

function evaluateMealFit({
  target,
  consumed,
  candidate,

  knownCandidate = {
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
  },

  hasAutoPending = false,
} = {}) {
  const safeTarget =
    totalsFrom(target);

  const safeConsumed =
    totalsFrom(consumed);

  const remainingRaw =
    subtractTotals(
      safeTarget,
      safeConsumed
    );

  const remaining =
    positiveTotals(
      remainingRaw
    );


  /*
   * =========================================
   * CASO AUTO
   * =========================================
   *
   * Todavía no sabemos la cantidad final.
   *
   * Pero sí sabemos cuánto margen queda
   * disponible para que AUTO trabaje.
   */
  if (hasAutoPending) {
    const fixedTotals =
      totalsFrom(
        knownCandidate
      );

    /*
     * Si hay otros alimentos FIJOS
     * en esta misma tanda,
     * primero descontamos esos.
     */
    const afterFixedRaw =
      subtractTotals(
        remainingRaw,
        fixedTotals
      );

    const afterFixed =
      positiveTotals(
        afterFixedRaw
      );

    const fixedKcalExcess =
      Math.max(
        0,
        round(
          -afterFixedRaw.kcal
        )
      );


    /*
     * Los alimentos FIJOS ya hicieron
     * imposible entrar en esta comida.
     */
    if (fixedKcalExcess > 1) {
      return {
        level: "over",

        title:
          "Sin margen para Auto",

        subtitle:
          `Los alimentos fijos ya exceden ${Math.round(
            fixedKcalExcess
          )} kcal.`,

        remaining:
          afterFixed,

        after:
          afterFixedRaw,

        auto: true,

        excess: {
          kcal:
            fixedKcalExcess,

          proteina:
            Math.max(
              0,
              round(
                -afterFixedRaw.proteina
              )
            ),

          carbs:
            Math.max(
              0,
              round(
                -afterFixedRaw.carbs
              )
            ),

          grasas:
            Math.max(
              0,
              round(
                -afterFixedRaw.grasas
              )
            ),
        },
      };
    }


    const availableKcal =
      Math.max(
        0,
        number(
          afterFixed.kcal
        )
      );

    /*
     * Meta con prácticamente
     * nada de espacio.
     */
    if (
      safeTarget.kcal > 0 &&
      availableKcal <= 10
    ) {
      return {
        level: "over",

        title:
          "Sin margen útil",

        subtitle:
          "No queda espacio suficiente para calcular una cantidad Auto.",

        remaining:
          afterFixed,

        after:
          afterFixedRaw,

        auto: true,

        excess: {
          kcal: 0,
          proteina: 0,
          carbs: 0,
          grasas: 0,
        },
      };
    }


    /*
     * Si alguna macro configurada
     * ya está completamente utilizada,
     * AUTO tiene menos libertad.
     */
    const macroLimited =
      [
        "proteina",
        "carbs",
        "grasas",
      ].some(
        (key) =>
          Number(
            safeTarget?.[key]
          ) > 0 &&
          Number(
            afterFixed?.[key]
          ) <= 0
      );


    /*
     * Consideramos "poco margen"
     * menos de ~80 kcal o menos del
     * 12% de la meta de la comida.
     */
    const limitedThreshold =
      safeTarget.kcal > 0
        ? Math.max(
            80,
            safeTarget.kcal * 0.12
          )
        : 80;


    if (
      availableKcal <
        limitedThreshold ||
      macroLimited
    ) {
      return {
        level: "warning",

        title:
          "Auto limitado",

        subtitle:
          "La cantidad se ajustará al poco margen disponible.",

        remaining:
          afterFixed,

        after:
          afterFixedRaw,

        auto: true,

        excess: {
          kcal: 0,
          proteina: 0,
          carbs: 0,
          grasas: 0,
        },
      };
    }


    /*
     * Hay espacio razonable.
     */
    return {
      level: "good",

      title:
        "Compatible con Auto",

      subtitle:
        "La cantidad se calculará para intentar ajustarse a esta comida.",

      remaining:
        afterFixed,

      after:
        afterFixedRaw,

      auto: true,

      excess: {
        kcal: 0,
        proteina: 0,
        carbs: 0,
        grasas: 0,
      },
    };
  }


  /*
   * =========================================
   * SIN CANTIDAD Y SIN AUTO RECONOCIBLE
   * =========================================
   */

  if (!candidate) {
    return {
      level: "neutral",

      title:
        "Cantidad pendiente",

      subtitle:
        "La compatibilidad se calculará cuando haya una cantidad definida.",

      remaining,

      after:
        remainingRaw,

      excess: {
        kcal: 0,
        proteina: 0,
        carbs: 0,
        grasas: 0,
      },
    };
  }


  /*
   * =========================================
   * CANTIDAD YA DEFINIDA
   * =========================================
   */

  const safeCandidate =
    totalsFrom(candidate);

  const after =
    subtractTotals(
      remainingRaw,
      safeCandidate
    );

  const excess = {
    kcal:
      Math.max(
        0,
        round(
          -after.kcal
        )
      ),

    proteina:
      macroExcess({
        target:
          safeTarget,

        remaining,

        candidate:
          safeCandidate,

        key:
          "proteina",
      }),

    carbs:
      macroExcess({
        target:
          safeTarget,

        remaining,

        candidate:
          safeCandidate,

        key:
          "carbs",
      }),

    grasas:
      macroExcess({
        target:
          safeTarget,

        remaining,

        candidate:
          safeCandidate,

        key:
          "grasas",
      }),
  };


  const importantMacroExcess =
    excess.proteina > 5 ||
    excess.carbs > 10 ||
    excess.grasas > 3;


  if (
    excess.kcal <= 1 &&
    !importantMacroExcess
  ) {
    return {
      level: "good",

      title:
        "Buen encaje",

      subtitle:
        "Entra bien dentro de lo que queda en esta comida.",

      remaining,

      after,

      excess,
    };
  }


  if (
    excess.kcal <= 1 &&
    importantMacroExcess
  ) {
    return {
      level: "warning",

      title:
        "Entra en calorías",

      subtitle:
        "Revisá los macros antes de registrarlo.",

      remaining,

      after,

      excess,
    };
  }


  const smallKcalExcess =
    excess.kcal <=
    Math.max(
      50,
      safeTarget.kcal * 0.1
    );


  if (smallKcalExcess) {
    return {
      level: "warning",

      title:
        `Excede ${Math.round(
          excess.kcal
        )} kcal`,

      subtitle:
        "Es un exceso pequeño, pero conviene revisarlo.",

      remaining,

      after,

      excess,
    };
  }


  return {
    level: "over",

    title:
      `Excede ${Math.round(
        excess.kcal
      )} kcal`,

    subtitle:
      "Supera claramente lo disponible en esta comida.",

    remaining,

    after,

    excess,
  };
}


function evaluateFreeFit(
  free = null,
  candidate = null,
  {
    hasAutoPending = false,
    knownCandidate = {},
  } = {}
) {
  if (!free) return null;

  const baseRemainingKcal =
    Math.max(
      0,
      number(
        free.remainingKcal
      )
    );

  /*
   * =========================================
   * AUTO
   * =========================================
   *
   * Todavía no conocemos la cantidad
   * definitiva del alimento Auto.
   *
   * Pero sí podemos saber cuánto margen
   * queda para calcularla.
   */
  if (hasAutoPending) {
    const knownKcal =
      Math.max(
        0,
        number(
          knownCandidate?.kcal
        )
      );

    const remainingKcal =
      Math.max(
        0,
        round(
          baseRemainingKcal -
          knownKcal
        )
      );

    /*
     * Los alimentos FIJOS que acompañan
     * al Auto ya consumieron todo el margen.
     */
    if (remainingKcal <= 10) {
      return {
        ...free,

        remainingKcal,

        fit: {
          level: "over",

          title:
            "Sin margen útil",

          subtitle:
            knownKcal > 0
              ? "Los alimentos fijos ya consumen prácticamente todas tus calorías libres."
              : "No queda margen suficiente para calcular una cantidad Auto.",

          overflowKcal:
            Math.max(
              0,
              round(
                knownKcal -
                baseRemainingKcal
              )
            ),

          auto: true,
        },
      };
    }

    /*
     * Hay margen, pero es pequeño.
     */
    if (remainingKcal < 80) {
      return {
        ...free,

        remainingKcal,

        fit: {
          level: "warning",

          title:
            "Auto limitado",

          subtitle:
            "La cantidad se calculará usando el poco margen de calorías libres disponible.",

          overflowKcal: 0,

          auto: true,
        },
      };
    }

    /*
     * Hay margen razonable.
     */
    return {
      ...free,

      remainingKcal,

      fit: {
        level: "good",

        title:
          "Compatible con Auto",

        subtitle:
          "La cantidad se calculará para intentar entrar en tus calorías libres.",

        overflowKcal: 0,

        auto: true,
      },
    };
  }


  /*
   * =========================================
   * SIN AUTO Y SIN CANTIDAD
   * =========================================
   */

  if (!candidate) {
    return {
      ...free,

      fit: {
        level: "neutral",

        title:
          "Cantidad pendiente",

        subtitle:
          `${Math.round(
            baseRemainingKcal
          )} kcal disponibles`,

        overflowKcal: 0,
      },
    };
  }


  /*
   * =========================================
   * CANTIDAD YA DEFINIDA
   * =========================================
   */

  const candidateKcal =
    Math.max(
      0,
      number(candidate.kcal)
    );

  const overflowKcal =
    Math.max(
      0,
      round(
        candidateKcal -
        baseRemainingKcal
      )
    );

  if (overflowKcal <= 1) {
    return {
      ...free,

      remainingKcal:
        baseRemainingKcal,

      fit: {
        level: "good",

        title:
          "Entra completo",

        subtitle:
          `Quedarían ${Math.max(
            0,
            Math.round(
              baseRemainingKcal -
              candidateKcal
            )
          )} kcal libres`,

        overflowKcal: 0,
      },
    };
  }

  const overflowRatio =
    candidateKcal > 0
      ? overflowKcal /
        candidateKcal
      : 0;

  if (
    overflowKcal <= 75 ||
    overflowRatio <= 0.2
  ) {
    return {
      ...free,

      remainingKcal:
        baseRemainingKcal,

      fit: {
        level: "warning",

        title:
          "Entra parcialmente",

        subtitle:
          `${Math.round(
            overflowKcal
          )} kcal quedarían por absorber`,

        overflowKcal,
      },
    };
  }

  return {
    ...free,

    remainingKcal:
      baseRemainingKcal,

    fit: {
      level: "over",

      title:
        "No entra completo",

      subtitle:
        `${Math.round(
          overflowKcal
        )} kcal quedarían por absorber`,

      overflowKcal,
    },
  };
}




function sortWeight(level = "") {
  if (level === "good") return 0;
  if (level === "warning") return 1;
  if (level === "neutral") return 2;

  return 3;
}

function destinationFitScore({
  candidate = null,
  remaining = {},
  target = {},
  fit = null,
} = {}) {
  if (!candidate || !fit) {
    return 0;
  }

  const metrics = [
    {
      key: "kcal",
      weight: 4,
    },
    {
      key: "proteina",
      weight: 2,
    },
    {
      key: "carbs",
      weight: 2,
    },
    {
      key: "grasas",
      weight: 2,
    },
  ];

  let score = 0;
  let totalWeight = 0;

  metrics.forEach(
    ({ key, weight }) => {
      /*
       * Si esa variable no tiene meta,
       * no la usamos para recomendar.
       */
      if (
        Number(target?.[key]) <= 0
      ) {
        return;
      }

      const available =
        Number(
          remaining?.[key]
        ) || 0;

      const foodAmount =
        Number(
          candidate?.[key]
        ) || 0;

      if (available <= 0) {
        return;
      }

      const ratio =
        foodAmount / available;

      /*
       * Cuanto mejor aprovecha
       * lo disponible sin pasarse,
       * mayor puntaje.
       */
      if (ratio <= 1) {
        score +=
          Math.min(
            1,
            Math.max(0, ratio)
          ) * weight;
      } else {
        /*
         * Penalizamos exceso.
         */
        score -=
          Math.min(
            ratio - 1,
            2
          ) *
          weight *
          2;
      }

      totalWeight += weight;
    }
  );

  if (!totalWeight) {
    return 0;
  }

  return Math.round(
    (score / totalWeight) * 100
  );
}


/*
 * RESULTADO FINAL PARA EL MODAL.
 */
export function buildTrackingDestinationFit({
  destinations = null,
  registration = null,
  trackingMeals = {},
  allocations = [],
  allocationTotalsByDestination = {},
} = {}) {


const registrationState =
  trackingRegistrationState(
    registration
  );

const candidate =
  registrationState.hasAutoPending
    ? null
    : trackingRegistrationTotals(
        registration
      );

const allocatedRequestIds = new Set(
  (Array.isArray(allocations) ? allocations : [])
    .map((group) => String(group?.writeRequestId || ""))
    .filter(Boolean)
);



const meals =
  (
    Array.isArray(
      destinations?.meals
    )
      ? destinations.meals
      : []
  )
    .map((destination) => {
      const executionId =
        menuTargetExecutionId(
          destination.menuMealId
        );

      const consumed =
        addTotals(
          sumItems(
            (trackingMeals?.[executionId] || []).filter((item) => (
              !allocatedRequestIds.has(String(item?.writeRequestId || ""))
            ))
          ),
          allocationTotalsByDestination?.[executionId] || {}
        );

const fit =
  evaluateMealFit({
    target:
      destination.target,

    consumed,

    candidate,

    knownCandidate:
      registrationState
        .knownTotals,

    hasAutoPending:
      registrationState
        .hasAutoPending,
  });

      const fitScore =
        destinationFitScore({
          candidate,

          remaining:
            fit.remaining,

          target:
            destination.target,

          fit,
        });

      return {
        ...destination,

        executionId,

        consumed,

        remaining:
          fit.remaining,

        fit,

        fitScore,
      };
    })
    .sort((left, right) => {
      /*
       * 1. Primero ordenamos por estado:
       * verde → amarillo → neutral → rojo.
       */
      const levelDiff =
        sortWeight(
          left.fit?.level
        ) -
        sortWeight(
          right.fit?.level
        );

      if (levelDiff) {
        return levelDiff;
      }

      /*
       * 2. Si tienen el mismo estado,
       * primero mostramos el destino
       * con mejor encaje nutricional.
       */
      const scoreDiff =
        Number(
          right.fitScore || 0
        ) -
        Number(
          left.fitScore || 0
        );

      if (scoreDiff) {
        return scoreDiff;
      }

      /*
       * 3. Si también empatan en score,
       * priorizamos el que tenga
       * menor exceso calórico.
       */
      return (
        number(
          left.fit?.excess?.kcal
        ) -
        number(
          right.fit?.excess?.kcal
        )
      );
    });

  /*
   * Marcamos una sola recomendación:
   * la primera que realmente encaja.
   */
  let recommendationUsed = false;

  const rankedMeals =
    meals.map((meal) => {
      const recommended =
        !recommendationUsed &&
        meal.fit?.level ===
          "good";

      if (recommended) {
        recommendationUsed = true;
      }

      return {
        ...meal,
        recommended,
      };
    });

  return {
    candidate,



freeCalories:
  evaluateFreeFit(
    destinations?.freeCalories
      ? {
          ...destinations.freeCalories,
          remainingKcal: Math.max(
            0,
            number(destinations.freeCalories.remainingKcal) -
              number(allocationTotalsByDestination?.flexible_margin?.kcal)
          ),
        }
      : null,

    candidate,

    {
      hasAutoPending:
        registrationState
          .hasAutoPending,

      knownCandidate:
        registrationState
          .knownTotals,
    }
  ),




    meals:
      rankedMeals,
  };
}

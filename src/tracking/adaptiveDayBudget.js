const EPSILON = 0.01;

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function positive(value) {
  return Math.max(
    0,
    safeNumber(value)
  );
}

function round(value) {
  return (
    Math.round(
      safeNumber(value) * 10
    ) / 10
  );
}

function normalizeTotals(value = {}) {
  return {
    kcal: positive(
      value?.kcal
    ),

    proteina: positive(
      value?.proteina ??
        value?.protein ??
        value?.p
    ),

    carbs: positive(
      value?.carbs ??
        value?.carbohidratos ??
        value?.c
    ),

    grasas: positive(
      value?.grasas ??
        value?.fat ??
        value?.g
    ),
  };
}


/**
 * Motor de presupuesto adaptable del día.
 *
 * REGLAS:
 *
 * 1. Una comida planned/fixed nunca se modifica.
 *
 * 2. Una comida target ("Por meta") puede
 *    tener una meta efectiva distinta de la
 *    meta original.
 *
 * 3. Si una comida Por meta se pasa:
 *
 *      a) primero absorbe Calorías libres;
 *      b) después reduce próximas comidas
 *         Por meta;
 *      c) nunca reduce comidas planned.
 *
 * 4. La meta original nunca se modifica.
 *
 * 5. Nunca reducimos una comida Por meta
 *    por debajo de lo que ya consumió.
 *
 * 6. Los macros NO se absorben con el pool
 *    de calorías libres. Se mantienen como
 *    realidad nutricional.
 */
export function resolveAdaptiveDayBudget({
  freeCalories = 0,

  freeConsumedCalories = 0,

  meals = [],
} = {}) {

  const resolvedMeals = (
    Array.isArray(meals)
      ? meals
      : []
  ).map(
    (meal, index) => {

      const baseTarget =
        normalizeTotals(
          meal?.baseTarget ||
            meal?.target ||
            {}
        );

      const consumed =
        normalizeTotals(
          meal?.consumed ||
            {}
        );

      const mode =
        meal?.mode === "target"
          ? "target"
          : "planned";

      return {
        ...meal,

        id: String(
          meal?.id ||
            `meal-${index + 1}`
        ),

        order:
          Number.isFinite(
            Number(meal?.order)
          )
            ? Number(meal.order)
            : index,

        mode,

        baseTarget,

        consumed,

        effectiveTarget: {
          ...baseTarget,
        },

        absorbedFromFreeKcal: 0,

        absorbedFromPreviousMealsKcal:
          0,
      };
    }
  );


  /*
   * Respetamos orden cronológico
   * de las comidas.
   */
  resolvedMeals.sort(
    (a, b) =>
      a.order - b.order
  );


  /*
   * Pool libre real.
   *
   * Ej:
   *
   * disponibles = 400
   * ya registradas como libres = 100
   *
   * quedan = 300
   */
  let freeRemainingKcal =
    Math.max(
      0,
      positive(freeCalories) -
        positive(
          freeConsumedCalories
        )
    );


  let freeAbsorbedOverageKcal =
    0;

  let unabsorbedOverflowKcal =
    0;


  /*
   * Recorremos las comidas de
   * principio a fin.
   */
  for (
    let mealIndex = 0;
    mealIndex <
    resolvedMeals.length;
    mealIndex += 1
  ) {

    const meal =
      resolvedMeals[
        mealIndex
      ];


    /*
     * Una comida fija NO genera
     * redistribución automática.
     */
    if (
      meal.mode !== "target"
    ) {
      continue;
    }


    const effectiveKcal =
      positive(
        meal
          .effectiveTarget
          ?.kcal
      );

    const consumedKcal =
      positive(
        meal
          .consumed
          ?.kcal
      );


    /*
     * Ej:
     *
     * meta = 400
     * consumido = 800
     *
     * overflow = 400
     */
    let overflow =
      Math.max(
        0,
        consumedKcal -
          effectiveKcal
      );


    if (
      overflow <= EPSILON
    ) {
      continue;
    }


    /*
     * =================================
     * PASO 1
     * CALORÍAS LIBRES
     * =================================
     */

    const fromFree =
      Math.min(
        overflow,
        freeRemainingKcal
      );


    if (
      fromFree > EPSILON
    ) {

      freeRemainingKcal -=
        fromFree;

      freeAbsorbedOverageKcal +=
        fromFree;

      meal.absorbedFromFreeKcal +=
        fromFree;

      overflow -= fromFree;
    }


    if (
      overflow <= EPSILON
    ) {
      continue;
    }


    /*
     * =================================
     * PASO 2
     * PRÓXIMAS COMIDAS POR META
     * =================================
     *
     * planned NO participa.
     */

    const futureTargetMeals =
      resolvedMeals
        .slice(
          mealIndex + 1
        )
        .filter(
          (candidate) =>
            candidate.mode ===
              "target"
        );


    if (
      !futureTargetMeals.length
    ) {

      unabsorbedOverflowKcal +=
        overflow;

      continue;
    }


    /*
     * Cuánto podemos quitar en total
     * sin bajar una meta por debajo
     * de lo ya consumido.
     */
    const candidates =
      futureTargetMeals
        .map(
          (candidate) => {

            const candidateTarget =
              positive(
                candidate
                  .effectiveTarget
                  ?.kcal
              );

            const candidateConsumed =
              positive(
                candidate
                  .consumed
                  ?.kcal
              );

            const reducible =
              Math.max(
                0,
                candidateTarget -
                  candidateConsumed
              );

            return {
              candidate,
              reducible,
            };
          }
        )
        .filter(
          ({ reducible }) =>
            reducible >
            EPSILON
        );


    const totalReducible =
      candidates.reduce(
        (
          total,
          entry
        ) =>
          total +
          entry.reducible,
        0
      );


    if (
      totalReducible <=
      EPSILON
    ) {

      unabsorbedOverflowKcal +=
        overflow;

      continue;
    }


    const amountToReduce =
      Math.min(
        overflow,
        totalReducible
      );


    /*
     * Distribución proporcional.
     *
     * Si hay:
     *
     * Merienda 700
     * Cena 300
     *
     * y debemos reducir 200,
     * Merienda absorbe más que Cena.
     */
    let distributed = 0;


    candidates.forEach(
      (
        {
          candidate,
          reducible,
        },
        candidateIndex
      ) => {

        const isLast =
          candidateIndex ===
          candidates.length - 1;


        const proportionalReduction =
          isLast
            ? amountToReduce -
              distributed
            : amountToReduce *
              (
                reducible /
                totalReducible
              );


        const reduction =
          Math.min(
            reducible,
            Math.max(
              0,
              proportionalReduction
            )
          );


        const currentTarget =
          positive(
            candidate
              .effectiveTarget
              ?.kcal
          );


        const alreadyConsumed =
          positive(
            candidate
              .consumed
              ?.kcal
          );


        candidate.effectiveTarget.kcal =
          round(
            Math.max(
              alreadyConsumed,
              currentTarget -
                reduction
            )
          );


        candidate.absorbedFromPreviousMealsKcal =
          round(
            candidate
              .absorbedFromPreviousMealsKcal +
              reduction
          );


        distributed +=
          reduction;
      }
    );


    overflow -=
      distributed;


    if (
      overflow > EPSILON
    ) {

      unabsorbedOverflowKcal +=
        overflow;
    }
  }


  /*
   * Resultado final de cada comida.
   */
  const finalMeals =
    resolvedMeals.map(
      (meal) => {

        const targetKcal =
          positive(
            meal
              .effectiveTarget
              ?.kcal
          );

        const consumedKcal =
          positive(
            meal
              .consumed
              ?.kcal
          );


        return {
          ...meal,

          effectiveTarget: {
            ...meal.effectiveTarget,

            kcal:
              round(
                targetKcal
              ),
          },

          remainingKcal:
            round(
              Math.max(
                0,
                targetKcal -
                  consumedKcal
              )
            ),

          overKcal:
            round(
              Math.max(
                0,
                consumedKcal -
                  targetKcal
              )
            ),

          progressPercent:
            targetKcal > 0
              ? round(
                  (
                    consumedKcal /
                    targetKcal
                  ) * 100
                )
              : 0,
        };
      }
    );


  return {

    meals:
      finalMeals,

    freePool: {

      baseKcal:
        round(
          positive(
            freeCalories
          )
        ),

      directConsumedKcal:
        round(
          positive(
            freeConsumedCalories
          )
        ),

      absorbedOverageKcal:
        round(
          freeAbsorbedOverageKcal
        ),

      remainingKcal:
        round(
          freeRemainingKcal
        ),
    },

    unabsorbedOverflowKcal:
      round(
        unabsorbedOverflowKcal
      ),
  };
}


/*
 * Helper cómodo para encontrar
 * el resultado de una comida.
 */
export function adaptiveMealById(
  budget,
  mealId
) {

  const id =
    String(
      mealId || ""
    );

  return (
    budget?.meals || []
  ).find(
    (meal) =>
      String(meal?.id || "") ===
      id
  ) || null;
}
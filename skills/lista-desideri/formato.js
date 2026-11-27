// Come la skill scrive gli importi: un solo modo, per la lista, la scheda e gli avvisi.

/** Centesimi interi → «30,88 €», con lo spazio che non va a capo prima del simbolo. */
export const euro = (centesimi) => (centesimi / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

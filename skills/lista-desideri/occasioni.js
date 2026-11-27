// «Conviene l'ufficiale»: quando il negozio della piattaforma costa poco più della chiave
// migliore, tanto vale comprare lì. Solo funzioni pure. Gli importi sono centesimi interi.

import { euro } from "./formato.js";

/** La soglia scelta dall'utente, in euro (5,99), come centesimi interi. Un valore illeggibile vale zero. */
export function sogliaInCentesimi(euroScelti) {
  const centesimi = Math.round(Number(euroScelti) * 100);
  return Number.isFinite(centesimi) && centesimi > 0 ? centesimi : 0;
}

/** Vero se ci sono entrambi i prezzi e l'ufficiale costa al massimo `soglia` centesimi in più. */
export function conviene(migliore, ufficiale, soglia) {
  // I prezzi arrivano anche dall'archivio: se non sono centesimi interi non si confrontano.
  if (!Number.isSafeInteger(migliore?.centesimi) || !Number.isSafeInteger(ufficiale?.centesimi)) return false;
  return ufficiale.centesimi <= migliore.centesimi + soglia;
}

/**
 * Ciò che il documento ricorda dell'occasione: `null`, oppure da quando conviene e a quale
 * prezzo ufficiale. Finché quel prezzo non cambia l'occasione è la stessa (`precedente`):
 * serve a non avvisare due volte della stessa cosa.
 */
export function occasione(precedente, migliore, ufficiale, soglia, adesso) {
  if (!conviene(migliore, ufficiale, soglia)) return null;
  const stessa = precedente?.ufficialeCentesimi === ufficiale.centesimi && typeof precedente.dal === "string";
  return stessa
    ? { dal: precedente.dal, ufficialeCentesimi: precedente.ufficialeCentesimi }
    : { dal: adesso.toISOString(), ufficialeCentesimi: ufficiale.centesimi };
}

/** «Steam 34,99 €, solo 4,11 € in più». */
export function testoConviene(migliore, ufficiale) {
  const differenza = ufficiale.centesimi - migliore.centesimi;
  const quanto = differenza > 0 ? `solo ${euro(differenza)} in più` : differenza < 0 ? `${euro(-differenza)} in meno` : "allo stesso prezzo";
  return `${ufficiale.negozio} ${euro(ufficiale.centesimi)}, ${quanto}`;
}

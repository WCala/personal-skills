// Aggiornamento dei prezzi della lista. Niente DOM né SDK: riceve da fuori come leggere
// la lista, come scaricare una pagina e come salvare un documento, così si prova con Node.
//
// Si aggiorna per pagina, non per voce: due edizioni dello stesso gioco costano una sola
// richiesta al sito. La lista si rilegge ogni volta che serve, perché tra la richiesta e
// la risposta passano secondi: una voce tolta nel frattempo non deve ricomparire.

import { documentoDesiderio, giocoDaDocumento, leggiProdotto } from "./aks.js";

/**
 * - `voci()`: la lista com'è adesso, `[{ id, data }]`;
 * - `scarica(url, { priorita, utile })`: il testo della pagina, o `undefined` se al suo
 *   turno `utile()` ha detto che non serviva più;
 * - `salva(id, dati)`: scrive il documento di una voce;
 * - `contesto()`: chi compra in questo momento, `{ paese, evitati, soglia }` (vedi aks.js).
 */
export function creaAggiornatore({ voci, scarica, salva, contesto, adesso = () => new Date() }) {
  const lavori = new Map(); // pagina → promessa dell'aggiornamento in corso
  const errori = new Map(); // id della voce → perché l'ultimo aggiornamento non è riuscito
  // Dopo un errore gli aggiornamenti di sfondo si fermano: se il sito non risponde, o ci
  // sta dicendo di rallentare, non si insiste con tutte le altre pagine.
  let fermo = false;

  const diPagina = (pagina) => voci().filter((v) => v.data.pagina === pagina);
  const ancoraInLista = (id) => voci().some((v) => v.id === id);

  /** Salva i prezzi di `prodotto` nelle voci di quella pagina che sono ancora in lista. */
  async function registra(pagina, prodotto) {
    const quando = adesso();
    for (const voce of diPagina(pagina)) {
      try {
        const { dati } = documentoDesiderio(giocoDaDocumento(voce.data), prodotto, voce.data.edizione.id, quando, contesto(), voce.data);
        if (!ancoraInLista(voce.id)) continue;
        await salva(voce.id, dati);
        errori.delete(voce.id);
      } catch (errore) {
        errori.set(voce.id, errore.message);
      }
    }
  }

  /** Aggiorna le voci di una pagina. Con `priorita` è una richiesta dell'utente. */
  function aggiornaPagina(pagina, { priorita = false } = {}) {
    if (lavori.has(pagina)) return lavori.get(pagina);
    const lavoro = (async () => {
      try {
        const utile = () => diPagina(pagina).length > 0 && (priorita || !fermo);
        const html = await scarica(pagina, { priorita, utile });
        if (html !== undefined) await registra(pagina, leggiProdotto(html));
      } catch (errore) {
        // Una pagina che non c'è più riguarda solo quel gioco: le altre voci si aggiornano lo stesso.
        if (!priorita && !errore.soloQuestaPagina) fermo = true;
        for (const voce of diPagina(pagina)) errori.set(voce.id, errore.message);
      } finally {
        lavori.delete(pagina);
      }
    })();
    lavori.set(pagina, lavoro);
    return lavoro;
  }

  return {
    registra,
    aggiornaPagina,
    /** Aggiorna, sullo sfondo, le pagine delle voci date (tutta la lista se non si dice quali). */
    aggiornaTutte(scelte = voci()) {
      fermo = false;
      return Promise.all([...new Set(scelte.map((v) => v.data.pagina))].map((pagina) => aggiornaPagina(pagina)));
    },
    errore: (id) => errori.get(id),
    inCorso: (pagina) => lavori.has(pagina),
    occupato: () => lavori.size > 0,
  };
}

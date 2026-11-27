// Gli avvisi al tocco di «Aggiungi»: che cosa chiedere e che cosa dire prima di mettere in
// lista un gioco la cui chiave migliore ha un problema di regione. Solo funzioni pure: le
// finestre le disegna app.js. Gli aggiornamenti automatici non passano da qui.

import { chiavi, evitato, migliorOfferta } from "./aks.js";
import { euro } from "./formato.js";
import { nelPaese, paeseDelNegozio, statoOfferta } from "./regioni.js";

/**
 * Che cosa serve prima di aggiungere l'edizione alla lista.
 * - `conferma`: `null`, oppure la domanda da fare. `tipo` "nessuna-chiave" (aggiungere lo
 *   stesso?) o "da-verificare" (evitare `negozio`?), con il `testo`.
 * - `nota`: `null`, oppure l'informazione da dare dopo l'aggiunta, senza chiedere nulla.
 * Dopo «Evita» si chiama di nuovo, con il sito tra gli evitati: può chiedere del successivo.
 */
export function controlloAggiunta(prodotto, edizione, contesto) {
  const { paese, evitati } = contesto;
  const migliore = migliorOfferta(prodotto, edizione, contesto);
  if (!migliore) {
    const testo = `Nessuna chiave di questa edizione si attiva ${nelPaese(paese)}. Vuoi aggiungerlo lo stesso? Lo seguirò finché ne compare una.`;
    return { conferma: { tipo: "nessuna-chiave", testo }, nota: null };
  }

  let conferma = null;
  if (statoOfferta(migliore, paese) === "da-verificare") {
    const venduto = migliore.regione ? `come «${migliore.regione}»` : "senza indicare la regione";
    const poi = migliorOfferta(prodotto, edizione, { ...contesto, evitati: [...evitati, migliore.negozio] });
    const seEvitato = poi
      ? `il prezzo migliore sarà ${euro(poi.centesimi)} (${poi.negozio})`
      : `non resta nessuna chiave che si attiva ${nelPaese(paese)}`;
    conferma = {
      tipo: "da-verificare",
      negozio: migliore.negozio,
      testo: `Il prodotto è venduto su ${migliore.negozio} ${venduto}: non so se si attiva ${nelPaese(paese)}. Vuoi evitare questo sito? Se lo eviti, ${seEvitato}.`,
    };
  }

  // La più economica tra le chiavi dei siti non evitati: se nel paese non si attiva, lo si dice.
  const economica = chiavi(prodotto, edizione).find((o) => !evitato(o, evitati));
  let nota = null;
  if (economica && statoOfferta(economica, paese) === "no") {
    // Se a escluderla è il negozio (PS Store ES) si nomina quello, altrimenti la regione.
    const dove = economica.ufficiale && paeseDelNegozio(economica.negozio) ? `su ${economica.negozio}` : `in ${economica.regione}`;
    const scelta = [migliore.negozio, migliore.regione].filter(Boolean).join(", ");
    nota = `La più economica non è attivabile nel tuo paese (${euro(economica.centesimi)} ${dove}): in lista uso ${euro(migliore.centesimi)} (${scelta}).`;
  }
  return { conferma, nota };
}

/**
 * Il percorso di «Aggiungi», dalla prima domanda alla decisione. Riceve da fuori come
 * interagire: `contesto()` (chi compra, in quel momento), `chiedi(conferma)` (la risposta
 * dell'utente: "aggiungi", "tieni", "evita", oppure `null` per annullare) ed `evita(negozio)`
 * (mette il sito tra gli evitati). Dopo «Evita» il controllo riparte e può chiedere del sito
 * successivo. Restituisce `{ aggiungere, nota }`: la nota vale per il prezzo che va in lista.
 */
export async function percorsoAggiunta(prodotto, edizione, { contesto, chiedi, evita }) {
  let appenaEvitato = null;
  for (;;) {
    const { conferma, nota } = controlloAggiunta(prodotto, edizione, contesto());
    if (!conferma) return { aggiungere: true, nota };
    // Lo stesso sito di nuovo migliore subito dopo «Evita»: non è stato evitato davvero.
    if (conferma.negozio && conferma.negozio === appenaEvitato) throw new Error(`Non sono riuscito a evitare ${conferma.negozio}.`);
    const scelta = await chiedi(conferma);
    if (!scelta) return { aggiungere: false, nota: null };
    if (scelta !== "evita") return { aggiungere: true, nota };
    await evita(conferma.negozio);
    appenaEvitato = conferma.negozio;
  }
}

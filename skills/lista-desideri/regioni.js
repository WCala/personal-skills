// Dove si attiva una chiave: la tabella delle regioni di Allkeyshop e ciò che se ne ricava
// per il paese dell'utente. Solo funzioni pure, senza DOM né SDK.
//
// Le regioni sono i nomi che il sito mostra accanto a ogni offerta (`filter_name`). Il sito
// spiega ciascuna con una frase («for EUROPE Only», «Region Free / Worldwide») ma non elenca
// mai i paesi: quali paesi siano «Europa» lo decide questa tabella.
// Regola di fondo: una regione che non è in tabella non è mai data per attivabile.

/** I 27 paesi dell'Unione europea: gli unici per cui «Europa» è certa. */
const UE = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" ");
/** Gli altri paesi europei: per loro «Europa» resta da verificare. */
const EUROPA_ALTRI = "AD AL BA BY CH FO GB GG GI IM IS JE LI MC MD ME MK NO RS SM TR UA VA XK".split(" ");

const TUTTI = { si: "tutti" };
const EUROPA = { si: UE, incerti: EUROPA_ALTRI };
// «Europe, Middle East and Africa and several other countries»: fuori dall'Unione non lo sappiamo.
const EMEA = { si: UE, incerti: "resto" };
const solo = (paese) => ({ si: [paese] });

// `si`: i paesi in cui si attiva di certo. `incerti`: quelli per cui non si sa («resto» = ogni
// altro paese). Un paese che non è né in `si` né in `incerti`: non si attiva.
const REGIONI = new Map(Object.entries({
  "STEAM GLOBAL": TUTTI, "STEAM GIFT GLOBAL": TUTTI, "EA GLOBAL": TUTTI, "EPIC GLOBAL": TUTTI, "GOG GLOBAL": TUTTI,
  "WINDOWS GLOBAL": TUTTI, "XBOX X|S GLOBAL": TUTTI,
  "STEAM EU": EUROPA, "STEAM GIFT EU": EUROPA, "EA EUROPE": EUROPA, "GOG EUROPE": EUROPA, "EUROPE": EUROPA,
  "WINDOWS EU": EUROPA, "XBOX EUROPE CODE": EUROPA, "XBOX X|S EUROPE": EUROPA, "XBOX/PC EUROPE": EUROPA,
  "STEAM EMEA": EMEA, "GOG EMEA (EUROPE MIDDLE EAST ASIA)": EMEA,
  "USA": solo("US"), "PSN WALLET US": solo("US"), "XBOX X|S UK": solo("GB"), "AUSTRIA CODE": solo("AT"),
}));
// Restano fuori apposta, quindi «da verificare»: le regioni ROW («Rest Of the World», senza
// elenco dei paesi), quelle in una sola lingua («IN ENGLISH ONLY»), `XBOX CODE`, `XBOX/PC`,
// `GLOBAL` di Nintendo e `PS5`, che il sito non lega a nessun paese.

const norma = (nome) => String(nome ?? "").trim().replace(/\s+/g, " ").toUpperCase();

const nomi = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["it"], { type: "region" }) : null;

/** Il nome del paese in italiano; un codice che non esiste resta com'è. */
export function nomePaese(codice) {
  try {
    return nomi?.of(codice) ?? codice;
  } catch {
    return codice;
  }
}

/**
 * Il paese di un negozio della piattaforma che lo porta in fondo al nome («PS Store IT»),
 * o `null`. Vale solo per i negozi della piattaforma: un rivenditore con un paese nel nome
 * («Gamesplanet UK») vende chiavi la cui regione è scritta nell'offerta.
 */
export function paeseDelNegozio(nome) {
  // Spazi in più non devono nascondere la sigla: «PS Store  ES» è sempre il negozio spagnolo.
  const sigla = /\S ([A-Z]{2})$/.exec(String(nome ?? "").trim().replace(/\s+/g, " "))?.[1];
  if (!sigla || sigla === "EU") return null;
  const paese = sigla === "UK" ? "GB" : sigla;
  // Due maiuscole che non sono un paese («Xbox PC») non lo diventano.
  return nomePaese(paese) === paese ? null : paese;
}

/**
 * Se una chiave si attiva nel paese: "si", "no" o "da-verificare".
 * Per il negozio della piattaforma legato a un paese decide il negozio: su PS Store ES
 * compra solo chi ha l'account spagnolo, qualunque regione scriva il sito.
 */
export function statoOfferta(offerta, paese) {
  const delNegozio = offerta.ufficiale ? paeseDelNegozio(offerta.negozio) : null;
  if (delNegozio) return delNegozio === paese ? "si" : "no";
  const regione = REGIONI.get(norma(offerta.regione));
  if (!regione) return "da-verificare";
  if (regione.si === "tutti" || regione.si.includes(paese)) return "si";
  return regione.incerti === "resto" || regione.incerti?.includes(paese) ? "da-verificare" : "no";
}

// ---- Il paese nelle frasi ------------------------------------------------------

// «in Italia», ma non «in Stati Uniti»: i paesi che vogliono un'altra preposizione.
const PREPOSIZIONE = { US: "negli", GB: "nel", NL: "nei", AE: "negli", PH: "nelle", MV: "alle", BS: "alle", SC: "alle" };

/** «in Italia», «negli Stati Uniti»: il paese come complemento di luogo. */
export function nelPaese(codice) {
  const nome = nomePaese(codice);
  if (Object.hasOwn(PREPOSIZIONE, codice)) return `${PREPOSIZIONE[codice]} ${nome}`;
  if (nome.startsWith("Isole ")) return `nelle ${nome}`;
  if (nome.startsWith("Isola ")) return `nell'${nome}`;
  return `in ${nome}`;
}

export const STATI = ["si", "no", "da-verificare"];

/**
 * L'etichetta accanto a un prezzo. `offerta` dà regione e negozio per il caso «non chiara».
 * Uno stato che non è tra i tre (un documento scritto male) vale come «da verificare».
 */
export function etichettaStato(stato, offerta, paese) {
  if (stato === "si") return `Si attiva ${nelPaese(paese)}`;
  if (stato === "no") return `Non si attiva ${nelPaese(paese)}`;
  return offerta.regione ? `Regione non chiara: «${offerta.regione}» su ${offerta.negozio}` : `Regione non indicata su ${offerta.negozio}`;
}

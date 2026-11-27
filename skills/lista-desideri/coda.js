// Coda delle richieste verso il sito: una alla volta e mai due a meno di
// `intervallo` millisecondi (il sito chiede 5 secondi tra una richiesta e l'altra).

const pausa = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

export function creaCoda({ intervallo = 5000, adesso = () => performance.now(), attendi = pausa } = {}) {
  const inAttesa = [];
  let attiva = false;
  // Si parte dal momento dell'apertura: riaprendo la skill non si sa quando è partita
  // l'ultima richiesta della volta prima, quindi la prima aspetta un intervallo intero.
  let ultimaPartenza = adesso();

  /** Toglie dalla testa della coda le richieste che non servono più: non consumano il turno. */
  function scartaInutili() {
    while (inAttesa.length && inAttesa[0].utile && !inAttesa[0].utile()) inAttesa.shift().riuscita(undefined);
  }

  async function avanza() {
    if (attiva) return;
    attiva = true;
    try {
      for (scartaInutili(); inAttesa.length; scartaInutili()) {
        const manca = ultimaPartenza + intervallo - adesso();
        if (manca > 0) {
          await attendi(manca);
          // Dopo l'attesa si sceglie di nuovo: una richiesta dell'utente arrivata nel
          // frattempo passa davanti, una diventata inutile viene scartata.
          continue;
        }
        const { lavoro, riuscita, fallita } = inAttesa.shift();
        ultimaPartenza = adesso();
        try {
          riuscita(await lavoro());
        } catch (errore) {
          fallita(errore);
        }
      }
    } finally {
      attiva = false;
    }
  }

  return {
    /**
     * Esegue `lavoro` quando è il suo turno. Con `priorita` passa davanti a chi aspetta
     * (tra due richieste con priorità, prima l'ultima arrivata). Se al suo turno `utile()`
     * dice di no, il lavoro non parte e la promessa si risolve con `undefined`.
     */
    accoda(lavoro, { priorita = false, utile = null } = {}) {
      return new Promise((riuscita, fallita) => {
        const voce = { lavoro, riuscita, fallita, utile };
        if (priorita) inAttesa.unshift(voce);
        else inAttesa.push(voce);
        avanza();
      });
    },
  };
}

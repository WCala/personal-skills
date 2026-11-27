(async function () {
  const elenco = document.getElementById("elenco");
  const stato = document.getElementById("stato");
  const form = document.getElementById("nuova");
  const campo = document.getElementById("testo");

  await personal.ready();
  const note = personal.storage.collection("note");

  async function disegna() {
    const docs = await note.list();
    docs.reverse(); // gli id sono ordinati nel tempo: le più recenti in cima
    elenco.replaceChildren(
      ...docs.map(({ id, data }) => {
        const li = document.createElement("li");
        li.className = data.fatta ? "fatta" : "";

        const spunta = document.createElement("input");
        spunta.type = "checkbox";
        spunta.checked = !!data.fatta;
        spunta.setAttribute("aria-label", "Segna come fatta");
        spunta.addEventListener("change", () => note.put(id, { ...data, fatta: spunta.checked }));

        const testo = document.createElement("span");
        testo.textContent = data.testo;

        const elimina = document.createElement("button");
        elimina.type = "button";
        elimina.textContent = "Elimina";
        elimina.addEventListener("click", () => note.delete(id));

        li.append(spunta, testo, elimina);
        return li;
      })
    );
    const aperte = docs.filter((d) => !d.data.fatta).length;
    stato.textContent = docs.length
      ? `${aperte} da fare su ${docs.length}`
      : "Ancora nessuna nota. Scrivi la prima qui sopra.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const testo = campo.value.trim();
    if (!testo) return;
    campo.value = "";
    try {
      await note.add({ testo, fatta: false });
    } catch (e) {
      stato.textContent = "Nota non salvata: " + e.message;
    }
  });

  // Ridisegna a ogni cambiamento, anche quando arriva da un altro dispositivo.
  note.onChange(disegna);
  disegna();
})();

// «Torna in cima»: un solo pulsante per tutte le pagine.
//
// Compare quando la pagina ha scorso abbastanza da aver perso il titolo di vista.
// Due contenitori possibili, e vanno guardati entrambi:
//  - `.risultati`, quando l'app fa scorrere solo la colonna dei risultati (home compresa);
//  - la finestra, sulle pagine lunghe e sugli schermi bassi, dove scorre il documento.
// Il pulsante sta nel markup di ogni pagina (`#inCima`, nascosto con l'attributo `hidden`).

const bottone = document.getElementById('inCima');

if (bottone) {
  const colonna = document.querySelector('.risultati');
  const SOGLIA = 260;

  const quanto = () => Math.max(colonna ? colonna.scrollTop : 0, window.scrollY || 0);
  const aggiorna = () => {
    bottone.hidden = quanto() < SOGLIA;
  };

  for (const elemento of [colonna, window]) {
    if (elemento) elemento.addEventListener('scroll', aggiorna, { passive: true });
  }

  bottone.addEventListener('click', () => {
    const lento = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const modo = lento ? 'smooth' : 'auto';
    if (colonna) colonna.scrollTo({ top: 0, behavior: modo });
    window.scrollTo({ top: 0, behavior: modo });
    // chi usa la tastiera torna dove si scrive, non solo in cima a un elenco
    const campo = document.getElementById('domanda');
    if (campo) campo.focus({ preventScroll: true });
  });

  aggiorna();
}

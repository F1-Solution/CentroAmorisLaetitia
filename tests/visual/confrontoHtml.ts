/**
 * La regola di DR-202 per confrontare due pagine del sito: stato e HTML che il
 * visitatore riceve, `<head>` compreso, senza il payload RSC di Next.js, che cambia
 * ordine a ogni lettura anche senza salvataggi.
 */

const PAYLOAD_RSC = /<script>self\.__next_f\.push\([\s\S]*?\)<\/script>/g;

/** L'HTML senza il payload RSC. */
export function senzaPayloadRsc(html: string): string {
  return html.replace(PAYLOAD_RSC, '');
}

/** La forma confrontabile di una risposta: stato, a capo, HTML senza payload RSC. */
export function formaConfrontabile(stato: number, html: string): string {
  return `${stato}\n${senzaPayloadRsc(html)}`;
}

/** Descrive la prima differenza fra due forme, o `null` se coincidono. */
export function primaDifferenza(a: string, b: string): string | null {
  if (a === b) return null;
  let posizione = 0;
  while (posizione < a.length && posizione < b.length && a[posizione] === b[posizione]) {
    posizione += 1;
  }
  const inizio = Math.max(0, posizione - 60);
  const estratto = (testo: string) => JSON.stringify(testo.slice(inizio, posizione + 120));
  return `differiscono al carattere ${posizione} (lunghezze ${a.length} e ${b.length}): ${estratto(a)} contro ${estratto(b)}`;
}

# 1D-W9b — Trascinamento a due esiti nel menu e nei blocchi: piano di attuazione

> **Per chi esegue:** sotto-skill obbligatoria `superpowers:executing-plans` (o
> `superpowers:subagent-driven-development`). I passi usano caselle `- [ ]`.
> Protocollo `PROGRESS.md` obbligatorio: una riga per sotto-wave.

**Obiettivo:** una voce di menu e un blocco si spostano trascinandoli, e prima
del rilascio si vede se finiranno **dentro** l'elemento di arrivo o **accanto**
(DR-082, DR-084, DR-085).

**Architettura:** tre funzioni pure — la fascia di rilascio sotto il puntatore,
lo spostamento di una voce di menu, lo spostamento di un blocco — provate da
sole. I componenti di `packages/ui` restano senza dipendenze e ricevono due
involucri dall'esterno, come già fa l'albero dei blocchi; `apps/admin` monta
`@dnd-kit/core` e disegna l'indicatore. I bottoni esistenti restano.

**Tecnologie:** React, TypeScript strict, `@dnd-kit/core` (già dipendenza),
Vitest, React Testing Library, Playwright.

**Riferimenti:** DR-069, DR-082, DR-083, DR-084, DR-085, DR-093;
`design-system.md` §9.3; ADR-006 §3.2; `BLOCK-MODEL.md` §3.15.

**Nome della wave.** DR-082 riapre il menu rilasciato dalla `1D-W9`, chiusa il
2026-09-22: si chiama quindi `1D-W9b`, e per DR-083 e DR-093 si esegue **dopo**
la `1D-W11` e **prima** dell'audit `1D-W12`. `PLAN.md` §1 va corretto con una
riga, al passo finale.

## Vincoli globali

- Nessuna dipendenza nuova: `@dnd-kit/core` c'è già. `@dnd-kit/sortable` resta
  solo se ancora usato; altrimenti si toglie.
- `packages/ui` non importa `@dnd-kit` (`PLAN.md` §5).
- **Tastiera obbligatoria** (`design-system.md` §9.3): i bottoni «Sposta su»,
  «Sposta giù», «Indenta», «Sporgi» restano; in più il trascinamento da tastiera
  sceglie dentro o accanto con le frecce destra e sinistra.
- Un rilascio non ammesso **si vede durante il movimento**, non dopo (nota a
  DR-085), e l'elemento resta dov'era.
- Solo dati sintetici nelle prove. Testi dell'interfaccia in italiano.
- Nessun commit senza conferma dell'utente.

## Punti di attenzione per la revisione

1. **Lasciare una voce dentro un proprio discendente**: creerebbe un ciclo e la
   farebbe sparire. Deve essere rifiutato. Prove: Task 2 e Task 3.
2. **«Dentro» un blocco che non accetta figli** (testo, immagine…): la fascia
   centrale non deve offrire «dentro», e un rilascio lì vale come «accanto».
   Prova: Task 1, terzo caso; Task 3.
3. **«Accanto» in un contenitore che non ammette quel tipo** (una colonna
   accanto a un testo alla radice, `BLOCK-MODEL.md` §1 regola 5): rifiutato.
   Prova: Task 3.
4. **Clic su un bottone della riga** che diventa un trascinamento di un pixel:
   la soglia di 8 pixel resta. Prova: Task 4, passo 1.
5. **Trascinamento da tastiera**: frecce su e giù cambiano destinazione, destra e
   sinistra scelgono dentro o accanto, e l'esito è annunciato a parole.
   Prova: Task 4 e Task 6.

---

## Decisione aperta prima di eseguire

### D27. Fin dove si sposta un blocco (bloccante per il Task 3 e il Task 5)

**Fatto:** oggi un blocco si sposta solo fra fratelli dello stesso contenitore
(`apps/admin/src/lib/editor/tree.ts`, `moveBlockOnto`), perché ADR-006 §3.2
mette in Fase 1 «aggiungere, spostare, eliminare blocchi **dentro una
colonna**». Ma «dentro» di DR-085 porta per forza un blocco in un altro
contenitore.

- **A** — dentro e accanto ovunque `BLOCK-MODEL.md` §3.15 lo ammetta, anche fra
  contenitori diversi; la riga di ADR-006 §3.2 si riformula di conseguenza.
- **B** — solo dentro il contenitore di partenza e dentro i contenitori fratelli
  (per esempio un testo che entra nella colonna accanto); niente salti di
  livello oltre uno.
- **Raccomandazione:** A. È l'unica in cui il gesto fa davvero quello che la
  decisione descrive, e la regola dei tipi ammessi impedisce già le strutture
  non valide.

---

## Sotto-wave `1D-W9b1` — le tre funzioni pure

### Task 1: la fascia di rilascio sotto il puntatore

**File:**
- Crea: `packages/ui/src/editor/dropZone.ts`; esporta da `packages/ui/src/index.ts`
- Prova: `packages/ui/tests/drop-zone.test.ts`

**Interfacce:**
- Produce: `type DropZone = 'before' | 'inside' | 'after'`
- Produce: `dropZoneFor(offsetY: number, height: number, canNest: boolean): DropZone`

- [ ] **Passo 1: prove che devono fallire**

```ts
import { describe, expect, it } from 'vitest';
import { dropZoneFor } from '../src/editor/dropZone';

describe('dropZoneFor (DR-084)', () => {
  it('divide la riga in tre fasce quando l’elemento accetta figli', () => {
    expect(dropZoneFor(5, 40, true)).toBe('before');
    expect(dropZoneFor(20, 40, true)).toBe('inside');
    expect(dropZoneFor(35, 40, true)).toBe('after');
  });

  it('i confini stanno a un quarto e a tre quarti', () => {
    expect(dropZoneFor(9.9, 40, true)).toBe('before');
    expect(dropZoneFor(10, 40, true)).toBe('inside');
    expect(dropZoneFor(29.9, 40, true)).toBe('inside');
    expect(dropZoneFor(30, 40, true)).toBe('after');
  });

  it('senza figli ammessi la riga ha due sole metà, e mai «dentro»', () => {
    expect(dropZoneFor(19.9, 40, false)).toBe('before');
    expect(dropZoneFor(20, 40, false)).toBe('after');
  });

  it('fuori dalla riga resta nella fascia più vicina', () => {
    expect(dropZoneFor(-3, 40, true)).toBe('before');
    expect(dropZoneFor(55, 40, true)).toBe('after');
  });
});
```

- [ ] **Passo 2:** `cd packages/ui && npx vitest run tests/drop-zone.test.ts` → FAIL, modulo assente.
- [ ] **Passo 3: implementazione**

```ts
// packages/ui/src/editor/dropZone.ts
/** Dove finisce l'elemento trascinato rispetto a quello di arrivo (DR-082, DR-084). */
export type DropZone = 'before' | 'inside' | 'after';

/**
 * Fasce della riga di arrivo: sopra e sotto per «accanto», il centro per
 * «dentro» (DR-084). Se l'elemento non accetta figli, la riga ha due metà.
 */
export function dropZoneFor(offsetY: number, height: number, canNest: boolean): DropZone {
  const ratio = height > 0 ? offsetY / height : 0;
  if (!canNest) return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.25) return 'before';
  if (ratio < 0.75) return 'inside';
  return 'after';
}
```

- [ ] **Passo 4:** la prova passa.

### Task 2: spostare una voce di menu in un punto qualunque dell'albero

**File:**
- Modifica: `apps/admin/src/lib/menu/tree.ts` (aggiunge `moveItemTo`)
- Prova: `apps/admin/tests/menu-tree.test.ts`

**Interfacce:**
- Consuma: `DropZone` del Task 1.
- Produce: `moveItemTo(nodes, activeId: string, targetId: string, zone: DropZone): MenuNode<T>[] | null` — `null` se il rilascio non è ammesso.

- [ ] **Passo 1: prove che devono fallire**, accanto alle esistenti, con un
  albero sintetico proprio (radici `a`, `b`, `c`; `b1` figlio di `b`) costruito
  con l'aiuto `voce` già presente nel file; `moveItemTo` si aggiunge all'import:

```ts
/** Tre radici, e b con un figlio. */
const items: Voce[] = [voce('a', null, 0), voce('b', null, 1), voce('b1', 'b', 0), voce('c', null, 2)];
const tree = buildTree(items);

describe('moveItemTo (DR-082)', () => {
  it('«dentro» annida la voce in coda ai figli della voce di arrivo', () => {
    const next = moveItemTo(tree, 'a', 'b', 'inside')!;
    expect(flatten(next)).toEqual([
      { id: 'b', parentId: null, position: 0 },
      { id: 'b1', parentId: 'b', position: 0 },
      { id: 'a', parentId: 'b', position: 1 },
      { id: 'c', parentId: null, position: 1 },
    ]);
  });

  it('«prima» e «dopo» la collocano accanto, allo stesso livello dell’arrivo', () => {
    expect(flatten(moveItemTo(tree, 'c', 'b1', 'before')!)).toContainEqual({
      id: 'c',
      parentId: 'b',
      position: 0,
    });
    expect(flatten(moveItemTo(tree, 'a', 'c', 'after')!).at(-1)).toEqual({
      id: 'a',
      parentId: null,
      position: 2,
    });
  });

  it('rifiuta di lasciare una voce dentro sé stessa o un proprio discendente', () => {
    expect(moveItemTo(tree, 'b', 'b1', 'inside')).toBeNull();
    expect(moveItemTo(tree, 'b', 'b1', 'after')).toBeNull();
    expect(moveItemTo(tree, 'b', 'b', 'inside')).toBeNull();
  });

  it('lasciarla dove già si trova non cambia nulla', () => {
    expect(patchesFor(items, moveItemTo(tree, 'b', 'c', 'before')!)).toEqual([]);
  });
});
```

- [ ] **Passo 2:** `cd apps/admin && npx vitest run tests/menu-tree.test.ts` → FAIL.
- [ ] **Passo 3: implementazione**, in `tree.ts`, dopo `outdent`:

```ts
function contains<T extends FlatMenuItem>(node: MenuNode<T>, id: string): boolean {
  return node.item.id === id || node.children.some((child) => contains(child, id));
}

/**
 * Trascinamento (DR-082): porta la voce dentro quella di arrivo, in coda ai suoi
 * figli, oppure accanto, prima o dopo. `null` se il rilascio non è ammesso.
 */
export function moveItemTo<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  activeId: string,
  targetId: string,
  zone: DropZone,
): MenuNode<T>[] | null {
  const path = pathTo(nodes, activeId);
  const moving = path?.at(-1);
  if (!moving || contains(moving, targetId)) return null;

  const without = removeFrom(nodes, activeId);
  if (zone === 'inside') {
    const target = pathTo(without, targetId)?.at(-1);
    if (!target) return null;
    return replaceChildren(without, targetId, [...target.children, moving]);
  }
  const where = placementOf(without, targetId);
  if (!where) return null;
  const siblings = [...where.siblings];
  siblings.splice(zone === 'before' ? where.index : where.index + 1, 0, moving);
  return replaceChildren(without, where.parentId, siblings);
}
```

  con `import type { DropZone } from '@amoris/ui';` in testa.
- [ ] **Passo 4:** le prove passano.

### Task 3: spostare un blocco dentro o accanto (dipende da D27)

**File:**
- Modifica: `apps/admin/src/lib/editor/tree.ts` (aggiunge `moveBlockTo`; `moveBlockOnto` si toglie quando nessuno la usa più)
- Prova: `apps/admin/tests/tree.test.ts`

**Interfacce:**
- Produce: `moveBlockTo(doc: BlockDocument, activeId: string, targetId: string, zone: DropZone): DropOutcome`
- Produce: `canDropBlock(doc, activeId, targetId, zone): string | null` — il motivo del rifiuto, o `null` se ammesso; serve all'indicatore durante il movimento.

- [ ] **Passo 1: prove che devono fallire**, su un documento sintetico con una
  sezione → riga → due colonne, un testo in ciascuna colonna e un testo alla radice:
  1. un testo lasciato **dentro** l'altra colonna finisce in coda a quella colonna;
  2. un testo lasciato **accanto** a un testo dell'altra colonna finisce in quella colonna, prima o dopo;
  3. **dentro** un testo è rifiutato con un motivo leggibile;
  4. una colonna lasciata **accanto** al testo della radice è rifiutata (la radice non ammette colonne);
  5. una riga lasciata **dentro** una propria colonna è rifiutata;
  6. con D27 = B soltanto: un testo verso una colonna di un'altra sezione è rifiutato.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3: implementazione**

```ts
/** Il motivo per cui il rilascio non è ammesso, o `null` (DR-085, `BLOCK-MODEL.md` §3.15). */
export function canDropBlock(
  doc: BlockDocument,
  activeId: string,
  targetId: string,
  zone: DropZone,
): string | null {
  const active = findBlock(doc.blocks, activeId);
  const target = findBlock(doc.blocks, targetId);
  if (!active || !target) return 'Il blocco non fa parte di questo documento.';
  if (findBlock([active], targetId)) return 'Un blocco non può entrare in sé stesso.';
  const parentId = zone === 'inside' ? targetId : parentIdOf(doc.blocks, targetId);
  if (parentId === undefined) return 'La destinazione non esiste più.';
  if (!allowedChildTypes(doc, parentId).includes(active.type)) {
    return 'Questo tipo di blocco non può stare lì.';
  }
  return null;
}

export function moveBlockTo(
  doc: BlockDocument,
  activeId: string,
  targetId: string,
  zone: DropZone,
): DropOutcome {
  if (activeId === targetId) return { ok: true, document: doc };
  const reason = canDropBlock(doc, activeId, targetId, zone);
  if (reason) return { ok: false, reason: `${reason} Il blocco è rimasto dov’era.` };

  const active = findBlock(doc.blocks, activeId)!;
  const without = removeBlock(doc, activeId);
  if (zone === 'inside') {
    const target = findBlock(without.blocks, targetId)!;
    return { ok: true, document: replaceBlock(without, { ...target, children: [...target.children, active] }) };
  }
  const parentId = parentIdOf(without.blocks, targetId)!;
  const index = siblingsOf(without, parentId).findIndex((block) => block.id === targetId);
  return {
    ok: true,
    document: replaceSiblings(without, parentId, (children) => {
      const next = [...children];
      next.splice(zone === 'before' ? index : index + 1, 0, active);
      return next;
    }),
  };
}
```

  Con D27 = B, `canDropBlock` aggiunge il controllo che il nuovo genitore sia il
  genitore attuale o un suo fratello.
- [ ] **Passo 4:** le prove passano; `pnpm --filter @amoris/admin typecheck` pulito.
- [ ] **Riga in `PROGRESS.md`:** `PHASE:1D WAVE:1D-W9b1 STATUS:complete TS:<ora UTC>`

---

## Sotto-wave `1D-W9b2` — trascinamento nel menu

### Task 4: involucri del menu e indicatore

**File:**
- Modifica: `packages/ui/src/editor/MenuTreeEditor.tsx` (props `renderList`, `renderRow`, come `BlockTreeEditor`)
- Crea: `apps/admin/src/components/dnd/TreeDragArea.tsx`, `TreeDragArea.css`
- Modifica: `apps/admin/src/components/menu/MenuManager.tsx`
- Prova: `packages/ui/tests/menu-tree-editor.test.tsx`, `apps/admin/tests/menu-manager.test.tsx`

**Interfacce:**
- Produce: `TreeDragArea` — `{ canNest(id): boolean; canDrop(activeId, targetId, zone): string | null; onDrop(activeId, targetId, zone): void; describe(id): string; children }`; contesto con `{ overId, zone, refusal }` letto dalle righe.
- Produce: `DraggableTreeRow({ id, children })` — maniglia, `useDraggable` + `useDroppable` sullo stesso nodo, classi `amoris-tree-drop--before|inside|after` e `--refused`.

- [ ] **Passo 1: prove che devono fallire**
  - `MenuTreeEditor` con `renderRow` avvolge ogni riga, e senza resta come oggi (i bottoni ci sono in entrambi i casi);
  - in `MenuManager`, con il contesto simulato su una riga e `zone = 'inside'`, la riga porta la classe `amoris-tree-drop--inside` e l'area di annuncio dice «dentro "<etichetta>"»; con un rifiuto porta `--refused` e dice il motivo;
  - un clic sul bottone «Elimina» della riga apre ancora la conferma (soglia di 8 pixel).
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3: implementazione.** In `TreeDragArea`:
  - `PointerSensor` con `activationConstraint: { distance: 8 }`; `KeyboardSensor`
    con un `coordinateGetter` che con su e giù porta al centro della riga
    precedente o successiva (`context.droppableRects`), e con destra e sinistra
    non si muove;
  - `onDragMove`: `pointerY = activatorEvent.clientY + delta.y`; con `over.rect`
    calcola `dropZoneFor(pointerY - over.rect.top, over.rect.height, canNest(over.id))`;
    da tastiera la fascia parte da `after`, la freccia destra la porta a
    `inside` se ammesso, la sinistra la riporta ad `after`;
  - `refusal = canDrop(active, over, zone)` a ogni movimento; `onDragEnd` chiama
    `onDrop` solo se `refusal === null`;
  - `accessibility.announcements` in italiano: «"<voce>" andrà dentro "<arrivo>"»,
    «… accanto a …», «… non può andare qui: <motivo>», «spostamento annullato».

  CSS (token di `packages/ui`): l'indicatore è una linea di 2 px sopra o sotto la
  riga per «accanto», e **rientra a destra** di un livello per «dentro», con la
  riga di arrivo evidenziata (DR-084); `--refused` usa il colore d'errore e il
  cursore «non ammesso».

  In `MenuManager`: `canNest = () => true`, `canDrop = (a, t, z) => moveItemTo(tree, a, t, z) ? null : 'Una voce non può entrare in sé stessa o in una sua sottovoce.'`,
  `onDrop = (a, t, z) => { const next = moveItemTo(tree, a, t, z); if (next) void restructure(next); }`.
- [ ] **Passo 4:** prove verdi.
- [ ] **Riga in `PROGRESS.md`:** `PHASE:1D WAVE:1D-W9b2 STATUS:complete TS:<ora UTC>`

---

## Sotto-wave `1D-W9b3` — trascinamento dei blocchi (dopo D27)

### Task 5: i blocchi usano lo stesso involucro

**File:**
- Modifica: `apps/admin/src/components/editor/ContentEditor.tsx` (usa `TreeDragArea` e `DraggableTreeRow`)
- Elimina: `apps/admin/src/components/editor/BlockTreeDnd.tsx`, `BlockTreeDnd.css` (sostituiti)
- Modifica: `apps/admin/package.json` (toglie `@dnd-kit/sortable` se non resta alcun uso)
- Prova: `apps/admin/tests/content-editor.test.tsx`

- [ ] **Passo 1: prove che devono fallire:** con il contesto su un testo e
  `zone = 'inside'` la riga è `--refused` e l'annuncio dà il motivo; su una
  colonna `--inside` è ammesso; il rilascio ammesso aggiorna il documento e
  l'anteprima; i bottoni «Sposta su» e «Sposta giù» funzionano come prima.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** `canNest = (id) => ALLOWED_CHILDREN[findBlock(doc.blocks, id)!.type].length > 0`;
  `canDrop = (a, t, z) => canDropBlock(doc, a, t, z)`;
  `onDrop = (a, t, z) => { const o = moveBlockTo(doc, a, t, z); o.ok ? dispatch(o.document) : showError(o.reason); }`.
- [ ] **Passo 4:** prove verdi; nessun import residuo di `BlockTreeDnd`.
- [ ] **Riga in `PROGRESS.md`:** `PHASE:1D WAVE:1D-W9b3 STATUS:complete TS:<ora UTC>`

---

## Sotto-wave `1D-W9b4` — prova nel browser, verifica, stop

### Task 6: prova end-to-end

**File:** `tests/e2e/cms/trascinamento.spec.ts` (nuovo), sul database `_e2e` con il seme sintetico.

- [ ] Menu: trascinare una voce al centro di un'altra → diventa sottovoce; nella
  fascia alta di un'altra → le va prima; verso una propria sottovoce →
  l'indicatore è «non ammesso» e nulla cambia; ricaricata la pagina, l'ordine
  resta.
- [ ] Blocchi: un testo trascinato dentro una colonna; un testo trascinato
  «dentro» un altro testo → rifiutato durante il movimento.
- [ ] Tastiera: spazio, freccia giù, freccia destra, spazio → la voce è annidata.

### Task 7: verifica e consegna

- [ ] `pnpm test`, `lint`, `typecheck`, `format:check`, `build`, `test:e2e`: verdi.
- [ ] Revisione con l'agente `code-reviewer`; correggere CRITICAL e HIGH.
- [ ] `PLAN.md` §1: una riga per la `1D-W9b`, con il rimando a DR-082 e DR-093.
- [ ] Handoff `docs/handoff/HO-010` per la **prova a vista** delle due rese di
  DR-084 sul menu e sui blocchi: è lavoro visivo, e non si dichiara finito senza
  la conferma dell'utente (regole globali, «UI/Visual Work»).
- [ ] **Fermarsi**: chiedere la conferma a vista e il commit.
- [ ] Riga in `PROGRESS.md`: `PHASE:1D WAVE:1D-W9b4 STATUS:complete TS:<ora UTC>`

## Criteri di «fatto»

1. Una voce di menu si annida o si affianca trascinandola, e prima del rilascio
   si vede quale delle due accadrà (zona divisa e rientro dell'indicatore).
2. Lo stesso per i blocchi, entro il perimetro di D27; i rilasci non ammessi si
   vedono durante il movimento e non cambiano nulla.
3. Ogni mossa si fa anche da tastiera, e l'esito è annunciato a parole.
4. Le funzioni pure hanno prove per i cinque punti di attenzione.
5. Suite verdi, prova end-to-end verde, conferma a vista dell'utente.

## Rischi e rientro

| Rischio | Mitigazione | Rientro |
|---|---|---|
| Il calcolo della fascia sbaglia con lo scorrimento della pagina | `over.rect` e coordinate del puntatore sono entrambe nella finestra; prova end-to-end con pagina scorsa | correzione puntuale |
| Lo spostamento fra contenitori produce documenti non validi | `canDropBlock` usa `ALLOWED_CHILDREN`; il documento si valida già con lo schema prima del salvataggio | il salvataggio rifiuta, il blocco resta |
| La resa visiva non convince | prova a vista con HO-010 prima della chiusura | ritocco dei soli token CSS |

## Assunzioni dichiarate

- Nessun limite di profondità del menu oltre a quelli di oggi: «Indenta» non ne
  impone, e il trascinamento non ne aggiunge. La resa pubblica dei livelli è
  materia della Fase 1E.
- Il trascinamento da tastiera parte da «accanto»: è la mossa meno distruttiva.

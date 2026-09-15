/**
 * Componenti dell'area amministrativa (`docs/design/design-system.md`).
 *
 * `apps/web` **non** importa da qui (ADR-008 §3.3 regola 3, verificato dal lint
 * di `apps/web/eslint.config.mjs`). Il foglio `./tokens.css` va importato da
 * `apps/admin` prima di ogni altro stile: dichiara le variabili di colore, la
 * tipografia, la densità e il `@font-face` di Inter.
 */

// Token — capitoli 2-5
export * from './tokens/tokens.js';
export * from './tokens/contrast.js';
export * from './tokens/contrast-pairs.js';

// Densità — capitolo 5, componente 49
export * from './density/DensityContext.js';
export * from './density/DensityToggle.js';

// Primitive — capitolo 6
export * from './primitives/Button.js';
export * from './primitives/IconButton.js';
export * from './primitives/TextField.js';
export * from './primitives/TextArea.js';
export * from './primitives/CheckboxField.js';
export * from './primitives/RadioGroup.js';
export * from './primitives/SelectField.js';
export * from './primitives/FieldGroup.js';
export * from './primitives/PublishStatusBadge.js';
export * from './primitives/DataTable.js';
export * from './primitives/Alert.js';
export * from './primitives/EmptyState.js';
export * from './primitives/Spinner.js';
export * from './primitives/Tooltip.js';
export * from './primitives/SkipLink.js';

// Guscio a scorrimento e sovrapposizione — componenti 31-33
export * from './layout/Dialog.js';
export * from './layout/SidePanel.js';
export * from './layout/Toast.js';

// Marcatori di riservatezza — componenti 36-37, prestito 3
export * from './markers/RestrictedMarker.js';
export * from './markers/VisibilityPanel.js';

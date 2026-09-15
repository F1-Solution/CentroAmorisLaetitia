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

// Tabella e moduli — componenti 17, 18, 19, 26, 28, 29, 34 (1D-W7c, gruppo A)
export * from './primitives/TableToolbar.js';
export * from './primitives/BulkActionBar.js';
export * from './primitives/Pagination.js';
export * from './primitives/DateTimeField.js';
export * from './primitives/FormLayout.js';
export * from './primitives/SaveBar.js';
export * from './primitives/ConfirmDestructive.js';
export * from './primitives/Tabs.js';
export * from './primitives/GuidedFlow.js';

// Media, editor a blocchi e resto — componenti 38-48 (1D-W7c, gruppo B)
export * from './media/MediaPicker.js';
export * from './media/MediaUploader.js';
export * from './editor/block-types.js';
export * from './editor/PreviewPane.js';
export * from './editor/BlockTreeEditor.js';
export * from './editor/BlockInserter.js';
export * from './editor/ColumnRatioControl.js';
export * from './editor/RichTextToolbar.js';
export * from './editor/HtmlFallbackEditor.js';
export * from './editor/MenuTreeEditor.js';
export * from './editor/SeoPanel.js';
export * from './editor/AuditTrail.js';

// Guscio a scorrimento e sovrapposizione — componenti 31-33
export * from './layout/Dialog.js';
export * from './layout/SidePanel.js';
export * from './layout/Toast.js';

// Marcatori di riservatezza — componenti 36-37, prestito 3
export * from './markers/RestrictedMarker.js';
export * from './markers/VisibilityPanel.js';

// Guscio e navigazione — componenti 1-13 (1D-W7b)
export * from './shell/types.js';
export * from './shell/AppShell.js';
export * from './shell/AreaNav.js';
export * from './shell/SectionNav.js';
export * from './shell/TopBar.js';
export * from './shell/Breadcrumbs.js';
export * from './shell/UserMenu.js';
export * from './shell/RoleSwitcher.js';
export * from './shell/ActiveContextBadge.js';
export * from './shell/ContextChangeNotice.js';
export * from './shell/AreaChoiceScreen.js';
export * from './shell/CrossAreaHandoff.js';
export * from './shell/CommandSearch.js';
export * from './shell/PageHeader.js';

/**
 * Componenti dell'area amministrativa (`docs/design/design-system.md`).
 *
 * `apps/web` **non** importa da qui (ADR-008 §3.3 regola 3, verificato dal lint
 * di `apps/web/eslint.config.mjs`). Il foglio `./tokens.css` va importato da
 * `apps/admin` prima di ogni altro stile: dichiara le variabili di colore, la
 * tipografia, la densità e il `@font-face` di Inter.
 */

// Token — capitoli 2-5
export * from './tokens/tokens';
export * from './tokens/contrast';
export * from './tokens/contrast-pairs';

// Densità — capitolo 5, componente 49
export * from './density/DensityContext';
export * from './density/DensityToggle';

// Primitive — capitolo 6
export * from './primitives/Button';
export * from './primitives/IconButton';
export * from './primitives/TextField';
export * from './primitives/TextArea';
export * from './primitives/CheckboxField';
export * from './primitives/RadioGroup';
export * from './primitives/SelectField';
export * from './primitives/FieldGroup';
export * from './primitives/PublishStatusBadge';
export * from './primitives/DataTable';
export * from './primitives/Alert';
export * from './primitives/EmptyState';
export * from './primitives/Spinner';
export * from './primitives/Tooltip';
export * from './primitives/SkipLink';

// Tabella e moduli — componenti 17, 18, 19, 26, 28, 29, 34 (1D-W7c, gruppo A)
export * from './primitives/TableToolbar';
export * from './primitives/BulkActionBar';
export * from './primitives/Pagination';
export * from './primitives/DateTimeField';
export * from './primitives/FormLayout';
export * from './primitives/SaveBar';
export * from './primitives/ConfirmDestructive';
export * from './primitives/Tabs';
export * from './primitives/GuidedFlow';

// Media, editor a blocchi e resto — componenti 38-48 (1D-W7c, gruppo B)
export * from './media/MediaPicker';
export * from './media/MediaUploader';
export * from './editor/block-types';
export * from './editor/PreviewPane';
export * from './editor/BlockTreeEditor';
export * from './editor/BlockInserter';
export * from './editor/ColumnRatioControl';
export * from './editor/RichTextToolbar';
export * from './editor/HtmlFallbackEditor';
export * from './editor/MenuTreeEditor';
export * from './editor/dropZone';
export * from './editor/SeoPanel';
export * from './editor/AuditTrail';

// Guscio a scorrimento e sovrapposizione — componenti 31-33
export * from './layout/Dialog';
export * from './layout/SidePanel';
export * from './layout/Toast';

// Marcatori di riservatezza — componenti 36-37, prestito 3
export * from './markers/RestrictedMarker';
export * from './markers/VisibilityPanel';

// Guscio e navigazione — componenti 1-13 (1D-W7b)
export * from './shell/types';
export * from './shell/NavLink';
export * from './shell/AppShell';
export * from './shell/AreaNav';
export * from './shell/SectionNav';
export * from './shell/TopBar';
export * from './shell/Breadcrumbs';
export * from './shell/UserMenu';
export * from './shell/RoleSwitcher';
export * from './shell/ActiveContextBadge';
export * from './shell/ContextChangeNotice';
export * from './shell/AreaChoiceScreen';
export * from './shell/CrossAreaHandoff';
export * from './shell/CommandSearch';
export * from './shell/PageHeader';

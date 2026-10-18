import { BlocksDocument, type MediaMap } from '@amoris/blocks';
import type { PostPage, PublicContent, PublicDocument, Term } from '../lib/api';
import { archiveSummary, fileSize, longDate, postDate } from '../lib/format';
import { featuredImageAttributes } from '../lib/featured';
import { promoteFirstHeading } from '../lib/headings';

/**
 * I template del sito pubblico, uno per tipo di pagina della sorgente. La forma
 * del markup segue quella del tema (`#left-area`, `.et_pb_post`, `.entry-title`):
 * le regole misurate sull'istanza di riferimento valgono così anche qui.
 */

/** Un documento Divi è una sequenza di sezioni a piena larghezza; uno Gutenberg no. */
function isFullWidthLayout(content: PublicContent['content']): boolean {
  const first = content.blocks.blocks[0];
  return first?.type === 'section';
}

/**
 * Il titolo visibile di una pagina, se il tema lo mostra; altrimenti il primo
 * titolo del contenuto diventa `<h1>` (DR-040), o un `<h1>` non visibile.
 */
function pageHeading(content: PublicContent['content'], titleShown: boolean) {
  if (titleShown) return { document: content.blocks, hidden: false };
  const { document, hasH1 } = promoteFirstHeading(content.blocks);
  return { document, hidden: !hasH1 && content.title.trim() !== '' };
}

export function ContentView({ data }: { readonly data: PublicContent }) {
  const { content, media, sliders, forms, postLists } = data;
  if (content.type === 'page' && isFullWidthLayout(content)) {
    // Le pagine costruite con Divi non mostrano il titolo: lo fa il loro contenuto.
    const { document, hidden } = pageHeading(content, false);
    return (
      <article id={`post-${content.id}`} className="page type-page">
        {hidden ? <h1 className="screen-reader-text">{content.title}</h1> : null}
        <div className="entry-content">
          <BlocksDocument
            document={document}
            media={media}
            sliders={sliders}
            forms={forms}
            postLists={postLists}
          />
        </div>
      </article>
    );
  }
  const builtWithDivi = content.type === 'post' && isFullWidthLayout(content);
  if (builtWithDivi && content.pageLayout === 'full_width') {
    // Articolo Divi a tutta larghezza: sezioni da bordo a bordo, titolo nel contenitore (DR-139).
    return (
      <article id={`post-${content.id}`} className="post et_pb_post single" data-builder="divi">
        <div className="container">
          <PostHeader title={content.title} publishedAt={content.publishedAt} />
        </div>
        <div className="entry-content">
          <BlocksDocument
            document={content.blocks}
            media={media}
            sliders={sliders}
            forms={forms}
            postLists={postLists}
          />
        </div>
      </article>
    );
  }
  const titleShown = content.type === 'page' && content.showTitle && content.title.trim() !== '';
  const heading = content.type === 'page' ? pageHeading(content, titleShown) : null;
  return (
    <div className="container">
      <div id="content-area" className="clearfix" data-page-layout={content.pageLayout}>
        <div id="left-area">
          {/* `page.php` di Divi non dà `et_pb_post` all'articolo di pagina, `single.php` sì. */}
          <article
            id={`post-${content.id}`}
            className={content.type === 'page' ? 'page type-page' : 'post et_pb_post single'}
            data-builder={builtWithDivi ? 'divi' : undefined}
          >
            {content.type === 'post' ? (
              <PostHeader title={content.title} publishedAt={content.publishedAt} />
            ) : titleShown ? (
              <h1 className="entry-title main_title">{content.title}</h1>
            ) : heading?.hidden ? (
              <h1 className="screen-reader-text">{content.title}</h1>
            ) : null}
            <div className="entry-content">
              <BlocksDocument
                document={heading?.document ?? content.blocks}
                media={media}
                sliders={sliders}
                forms={forms}
                postLists={postLists}
              />
            </div>
          </article>
        </div>
        {/* Barra laterale solo con `et_right_sidebar` della sorgente (DR-139). */}
        {content.pageLayout === 'right_sidebar' ? <div id="sidebar" /> : null}
      </div>
    </div>
  );
}

function PostHeader({ title, publishedAt }: { title: string; publishedAt: string | null }) {
  return (
    <div className="et_post_meta_wrapper">
      <h1 className="entry-title">{title}</h1>
      <p className="post-meta">
        <span className="published">{postDate(publishedAt)}</span>
      </p>
    </div>
  );
}

function Thumbnail({
  mediaId,
  media,
  href,
}: {
  mediaId: string | null;
  media: MediaMap;
  href: string;
}) {
  const item = mediaId ? media[mediaId] : undefined;
  if (!item) return null;
  return (
    <a href={href} className="entry-featured-image-url">
      <img alt="" {...featuredImageAttributes(item)} />
    </a>
  );
}

/**
 * Elenco del modello `index.php` di Divi, comune ad archivio e ricerca: immagine,
 * titolo, data, inizio del testo, «Post precedenti» verso le pagine più vecchie.
 */
function PostListing({
  heading,
  posts,
  page,
  pageHref,
}: {
  readonly heading: string;
  readonly posts: PostPage;
  readonly page: number;
  readonly pageHref: (n: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(posts.meta.total / posts.meta.perPage));
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          {/* La sorgente non ha un titolo nell'archivio: c'è, ma non si vede (A-7). */}
          <h1 className="screen-reader-text">{heading}</h1>
          {posts.items.map((post) => (
            <article key={post.id} id={`post-${post.id}`} className="et_pb_post post">
              {/* Ordine e testo nudo come il modello dell'archivio di Divi (1E-W6). */}
              <Thumbnail mediaId={post.featuredMediaId} media={posts.media} href={post.path} />
              <h2 className="entry-title">
                <a href={post.path}>{post.title}</a>
              </h2>
              <p className="post-meta">
                <span className="published">{postDate(post.publishedAt)}</span>
              </p>
              {post.textStart ? archiveSummary(post.textStart) : null}
            </article>
          ))}
          <div className="pagination clearfix">
            {page < pages ? (
              <div className="alignleft">
                <a href={pageHref(page + 1)}>&laquo; Post precedenti</a>
              </div>
            ) : null}
            {page > 1 ? (
              <div className="alignright">
                <a href={pageHref(page - 1)}>Post successivi &raquo;</a>
              </div>
            ) : null}
          </div>
        </div>
        <div id="sidebar" />
      </div>
    </div>
  );
}

export function ArchiveView({
  term,
  posts,
  page,
}: {
  readonly term: Term;
  readonly posts: PostPage;
  readonly page: number;
}) {
  return (
    <PostListing
      heading={term.name}
      posts={posts}
      page={page}
      pageHref={(n) => (n === 1 ? term.path : `${term.path}page/${n}/`)}
    />
  );
}

/** Indirizzo di una pagina dei risultati, come la sorgente: `/page/2/?s=…`. */
export function searchHref(query: string, page: number): string {
  const s = encodeURIComponent(query).replace(/%20/g, '+');
  return page === 1 ? `/?s=${s}` : `/page/${page}/?s=${s}`;
}

/** Risultati della ricerca (DR-144); senza risultati il testo `no-results.php` del tema. */
export function SearchView({
  query,
  posts,
  page,
}: {
  readonly query: string;
  readonly posts: PostPage;
  readonly page: number;
}) {
  if (posts.items.length === 0) {
    return (
      <div className="container">
        <div id="content-area" className="clearfix">
          <div id="left-area">
            <div className="entry">
              <h1 className="not-found-title">Nessun risultato</h1>
              <p>
                La pagina richiesta non è stata trovata. Affina la tua ricerca, o utilizza la barra
                di navigazione qui sopra per trovare il post.
              </p>
            </div>
          </div>
          <div id="sidebar" />
        </div>
      </div>
    );
  }
  return (
    <PostListing
      heading={`Risultati della ricerca per: ${query}`}
      posts={posts}
      page={page}
      pageHref={(n) => searchHref(query, n)}
    />
  );
}

export function DocumentView({
  document,
  media,
}: {
  readonly document: PublicDocument;
  readonly media: MediaMap;
}) {
  const file = media[document.mediaId];
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          <article className="wpdmpro et_pb_post single">
            <PostHeader title={document.title} publishedAt={document.publishedAt} />
            <div className="entry-content">
              {/* Scheda del pacchetto di Download Manager, senza il contatore dei download (D75, DR-161). */}
              <div className="w3eden">
                <div className="row">
                  <div className="col-md-5">
                    {file ? (
                      <div className="wpdm-button-area">
                        <a className="wpdm-download-link btn" href={file.publicPath}>
                          Download
                        </a>
                      </div>
                    ) : null}
                    <ul className="list-group">
                      <li className="list-group-item">
                        Dimensioni file <span className="badge">{fileSize(document.byteSize)}</span>
                      </li>
                      <li className="list-group-item">
                        Conteggio file <span className="badge">1</span>
                      </li>
                      <li className="list-group-item">
                        Data di creazione{' '}
                        <span className="badge">{longDate(document.publishedAt)}</span>
                      </li>
                      <li className="list-group-item">
                        Ultimo aggiornamento{' '}
                        <span className="badge">{longDate(document.publishedAt)}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="col-md-7">
                    {/* Nella sorgente è un secondo `h1`; qui `h2` con lo stesso aspetto, un solo titolo principale (1E-14). */}
                    <h2 className="mt-0">{document.title}</h2>
                    {document.description ? (
                      <div className="wel">
                        <p>{document.description}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/** Archivio `wpdmcategory` del tema come nella sorgente: titolo e data per documento, paginazione vuota (DR-181). */
export function DownloadCategoryView({
  term,
  documents,
}: {
  readonly term: Term;
  readonly documents: readonly PublicDocument[];
}) {
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          {/* Come l'archivio di categoria: titolo presente ma nascosto (A-7). */}
          <h1 className="screen-reader-text">{term.name}</h1>
          {documents.map((document) => {
            const href = `/download/${document.slug}/`;
            return (
              <article
                key={document.id}
                id={`post-${document.id}`}
                className={`et_pb_post wpdmpro type-wpdmpro status-publish hentry wpdmcategory-${term.slug}`}
              >
                <h2 className="entry-title">
                  <a href={href}>{document.title}</a>
                </h2>
                <p className="post-meta">
                  <span className="published">{postDate(document.publishedAt)}</span>
                </p>
              </article>
            );
          })}
          <div className="pagination clearfix">
            <div className="alignleft" />
            <div className="alignright" />
          </div>
        </div>
        <div id="sidebar" />
      </div>
    </div>
  );
}

export function NotFoundView() {
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          <article id="post-0" className="et_pb_post not_found">
            <div className="entry">
              {/* Testo del tema, identico a quello della sorgente. */}
              <h1 className="not-found-title">Nessun risultato</h1>
              <p>
                La pagina richiesta non è stata trovata. Affina la tua ricerca, o utilizza la barra
                di navigazione qui sopra per trovare il post.
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

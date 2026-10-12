import { BlocksDocument, imageAttributes, type MediaMap } from '@amoris/blocks';
import type { PostPage, PublicContent, PublicDocument, Term } from '../lib/api';
import { archiveSummary, postDate } from '../lib/format';
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
  const { content, media } = data;
  if (content.type === 'page' && isFullWidthLayout(content)) {
    // Le pagine costruite con Divi non mostrano il titolo: lo fa il loro contenuto.
    const { document, hidden } = pageHeading(content, false);
    return (
      <article id={`post-${content.id}`} className="page type-page et_pb_post">
        {hidden ? <h1 className="screen-reader-text">{content.title}</h1> : null}
        <div className="entry-content">
          <BlocksDocument document={document} media={media} />
        </div>
      </article>
    );
  }
  const titleShown = content.type === 'page' && content.showTitle && content.title.trim() !== '';
  const heading = content.type === 'page' ? pageHeading(content, titleShown) : null;
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          <article id={`post-${content.id}`} className={`${content.type} et_pb_post`}>
            {content.type === 'post' ? (
              <div className="et_post_meta_wrapper">
                <h1 className="entry-title">{content.title}</h1>
                <p className="post-meta">
                  <span className="published">{postDate(content.publishedAt)}</span>
                </p>
              </div>
            ) : titleShown ? (
              <h1 className="entry-title main_title">{content.title}</h1>
            ) : heading?.hidden ? (
              <h1 className="screen-reader-text">{content.title}</h1>
            ) : null}
            <div className="entry-content">
              <BlocksDocument document={heading?.document ?? content.blocks} media={media} />
            </div>
          </article>
        </div>
        {content.type === 'post' ? <div id="sidebar" /> : null}
      </div>
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
      <img alt="" {...imageAttributes(item)} />
    </a>
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
  const pages = Math.max(1, Math.ceil(posts.meta.total / posts.meta.perPage));
  const pageHref = (n: number) => (n === 1 ? term.path : `${term.path}page/${n}/`);
  return (
    <div className="container">
      <div id="content-area" className="clearfix">
        <div id="left-area">
          {/* La sorgente non ha un titolo nell'archivio: c'è, ma non si vede (A-7). */}
          <h1 className="screen-reader-text">{term.name}</h1>
          {posts.items.map((post) => (
            <article key={post.id} id={`post-${post.id}`} className="et_pb_post post">
              <h2 className="entry-title">
                <a href={post.path}>{post.title}</a>
              </h2>
              <p className="post-meta">
                <span className="published">{postDate(post.publishedAt)}</span>
              </p>
              {post.textStart ? <p>{archiveSummary(post.textStart)}</p> : null}
              <Thumbnail mediaId={post.featuredMediaId} media={posts.media} href={post.path} />
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
          <article className="wpdmpro et_pb_post">
            <h1 className="entry-title main_title">{document.title}</h1>
            <div className="entry-content">
              {document.description ? <p>{document.description}</p> : null}
              {file ? (
                <p>
                  <a className="wpdm-download-link" href={file.publicPath}>
                    Scarica
                  </a>
                </p>
              ) : null}
            </div>
          </article>
        </div>
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

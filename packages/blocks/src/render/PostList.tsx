import type { PostListBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, thumbnailAttributes, type MediaMap } from './media';
import type { PostListItem } from './data-maps';
import { isAllowedUrl } from '../sanitize';

export interface PostListComponentProps {
  readonly block: PostListBlock;
  readonly media?: MediaMap | undefined;
  /** Gli articoli già filtrati, ordinati e scostati (`offset`, DR-130) dal servizio. */
  readonly posts?: readonly PostListItem[] | undefined;
}

function formattedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('it-IT');
}

/** Elenco articoli con il markup del plugin Category Posts della sorgente (`BLOCK-MODEL.md` §3.11). */
export function PostList({ block, media, posts }: PostListComponentProps) {
  const className = blockClassName('post-list', block.props.classes);
  if (!posts) {
    return <div className={className} id={block.id} />;
  }
  const { showThumbnail, showDate, showExcerpt, thumbnailWidth, thumbnailHeight } = block.props;
  const moreText = block.props.excerptMoreText ?? null;
  const fallbackId = block.props.defaultThumbnailMediaId ?? null;
  return (
    <div className={className} id={block.id}>
      <ul className="blk-post-list-items">
        {posts.map((post) => {
          const href = isAllowedUrl(post.path) ? post.path : null;
          const thumbId = post.featuredMediaId ?? fallbackId;
          const thumb = showThumbnail && thumbId ? media?.[thumbId] : undefined;
          const attrs = thumb
            ? thumbnailWidth && thumbnailHeight
              ? thumbnailAttributes(thumb, thumbnailWidth, thumbnailHeight)
              : imageAttributes(thumb)
            : null;
          return (
            <li key={post.id} className="cat-post-item">
              {attrs ? (
                <div>
                  <a className="cat-post-thumbnail" href={href ?? undefined} title={post.title}>
                    <span className="cat-post-crop">
                      <img alt="" {...attrs} />
                    </span>
                  </a>
                </div>
              ) : null}
              <div className="cpwp-wrap-text">
                <div>
                  {href ? (
                    <a className="cat-post-title" href={href}>
                      {post.title}
                    </a>
                  ) : (
                    <span className="cat-post-title">{post.title}</span>
                  )}
                  {showDate && post.publishedAt ? (
                    <span className="cat-post-date">
                      {' '}
                      {post.dateText ?? formattedDate(post.publishedAt)}
                    </span>
                  ) : null}{' '}
                  {showExcerpt && post.summary ? (
                    <p className="cpwp-excerpt-text">
                      {post.summary}
                      {post.summaryTruncated && moreText && href ? (
                        <>
                          {' '}
                          <a className="cat-post-excerpt-more" href={href}>
                            {moreText}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

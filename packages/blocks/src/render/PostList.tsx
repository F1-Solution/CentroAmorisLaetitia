import type { PostListBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, type MediaMap } from './media';
import type { PostListItem } from './data-maps';
import { isAllowedUrl } from '../sanitize';

export interface PostListComponentProps {
  readonly block: PostListBlock;
  readonly media?: MediaMap | undefined;
  /** Gli articoli già filtrati, ordinati e scostati (`offset`, DR-116) dal servizio. */
  readonly posts?: readonly PostListItem[] | undefined;
}

function formattedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('it-IT');
}

/** Elenco articoli (`BLOCK-MODEL.md` §3.11); senza `posts`, resta il segnaposto di prima. */
export function PostList({ block, media, posts }: PostListComponentProps) {
  const className = blockClassName('post-list', block.props.classes);
  if (!posts) {
    return <div className={className} id={block.id} />;
  }
  const { showThumbnail, showDate, showExcerpt } = block.props;
  return (
    <div className={className} id={block.id}>
      <ul className="blk-post-list-items">
        {posts.map((post) => {
          const href = isAllowedUrl(post.path) ? post.path : null;
          const thumb =
            showThumbnail && post.featuredMediaId ? media?.[post.featuredMediaId] : undefined;
          return (
            <li key={post.id} className="blk-post-list-item">
              {thumb ? (
                href ? (
                  <a href={href}>
                    <img alt="" {...imageAttributes(thumb)} />
                  </a>
                ) : (
                  <img alt="" {...imageAttributes(thumb)} />
                )
              ) : null}
              <h3 className="blk-post-list-title">
                {href ? <a href={href}>{post.title}</a> : post.title}
              </h3>
              {showDate && post.publishedAt ? (
                <span className="blk-post-list-date">{formattedDate(post.publishedAt)}</span>
              ) : null}
              {showExcerpt && post.excerpt ? (
                <p className="blk-post-list-excerpt">{post.excerpt}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


import { Link } from 'react-router-dom';

interface PostContentRendererProps {
  content?: string;
  taggedUsers?: string[];
  hashtags?: string[];
  maxLength?: number;
  onShowMore?: () => void;
}

function getSafePreview(content: string, maxLength: number) {
  const preview = content.slice(0, maxLength);
  const lastMentionStart = preview.lastIndexOf('@[');
  const lastMentionClose = preview.lastIndexOf(')');

  if (lastMentionStart > lastMentionClose) {
    return preview.slice(0, lastMentionStart).trimEnd();
  }

  return preview;
}

export function PostContentRenderer({ content, taggedUsers = [], hashtags = [], maxLength, onShowMore }: PostContentRendererProps) {
  if (!content) {
    if (hashtags && hashtags.length > 0) {
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {hashtags.map((tag: string, i: number) => (
            <span key={i} className="text-kyte-blue font-semibold mr-1">
              #{tag}
            </span>
          ))}
        </p>
      );
    }
    return null;
  }

  const renderContent = () => {
    // Regex matches @[Display Name](id) OR #hashtag
    const tokenRegex = /(@\[.*?\]\(.*?\)|\B#[\p{L}0-9_]+)/gu;
    const parts = content.split(tokenRegex);

    return parts.map((part, index) => {
      const matchMention = part.match(/^@\[(.*?)\]\((.*?)\)$/);
      if (matchMention) {
        const displayName = matchMention[1];
        const userId = matchMention[2];

        // Check if user is still tagged
        if (taggedUsers.includes(userId)) {
          return (
            <Link
              key={index}
              to={`/profile/${userId}`}
              className="text-primary hover:underline hover:text-primary/80 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </Link>
          );
        } else {
          // Fallback to plain text if tag was removed
          return <span key={index}>{displayName}</span>;
        }
      }

      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-kyte-blue font-semibold">
            {part}
          </span>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  const isTruncated = maxLength && content.length > maxLength;
  
  if (isTruncated) {
    const preview = getSafePreview(content, maxLength) + '...';
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        <TruncatedContent content={preview} taggedUsers={taggedUsers} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowMore?.();
          }}
          className="text-muted-foreground ml-1 hover:text-kyte-blue text-xs font-medium"
        >
          Xem thêm
        </button>
      </p>
    );
  }

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {renderContent()}
    </p>
  );
}

function TruncatedContent({ content, taggedUsers = [] }: { content: string, taggedUsers?: string[] }) {
  const tokenRegex = /(@\[.*?\]\(.*?\)|\B#[\p{L}0-9_]+)/gu;
  const parts = content.split(tokenRegex);

  return (
    <>
      {parts.map((part, index) => {
        const matchMention = part.match(/^@\[(.*?)\]\((.*?)\)$/);
        if (matchMention) {
          const displayName = matchMention[1];
          const userId = matchMention[2];
          if (taggedUsers.includes(userId)) {
            return (
              <Link
                key={index}
                to={`/profile/${userId}`}
                className="text-primary hover:underline hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
            );
          }
          return <span key={index}>{displayName}</span>;
        }

        if (part.startsWith('#')) {
          return (
            <span key={index} className="text-kyte-blue font-semibold">
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

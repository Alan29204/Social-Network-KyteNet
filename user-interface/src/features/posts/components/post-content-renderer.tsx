import React from 'react';
import { Link } from 'react-router-dom';

interface PostContentRendererProps {
  content?: string;
  taggedUsers?: string[];
  maxLength?: number;
  onShowMore?: () => void;
}

export function PostContentRenderer({ content, taggedUsers = [], maxLength, onShowMore }: PostContentRendererProps) {
  if (!content) return null;

  const renderContent = () => {
    // Regex matches @[Display Name](id)
    const mentionRegex = /(@\[.*?\]\(.*?\))/g;
    const parts = content.split(mentionRegex);

    return parts.map((part, index) => {
      const match = part.match(/@\[(.*?)\]\((.*?)\)/);
      if (match) {
        const displayName = match[1];
        const userId = match[2];

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
      return <span key={index}>{part}</span>;
    });
  };

  const isTruncated = maxLength && content.length > maxLength;
  
  if (isTruncated) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {/* We need to truncate the raw string but preserve mentions if possible. 
            For simplicity, we truncate raw string and render. If a mention gets cut, it's a bit tricky. 
            Let's just slice the raw string and then render. */}
        <TruncatedContent content={content.slice(0, maxLength) + '...'} taggedUsers={taggedUsers} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowMore?.();
          }}
          className="text-muted-foreground ml-1 hover:text-snet-purple text-xs font-medium"
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
  const mentionRegex = /(@\[.*?\]\(.*?\))/g;
  const parts = content.split(mentionRegex);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/@\[(.*?)\]\((.*?)\)/);
        if (match) {
          const displayName = match[1];
          const userId = match[2];
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
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

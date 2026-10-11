"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocumentPreview({ content }: { content: string }) {
  return (
    <article className="document-prose font-sans" aria-label="Document preview">
      {content.trim() ? (
        <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
          a: ({ href, children }) => <a href={href} target={href?.startsWith("https:") || href?.startsWith("http:") ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>,
          img: ({ alt, src }) => <a href={typeof src === "string" && src.startsWith("https:") ? src : undefined} target="_blank" rel="noopener noreferrer">{alt || "Open linked image"}</a>,
        }}>{content}</Markdown>
      ) : <p className="text-muted-foreground">This document is empty. Switch to Write to start adding knowledge.</p>}
    </article>
  );
}

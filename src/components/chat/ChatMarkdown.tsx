import { type ReactNode, isValidElement, memo } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "./CodeBlock";

/** Pulls language + source out of the `<code>` child that markdown puts inside `<pre>`. */
function extractCode(children: ReactNode): { language: string; code: string } {
  if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
    const { className = "", children: code } = children.props;
    const language = /language-(\S+)/.exec(className)?.[1] ?? "";
    return { language, code: String(code ?? "").replace(/\n$/, "") };
  }
  return { language: "", code: String(children ?? "") };
}

/**
 * Markdown renderer tuned for chat: GFM (tables, strikethrough, task
 * lists), highlighted code blocks, and typography that matches the app.
 */
export const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-[0.9375rem] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 text-xl font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 text-lg font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="mt-4 text-base font-semibold">{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-4 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const { language, code } = extractCode(children);
            return <CodeBlock language={language} code={code} />;
          },
          code: ({ children }) => (
            <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.8125rem]">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/70 bg-secondary/60 px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/40 px-3 py-2 align-top">{children}</td>
          ),
          hr: () => <hr className="my-4 border-border/60" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

import { useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"

function PreBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)

  const getText = (node: ReactNode): string => {
    if (typeof node === "string") return node
    if (Array.isArray(node)) return node.map(getText).join("")
    if (node && typeof node === "object" && "props" in node) {
      return getText((node as { props: { children?: ReactNode } }).props.children)
    }
    return ""
  }

  const handleCopy = () => {
    const text = getText(children)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative mb-2 last:mb-0">
      <button
        onClick={handleCopy}
        className="app-accent-strong app-text-faint app-hover-text absolute right-2 top-2 rounded-md px-2 py-1 text-[11px] opacity-0 transition group-hover:opacity-100"
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre className="app-input-shell-strong app-text-soft overflow-x-auto rounded-lg p-3 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  )
}

const components: Components = {
  h1: ({ children }) => <h1 className="app-text mb-3 mt-4 text-lg font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="app-text mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="app-text mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="app-text-soft mb-1.5 mt-2 text-sm font-medium first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="app-text-soft mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="app-text-muted mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="app-text-soft">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} className="app-link underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="app-border-strong app-text-faint mb-2 border-l-2 pl-3 italic last:mb-0">{children}</blockquote>
  ),
  code: ({ children, className }) => {
    const isInline = !className
    if (isInline) {
      return <code className="app-accent-strong app-text-soft rounded px-1 py-0.5 text-[13px]">{children}</code>
    }
    return <code className={className}>{children}</code>
  },
  pre: ({ children }) => <PreBlock>{children}</PreBlock>,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="app-border app-text-soft border-b px-3 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="app-border-soft app-text-muted border-b px-3 py-2">{children}</td>,
  hr: () => <hr className="app-border my-3 border" />,
  strong: ({ children }) => <strong className="app-text font-semibold">{children}</strong>,
  em: ({ children }) => <em className="app-text-soft italic">{children}</em>,
  del: ({ children }) => <del className="app-text-faint">{children}</del>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="my-2 max-w-full rounded-lg" />
  ),
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}

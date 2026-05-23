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
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2 py-1 text-[11px] text-slate-400 opacity-0 transition hover:bg-white/20 hover:text-slate-200 group-hover:opacity-100"
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[13px] leading-relaxed text-slate-200">
        {children}
      </pre>
    </div>
  )
}

const components: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-4 text-lg font-semibold text-slate-100 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-slate-100 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-100 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-2 text-sm font-medium text-slate-200 first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-1 mt-2 text-sm font-medium text-slate-200 first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-1 mt-2 text-sm font-medium text-slate-300 first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="text-slate-200">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} className="text-blue-400 underline decoration-blue-400/40 hover:decoration-blue-400" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-slate-600 pl-3 italic text-slate-400 last:mb-0">{children}</blockquote>
  ),
  code: ({ children, className }) => {
    const isInline = !className
    if (isInline) {
      return <code className="rounded bg-white/10 px-1 py-0.5 text-[13px] text-slate-200">{children}</code>
    }
    return <code className={className}>{children}</code>
  },
  pre: ({ children }) => <PreBlock>{children}</PreBlock>,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-white/10 px-3 py-2 font-medium text-slate-200">{children}</th>,
  td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 text-slate-300">{children}</td>,
  hr: () => <hr className="my-3 border-white/10" />,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
  del: ({ children }) => <del className="text-slate-500">{children}</del>,
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

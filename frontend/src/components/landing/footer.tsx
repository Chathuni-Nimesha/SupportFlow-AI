import { Link } from "react-router-dom"

import { Separator } from "@/components/ui/separator"

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
] as const

const workspaceLinks = [
  { label: "Login", href: "/login" },
  { label: "Get Started", href: "/register" },
] as const

export function Footer() {
  return (
    <footer id="footer" className="border-t border-border/80 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(2,1fr)]">
          <div>
            <a
              href="#top"
              className="inline-flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                SF
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">
                SupportFlow AI
              </span>
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              An AI-powered customer support workspace for conversations,
              knowledge, and agent-assisted replies.
            </p>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Workspace" links={workspaceLinks} />
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SupportFlow AI.</p>
          <p>Built for support agents.</p>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: readonly { label: string; href: string }[]
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.href.startsWith("/") ? (
              <Link
                to={link.href}
                className="text-sm text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ) : (
              <a
                href={link.href}
                className="text-sm text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

import {
  Github,
  Linkedin,
  Twitter,
} from "lucide-react"

import { Separator } from "@/components/ui/separator"

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Integrations", href: "#resources" },
  { label: "Changelog", href: "#resources" },
]

const companyLinks = [
  { label: "About", href: "#about" },
  { label: "Careers", href: "#about" },
  { label: "Blog", href: "#resources" },
  { label: "Contact", href: "#about" },
]

const legalLinks = [
  { label: "Privacy", href: "#footer" },
  { label: "Terms", href: "#footer" },
  { label: "Security", href: "#footer" },
  { label: "DPA", href: "#footer" },
]

const socials = [
  { label: "Twitter", href: "#", icon: Twitter },
  { label: "LinkedIn", href: "#", icon: Linkedin },
  { label: "GitHub", href: "#", icon: Github },
]

export function Footer() {
  return (
    <footer id="footer" className="border-t border-border/80 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
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
              AI customer support that resolves faster, stays on-brand, and
              gives your team room to do their best work.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {socials.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Icon className="size-4" aria-hidden />
                  </a>
                )
              })}
            </div>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SupportFlow AI. All rights reserved.</p>
          <p>Built for modern support teams.</p>
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
            <a
              href={link.href}
              className="text-sm text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

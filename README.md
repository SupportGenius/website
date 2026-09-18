<p align="center">
  <b>supportgeni.us</b> · a <a href="https://factory0.ventures">Factory Zero</a> venture
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PRODUCT-NOT%20BUILT-FFC85C?style=flat-square&labelColor=0A0C10" alt="Product: not built">
  <img src="https://img.shields.io/badge/PAGES-1-E7EAEF?style=flat-square&labelColor=0A0C10" alt="Pages: 1">
  <img src="https://img.shields.io/badge/STACK-VANILLA%20JS-E7EAEF?style=flat-square&labelColor=0A0C10" alt="Stack: vanilla JS">
  <img src="https://img.shields.io/badge/BUILD%20STEP-NONE-E7EAEF?style=flat-square&labelColor=0A0C10" alt="Build step: none">
  <img src="https://img.shields.io/badge/DEPENDENCIES-ZERO-5B9DFF?style=flat-square&labelColor=0A0C10" alt="Dependencies: zero">
  <img src="https://img.shields.io/badge/DEPLOY-CLOUDFLARE%20PAGES-E7EAEF?style=flat-square&labelColor=0A0C10" alt="Deploy: Cloudflare Pages">
  <img src="https://img.shields.io/badge/AGENT%20READABLE-YES-E7EAEF?style=flat-square&labelColor=0A0C10" alt="Agent readable: yes">
</p>

---

# The site

This repository is the marketing site for **SupportGenius**: one page, one
stylesheet and one script, served by Cloudflare Pages. There is no framework,
no bundler, no build step and no runtime dependency. It was designed in Claude
Design (`SupportGenius.dc.html`) and ported to static HTML by hand, the same
way as [colonizer.dev](https://github.com/Colonizer-dev/website) and
[findsyou.work](https://github.com/FindsYou-Work/website).

> **Support that answers.** When it can't, it routes the issue to the right
> people, where they already work.

## The rule this site is built around

**Nothing is built.** There is no agent, no widget, no SDK, no phone line, no
API, no MCP server and no integration. Every capability carries one of two
labels, and the label sets the tense of the sentence around it.

- **Shipping**: built, deployed, usable now. Present tense is allowed only
  here. Today that is this page, and nothing else.
- **Planned**: named, unbuilt. Conditional tense, and a `planned` chip wherever
  it appears on the page.

A banner at the top of the page says so in the first sentence a visitor reads,
and [`llms.txt`](llms.txt) repeats it for machine readers, so an answer engine
cannot describe a planned feature as available.

The conversations, issue numbers, judge scores, SLA table and on-call phone view
are **illustrations with sample data**, and each is labelled as such where it
appears.

## The page

| Anchor | Section | Job |
| :--- | :--- | :--- |
| `/` | Hero | The claim, the planned embed snippet, the planned surfaces |
| `#demo` | Illustration | One widget, three scenes on a 32 s loop: answered from docs, escalated to engineering, passed to sales |
| `#how` | How it would work | Three steps: sources, surface, destinations |
| `#features` | Features | Fourteen planned capabilities, each with a chip |
| `#pipeline` | Escalations | Drafting model, judge model, router, lifecycle; the judge's three outcomes; an example SLA policy |
| `#human` | Human in the loop | Six steps from customer to correction, beside the on-call phone view |
| `#integrations` | Integrations | Sixteen planned destinations and surfaces |
| `#pricing` | Pricing | The tiers being planned, **without prices** |
| `#waitlist` | Waitlist | Closed until its Worker exists; a mail address until then |

Plus `404.html`, `llms.txt`, `sitemap.xml`, `robots.txt`, `site.webmanifest`
and `.well-known/security.txt`.

## Layout

```
.
├── index.html                 the page
├── 404.html
├── assets/
│   ├── supportgenius.css      the whole design system, tokens at the top
│   ├── supportgenius.js       demo stage scale, reduced motion for its SVG, the waitlist
│   └── favicon.svg            the mark, still
├── llms.txt                   the structured summary for machine readers
├── robots.txt                 AI crawlers welcomed by name
├── _headers  _redirects       Cloudflare Pages
├── COPY.md                    every claim on the page, with its source
└── tools/
    ├── check.py               structure + house-rule checks; deploy.sh runs it
    ├── build-dist.sh          assembles dist/ from an allowlist, stamps cache hashes
    └── deploy.sh              deploys origin/main from a clean worktree
```

## Local preview

No build step, but the page uses root-relative paths, so serve it rather than
opening it as `file://`:

```sh
python3 -m http.server 8000     # then http://localhost:8000/
python3 tools/check.py          # before every commit
```

`_headers` (including the Content-Security-Policy) only applies on Cloudflare
Pages. A local server does not send it, so check a change that loads anything
new on a Pages preview too.

## The demo stage

The hero illustration is a fixed 1120×520 canvas, positioned in canvas pixels so
the SVG paths and the HTML cards line up, then scaled to the column width by
`supportgenius.js` (the `--s` custom property). Without JavaScript the CSS
breakpoints approximate the same scale.

Everything runs on one 32 s loop (`--loop`), and every keyframe percentage is
the design canvas's own. The destination cards light up one after another
through `--d`, a fraction of the loop.

Under `prefers-reduced-motion` the whole scene freezes on one readable frame
(42% of the loop: the iOS conversation, escalated, with the issue filed) rather
than collapsing to its invisible end state. CSS cannot reach SMIL, so the script
pauses the SVG packets on the same frame.

## The waitlist

The form is written, and **closed**. It posts `{ email, product: "supportgenius" }`
to `https://api.supportgeni.us/v1/waitlist`, a Cloudflare Worker running the
[Cratefield](https://cratefield.com) harness `waitlist` module with its own D1
database, to live in `SupportGenius/waitlist-backend`. That Worker does not
exist yet. Until it does, the form stays hidden (`data-open="false"`) and the
page offers `hello@supportgeni.us` instead of a control that cannot work.

To open it: deploy the Worker, confirm `POST /v1/waitlist` returns 202 from
`https://supportgeni.us` (CORS), set `data-open="true"` on `#waitlist-form`, run
`tools/check.py`, and deploy. The CSP in `_headers` already allows
`https://api.supportgeni.us`.

## Deploy

Cloudflare Pages, project `supportgenius`, on the **Factory0** account, which
also holds the `supportgeni.us` zone:

```sh
tools/deploy.sh --dry-run    # what would ship
tools/deploy.sh              # ship origin/main
```

`deploy.sh` never deploys the working copy. It checks `origin/main` out into a
temporary worktree, runs `tools/check.py`, builds `dist/`, and deploys that with
the commit hash recorded on the Pages deployment. Merge first, then deploy.

Use a login or API token for the Factory0 account. Another account's
`wrangler login` fails with `Authentication error [code: 10000]`.

## House rules for edits

1. **Invent nothing.** No metrics, customer logos, testimonials, uptime figures,
   response times, user counts or benchmarks. The design canvas said the core
   gives "sub-millisecond routing, low memory"; that is not on the page.
2. **Present tense is earned.** Only what is deployed and usable is described as
   working. Today that is this page.
3. **No price for anything planned.** The canvas had $49 and $249 tiers, an
   annual discount and "99 voice minutes"; none of them are on the page.
   `tools/check.py` fails on anything that looks like a price.
4. **Nothing says Available.** The canvas marked integrations Available, Beta or
   Planned. All of them are planned, and the check fails on the other two.
5. **The demo says it is a demo.** The stage carries an `illustration` chip and a
   caption. Keep both.
6. **No dead controls.** The canvas had a Copy button for a snippet that does not
   work, a disabled "Live demo" button and footer links that went nowhere. The
   snippet carries a `planned` chip instead, the bubble links to the waitlist,
   and the footer lists only links that resolve.
7. **No dark patterns.** No fake urgency, no pre-checked boxes, and nothing gated
   behind an email.

Claims are tracked in [`COPY.md`](COPY.md).

## Working on an issue

The backlog is written for a [Colonizer](https://colonizer.dev) colony, or any
agent, to take one issue at a time. Start at the pinned tracking issue,
[#13](https://github.com/SupportGenius/website/issues/13), which gives the order
and the rules. In short: touch only the files the issue lists, run
`python3 tools/check.py` before every commit, open a PR with `Closes #N`, and
never deploy. A person merges, then runs `tools/deploy.sh`. Labels:
`colony-ready` (take it), `needs-decision` (ask the one question it names),
`human-step` / `human-only` (needs account access), `blocked`.

## Accessibility and motion

Motion is decoration. The hero illustration is `aria-hidden` and described in
prose for screen readers. Under reduced motion every animation stops. Nothing is
hidden until JavaScript runs. The canvas's `#6b7382` label colour failed WCAG AA
at the sizes it was used; it is `#7b8394` here (5.1:1 on the page background).

## Licence

The code in this repository is MIT. The SupportGenius name and mark are not.

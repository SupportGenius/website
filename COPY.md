# Claims on the page, and what backs them

Nothing is built, so almost every sentence on the page is a **plan**. This file
keeps the few facts apart from the plans, and records what was removed from the
design canvas and why. When a plan ships, move it to "Facts", cite the file or
URL that proves it, and change its tense on the page.

## Facts

| Claim | Where | Backed by |
| :--- | :--- | :--- |
| Nothing on this page is built yet | banner, hero pill, footer, `llms.txt` | There is no product repository in `github.com/SupportGenius` other than this site |
| The site is static HTML, CSS and vanilla JS on Cloudflare Pages | `llms.txt` | This repository; `tools/deploy.sh` |
| No cookies, no analytics | footer | `index.html` loads `supportgenius.js` and Google Fonts only; `tools/check.py` fails on any other third-party script |
| A Factory Zero venture | footer, JSON-LD, `llms.txt` | Factory Zero registry record FZ-008 (`Factory-Zero/website`, `assets/fz-data.js`) |

## Plans (all carry a `planned` chip or sit in a section that does)

Source for every plan: the Claude Design canvas `SupportGenius.dc.html`
(project "Next gen product website design"). They are product intentions, not
specifications, and no code exists for any of them.

- Surfaces: web widget with one script tag, voice, iOS and Android SDKs, phone
  line, REST API, MCP server.
- Answers with citations, confidence threshold, multilingual, analytics.
- Escalation pipeline: drafting model, independent judge model, router,
  lifecycle updates; the judge's three outcomes.
- Duplicate detection, consent-based diagnostics, SLA policies.
- Human in the loop from a mobile app or the API; corrections stored as reviewed
  sources.
- Sixteen destinations and surfaces under Integrations.
- Open-source Rust ticketing and routing core, MIT intended, one static binary.
- Pricing shape: free tier, paid tiers by volume, per-minute voice beyond an
  allowance, self-hosted core. No figures.

## Illustrations (sample data, labelled on the page)

- The hero stage: the three conversations, `acme/app#482`, `SUP-1042`,
  `ENG-318`, `#55821`, the Salesforce lead, "Maria K.".
- The pipeline panels: retrieval and confidence numbers, the extracted ticket,
  the judge scores.
- The SLA table ("Example policy").
- The on-call phone view.

## Third-party marks

Each icon tile in the hero illustration and the integrations grid shows either
the brand's own mark or a generic line icon. The rule: **a brand's logo only
where its owner allows referring use before an integration exists.** A
`planned` integration is not a true "integrates with" statement yet.
`tools/check.py` enforces the allowlist (`ALLOWED_MARKS`).

| Card | Icon | Source | Why |
| :--- | :--- | :--- | :--- |
| GitHub, Jira, Linear, Zendesk, Intercom, HubSpot | brand mark, one colour | Simple Icons 16.31.0 | Referring use allowed; one colour (`--ink`) because several brand colours vanish on this background |
| MCP server | Model Context Protocol mark | Simple Icons 16.31.0 | An open protocol's mark |
| Android SDK | Android robot | Simple Icons 16.31.0 | CC BY 3.0 by Google; **credited in the footer**, which the check requires |
| Salesforce | generic cloud | Lucide | Its guidelines allow the mark only with wording like "integrates with", "when such statements are true" ([Salesforce trademark guidelines](https://www.salesforce.com/company/legal/tmcusageguidelines/)) |
| Slack | chat bubbles | Lucide | Only apps listed in the Slack Marketplace may say they integrate or use the logo ([Slack Brand Terms](https://slack.com/terms-of-service/slack-brand)) |
| iOS SDK | smartphone | Lucide | Apple does not allow third parties to use the Apple logo |
| Freshdesk | headset | Lucide | No mark in any CC0 set checked |
| Mobile app, Phone line, Webhook / API | person, phone, webhook | Lucide | Not brands |
| Built-in ticketing | the SupportGenius mark | ours | |

Sources, pinned: `simple-icons-16.31.0.tgz` (CC0-1.0, sha256
`a70d15e2d53041c01741c988d2989d00f24574565ff8b58c90ddc612056fdd09`);
`lucide-static-1.47.0.tgz` (ISC, sha256
`b47744c9f7b385c25fb27d212cf9830947030a57a635f8b11a5473a72ec57cfd`). Both are
inlined as `<symbol>`s in `index.html`: `b-*` for brand marks, `i-*` for line
icons.

When an integration ships and the brand's terms are met (Salesforce: the
statement is true; Slack: a Marketplace listing), swap its line icon for the
mark, add it to `ALLOWED_MARKS`, and update this table. The footer says the
marks are trademarks of their owners and imply no affiliation; keep that line
while any mark is on the page.

## Removed from the canvas

| Canvas said | Why it is not on the page |
| :--- | :--- |
| "Open-source core, written in Rust · Hosted agent" (present tense) | Neither exists. The pill now says both are planned. |
| "Start free" CTAs | There is nothing to start. They became "Join the waitlist". |
| A Copy button on the `w.js` embed snippet | `w.js` is not served and there are no keys; copying it would hand someone a snippet that fails. |
| Two-letter monograms (GH, JI, LN, ZD, SF, IC, FD, HS, SL, …) on every icon tile | Replaced by the icons in "Third-party marks". |
| Integration badges "Available" (8) and "Beta" (7) | Nothing is available. All sixteen are `planned`. |
| Pricing: Free $0, Pro $49, Scale $249, Self-hosted Free, a "Popular" tag, Annual −20%, 500 / 5,000 / 50,000 conversations, 99 / 999 voice minutes, $0.05 per minute | No price for anything planned. The tier shape stays; the numbers and the toggle went. |
| "sub-millisecond routing, low memory" (Rust core) | A performance claim about code that does not exist. |
| "Core · Rust · MIT" in the footer | Same. |
| Footer links (Quickstart, Chat API, Webhooks, Self-hosting, Changelog, About, Privacy, Terms…) all pointing at `#top` | Dead links. The footer lists only what resolves. |
| A disabled "Live demo · coming soon" chat button | A control that does nothing. It is now a link to the waitlist, labelled "Live demo · planned". |
| "Preview with sample data. Interactive demo coming soon." | Kept in spirit, made explicit: "Illustration with sample data. Nothing here is connected to a product." |

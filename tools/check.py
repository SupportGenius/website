#!/usr/bin/env python3
"""Checks the site before it ships. Zero dependencies; run from anywhere:

    python3 tools/check.py            # checks the repository this file is in
    python3 tools/check.py <root>     # checks another checkout (deploy.sh does this)

Two kinds of check. Structural: in-page anchors resolve, ids are unique, local
assets exist, JSON parses, no third-party script sneaks in. And the house rules
from the README, as far as a script can enforce them: no price figures, no
"Available"/"Beta"/"Popular" badges, a `planned` chip on every feature,
integration and tier, the demo labelled as an illustration, and the waitlist
form closed unless its endpoint is allowed by the Content-Security-Policy.

Exit status is the number of failures (0 = all good).
"""
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
PAGES = ["index.html", "404.html"]
ALLOWED_HOSTS = {"supportgeni.us", "fonts.googleapis.com", "fonts.gstatic.com"}  # itself (canonical), and Google Fonts

failures = []


def fail(msg):
    failures.append(msg)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.hrefs, self.local, self.remote = [], [], [], []
        self.jsonld, self._in_jsonld = [], False
        self.text = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        for attr in ("href", "src"):
            v = a.get(attr)
            if not v:
                continue
            if v.startswith("#"):
                self.hrefs.append(v[1:])
            elif v.startswith("/") and not v.startswith("//"):
                self.local.append(v.split("?")[0].split("#")[0])
            elif v.startswith("https://") and tag in ("script", "link", "img", "iframe"):
                self.remote.append((tag, v))
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in_jsonld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_jsonld = False

    def handle_data(self, data):
        if self._in_jsonld:
            self.jsonld.append(data)
        else:
            self.text.append(data)


def parse(name):
    p = Page()
    p.feed((ROOT / name).read_text(encoding="utf-8"))
    return p


# ------------------------------------------------------------------ structure
for name in PAGES:
    p = parse(name)
    dupes = sorted({i for i in p.ids if p.ids.count(i) > 1})
    if dupes:
        fail(f"{name}: duplicate ids {dupes}")
    for h in p.hrefs:
        if h and h not in p.ids:
            fail(f"{name}: link to #{h}, but no element has that id")
    for path in p.local:
        target = ROOT / path.lstrip("/")
        if path == "/":
            continue
        if not target.exists():
            fail(f"{name}: {path} does not exist")
    for tag, url in p.remote:
        host = re.sub(r"^https://([^/]+).*$", r"\1", url)
        if host not in ALLOWED_HOSTS:
            fail(f"{name}: third-party <{tag}> from {host}; the page loads nothing but Google Fonts")
    for block in p.jsonld:
        try:
            json.loads(block)
        except ValueError as e:
            fail(f"{name}: JSON-LD does not parse: {e}")

for name in ["site.webmanifest"]:
    try:
        json.loads((ROOT / name).read_text(encoding="utf-8"))
    except ValueError as e:
        fail(f"{name}: does not parse: {e}")

# ------------------------------------------------------------------ house rules
index_html = (ROOT / "index.html").read_text(encoding="utf-8")
index = parse("index.html")
visible = " ".join(index.text)

# 1. No price for anything planned.
for m in re.finditer(r"[$€£]\s?\d|\d\s?(USD|EUR|GBP)\b|/\s?(mo|month)\b", visible):
    fail(f"index.html: looks like a price: {visible[max(0, m.start() - 30):m.end() + 30]!r}")

# 2. No status that claims availability.
for m in re.finditer(r">\s*(Available|Beta|Popular|Live now|GA)\s*<", index_html):
    fail(f"index.html: status badge {m.group(1)!r}; nothing is available, so nothing may say so")


# 3. Every card that describes a capability carries a planned chip.
def blocks(cls):
    # the markup keeps each card on one line or in one <li>, so a split on the class is enough
    return re.split(r'class="' + re.escape(cls) + r'"', index_html)[1:]


for cls, closing in (("feature", "</article>"), ("integration", "</li>"), ("tier", "</ul>")):
    cards = blocks(cls)
    if not cards:
        fail(f"index.html: no .{cls} cards found")
    for n, card in enumerate(cards, 1):
        if "chip--planned" not in card.split(closing)[0]:
            fail(f"index.html: .{cls} #{n} has no planned chip")

# 4. The demo says it is a demo.
if "illustration" not in index_html.split('id="demo"')[1].split("</figure>")[0]:
    fail("index.html: the hero demo lost its illustration label")

# 5. The banner says nothing is built.
if "Nothing on this page is built yet" not in index_html:
    fail("index.html: the not-built banner is missing")

# 6. The waitlist form only opens when the CSP allows its endpoint.
form = re.search(r'<form[^>]*id="waitlist-form"[^>]*>', index_html)
if not form:
    fail("index.html: #waitlist-form is missing")
else:
    tag = form.group(0)
    endpoint = re.search(r'data-endpoint="([^"]+)"', tag)
    is_open = 'data-open="true"' in tag
    headers = (ROOT / "_headers").read_text(encoding="utf-8")
    csp = re.search(r"connect-src ([^;]+);", headers)
    if endpoint and csp:
        origin = re.match(r"https://[^/]+", endpoint.group(1)).group(0)
        if origin not in csp.group(1).split():
            fail(f"_headers: connect-src does not allow {origin}, so the waitlist cannot post")
    if is_open and "hidden" not in tag:
        fail("index.html: #waitlist-form must ship hidden; supportgenius.js reveals it")
    if "data-waitlist-fallback" not in index_html:
        fail("index.html: the waitlist mail fallback is missing")

# 7. Brand marks only where the brand allows referring use before an integration exists.
#    Salesforce and Slack tie logo use to a true or listed integration; Apple forbids its
#    logo. Their cards use line icons until that changes. See COPY.md, "Third-party marks".
ALLOWED_MARKS = {"github", "jira", "linear", "zendesk", "intercom", "hubspot", "android", "modelcontextprotocol"}
for mark in sorted(set(re.findall(r'id="b-([a-z0-9]+)"', index_html)) - ALLOWED_MARKS):
    fail(f"index.html: brand mark b-{mark} is not on the allowlist; read COPY.md, Third-party marks, first")
if "b-android" in index_html and "Creative Commons 3.0 Attribution" not in index_html:
    fail("index.html: the Android robot needs its CC BY 3.0 credit")

# 8. llms.txt keeps its guard.
llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
if "NOTHING IS BUILT" not in llms and "## Shipping today" not in llms:
    fail("llms.txt: lost the built/unbuilt split")

for f in failures:
    print("FAIL", f)
print(f"{len(failures)} failure(s)" if failures else "check: ok")
sys.exit(len(failures))

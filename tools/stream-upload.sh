#!/usr/bin/env bash
# Uploads the films in assets/films/*.mp4 to Cloudflare Stream and records them in
# assets/films/stream.json, which the site reads (see assets/supportgenius.js).
#
#   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... tools/stream-upload.sh
#
# The token needs Stream:Edit on the Factory0 account. The credentials come from the
# environment only and are never printed; the token reaches curl through a config
# read from stdin, so it does not appear in the process list.
#
# For each MP4 not yet in stream.json: create a direct upload (requireSignedURLs=false,
# meta name = the file name without .mp4), upload the file, wait until the video is
# readyToStream, then record its uid. stream.json is written after every film, so a
# failed run resumes where it stopped. Once the origin is known, the CSP in _headers is
# narrowed from *.cloudflarestream.com to that exact customer host.
#
# The MP4s stay in the repo: they are the master and the fallback. Commit stream.json
# and _headers afterwards, then run tools/check.py and tools/deploy.sh.
#
# CLOUDFLARE_API_BASE overrides the API root (the tests point it at a local mock).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
API="${CLOUDFLARE_API_BASE:-https://api.cloudflare.com/client/v4}"
READY_TIMEOUT="${STREAM_READY_TIMEOUT:-1800}"
MAX_BYTES=$((200 * 1024 * 1024))   # a single-request direct upload; larger files need tus or the dashboard
MANIFEST=assets/films/stream.json
TMP=$(mktemp -d "${TMPDIR:-/tmp}/stream-upload.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

shopt -s nullglob
films=(assets/films/*.mp4)
if [ ${#films[@]} -eq 0 ]; then
  echo "no assets/films/*.mp4 to upload" >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  printf '{\n  "origin": "",\n  "films": {}\n}\n' > "$MANIFEST"
fi

# json_field PATH: reads JSON on stdin, prints the value at a dotted path ("" if absent).
json_field() {
  python3 -c '
import json, sys
v = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    v = v.get(k) if isinstance(v, dict) else None
print("" if v is None else ("true" if v is True else "false" if v is False else v))
' "$1"
}

# api METHOD PATH [BODY_FILE]: calls the Stream API and prints the response JSON.
# Exits when Cloudflare reports success=false, printing only the error messages.
api() {
  local method=$1 path=$2 body=${3-} resp
  local args=(-sS -X "$method" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(--data-binary "@$body")
  resp=$(printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN" \
    | curl "${args[@]}" -K - "$API$path")
  if [ "$(printf '%s' "$resp" | json_field success)" != "true" ]; then
    echo "Stream API $method $path failed:" >&2
    printf '%s' "$resp" | python3 -c 'import json,sys
try:
    print("  " + "; ".join(str(e.get("message", e)) for e in json.load(sys.stdin).get("errors", [])))
except Exception:
    print("  (no JSON error body)")' >&2
    exit 1
  fi
  printf '%s' "$resp"
}

# already_recorded STEM: exit 0 when stream.json already lists the film.
already_recorded() {
  python3 -c 'import json,sys; sys.exit(0 if sys.argv[1] in json.load(open(sys.argv[2]))["films"] else 1)' "$1" "$MANIFEST"
}

# record STEM UID ORIGIN: adds the film to stream.json (the origin is set once, and must not change).
record() {
  python3 - "$1" "$2" "$3" "$MANIFEST" <<'PY'
import json, sys
stem, uid, origin, path = sys.argv[1:5]
with open(path) as f:
    data = json.load(f)
if data.get("origin") and data["origin"] != origin:
    sys.exit(f"stream.json origin is {data['origin']}, but this video is on {origin}; refusing to mix accounts")
data["origin"] = origin
data["films"][stem] = {"uid": uid, "poster_time": "3s"}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

for f in "${films[@]}"; do
  file=$(basename "$f")
  stem=${file%.mp4}
  if [[ ! "$stem" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "skip $file: the name must be lowercase letters, digits and hyphens" >&2
    exit 1
  fi
  if already_recorded "$stem"; then
    echo "skip $file: already in $MANIFEST"
    continue
  fi
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -gt "$MAX_BYTES" ]; then
    echo "$file is over 200 MB; upload it from the Stream dashboard or with tus" >&2
    exit 1
  fi

  echo "uploading $file ..."
  printf '{"maxDurationSeconds":3600,"requireSignedURLs":false,"meta":{"name":"%s"}}' "$stem" > "$TMP/create.json"
  created=$(api POST "/accounts/$CLOUDFLARE_ACCOUNT_ID/stream/direct_upload" "$TMP/create.json")
  uid=$(printf '%s' "$created" | json_field result.uid)
  upload_url=$(printf '%s' "$created" | json_field result.uploadURL)
  if [ -z "$uid" ] || [ -z "$upload_url" ]; then
    echo "no upload URL returned for $file" >&2
    exit 1
  fi
  # The upload URL is pre-signed by Cloudflare: no token goes with this request.
  curl -sS -f -F "file=@$f" "$upload_url" -o /dev/null

  echo "  waiting for $uid to be ready ..."
  deadline=$((SECONDS + READY_TIMEOUT))
  while :; do
    video=$(api GET "/accounts/$CLOUDFLARE_ACCOUNT_ID/stream/$uid")
    if [ "$(printf '%s' "$video" | json_field result.readyToStream)" = "true" ]; then
      break
    fi
    if [ "$(printf '%s' "$video" | json_field result.status.state)" = "error" ]; then
      echo "Stream failed to encode $file (uid $uid); fix or re-upload it in the dashboard" >&2
      exit 1
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "timed out waiting for $file (uid $uid); re-run later, it will not upload twice" >&2
      exit 1
    fi
    sleep 10
  done

  hls=$(printf '%s' "$video" | json_field result.playback.hls)
  origin=$(printf '%s' "$hls" | python3 -c 'import sys, urllib.parse as u
p = u.urlsplit(sys.stdin.read().strip()); print(f"{p.scheme}://{p.netloc}" if p.netloc else "")')
  if [ -z "$origin" ]; then
    echo "no playback URL for $file (uid $uid)" >&2
    exit 1
  fi
  record "$stem" "$uid" "$origin"
  echo "  recorded $stem -> $uid"
done

origin=$(json_field origin < "$MANIFEST")
if [ -z "$origin" ]; then
  echo "stream.json has no origin; nothing to narrow" >&2
  exit 1
fi
# Narrow the CSP wildcard to the one customer host this account uses.
python3 - "$origin" <<'PY'
import sys
origin = sys.argv[1]
path = "_headers"
with open(path, encoding="utf-8") as f:
    text = f.read()
text = text.replace("https://*.cloudflarestream.com", origin)
with open(path, "w", encoding="utf-8") as f:
    f.write(text)
PY

echo
echo "done. stream.json and _headers now name $origin."
echo "Next: python3 tools/check.py, then commit assets/films/stream.json and _headers."

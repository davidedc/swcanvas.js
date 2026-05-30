# `vendor/bitmaptext/` — maintainer guide

`vendor/bitmaptext/` is a snapshot of upstream
[BitmapText.js](https://github.com/davidedc/BitmapText.js) source code
concatenated into `dist/swcanvas.js` by `build.sh`. The directory is
**gitignored** — it is a build artifact, not source. Two files outside the
directory drive everything:

- `vendor/bitmaptext.pin` — the **committed** source of truth. One line, the
  40-char hex SHA of the BitmapText commit to vendor.
- `vendor/bitmaptext.UPDATE.md` — this file. Maintainer documentation.

The directory itself is populated on demand from one of two sources, both via
`scripts/vendor-bitmaptext.sh`.

## Refresh from the pin (default)

```bash
./scripts/vendor-bitmaptext.sh
```

Reads `vendor/bitmaptext.pin`, downloads
`https://github.com/davidedc/BitmapText.js/archive/<sha>.tar.gz`, extracts it
to a staging dir, then rsyncs the relevant files into `vendor/bitmaptext/`.
No local BitmapText checkout required. This is the path `build.sh` takes when
its gate fires (see below).

## Refresh from a local sibling checkout

For maintainers iterating on BitmapText.js alongside SWCanvas:

```bash
./scripts/vendor-bitmaptext.sh --source ../BitmapText.js
```

Rsyncs from the local repo, then **rewrites `vendor/bitmaptext.pin`** to the
local checkout's `HEAD` SHA — so the next from-pin fetch from anyone else
matches what you just vendored.

Behaviour:

- Fails if the local source has uncommitted changes in the vendored paths
  (`src/`, `scripts/image-to-js-converter.js`). Commit them first.
- Warns (does not fail) if `HEAD` isn't reachable from any remote branch
  (i.e. you haven't pushed yet). A subsequent from-pin fetch from GitHub will
  fail until you push.
- `--no-pin-update` suppresses the pin rewrite — useful when vendoring from a
  local fork for testing without churning the committed pin.

## Bumping the pin

To advance to a newer BitmapText commit (assuming the commit is pushed to
`davidedc/BitmapText.js`):

```bash
# Edit vendor/bitmaptext.pin to the new SHA, then:
./scripts/vendor-bitmaptext.sh
npm run build
npm test
git diff vendor/bitmaptext.pin   # confirm the bump
git add vendor/bitmaptext.pin dist/swcanvas.js
git commit -m "bump BitmapText vendor to <short-sha>"
```

The PR diff is one line in `vendor/bitmaptext.pin` plus whatever changed in
`dist/swcanvas.js`. The upstream code itself isn't in the diff (it never was
in the source tree under this model).

## The `build.sh` auto-fetch gate

At the top of Phase 1.7, `build.sh` checks for
`vendor/bitmaptext/VERSION` and `vendor/bitmaptext/runtime/BitmapText.js`.
If either is missing it runs `./scripts/vendor-bitmaptext.sh` (no args, i.e.
from-pin) before continuing. `VERSION` is written **last** by the vendor
script, so it serves as a completion sentinel: a half-populated `vendor/`
(e.g. from an interrupted run) will trigger a re-fetch on the next build.

After the fetch succeeds the build proceeds normally. On a clean machine
this means `git clone && npm run build` Just Works™ — the only requirement
is network access to GitHub on first build.

## Stale-pin warning

When `git pull` brings in a new pin but you haven't re-run the vendor script,
`build.sh` will emit a one-line warning at the start of Phase 1.7:

```
WARNING: vendor/bitmaptext.pin SHA differs from vendor/bitmaptext/VERSION SHA.
         Run ./scripts/vendor-bitmaptext.sh to refresh.
```

The build does **not** auto-refresh in this case — surprise long builds after
`git pull` are worse than a one-line nudge. Run the script manually when
you're ready.

## Escape hatch for corrupted `vendor/`

If `vendor/bitmaptext/` ends up in a broken state (interrupted rsync,
accidentally edited file, etc.), force a clean refresh:

```bash
rm -rf vendor/bitmaptext
./scripts/vendor-bitmaptext.sh   # or `npm run build` to bundle the fetch into a full build
```

## GitHub rate-limit note

Unauthenticated GitHub API requests are capped at 60/hour/IP. `git clone`-
style tarball fetches share that quota. Practically irrelevant for normal
maintainer workflows (the vendor is fetched once per pin bump). If a CI
matrix ever hits the limit, set `GITHUB_TOKEN` and add
`--header "Authorization: Bearer $GITHUB_TOKEN"` to the curl call inside
`scripts/vendor-bitmaptext.sh`.

## What's vendored, what isn't

Vendored (mirrors upstream's `COMMON_FILES + BROWSER_SPECIFIC_FILES + NODE_SPECIFIC_FILES`):

- `src/runtime/*.js` (18 files)
- `src/builder/MetricsExpander.js` (used at runtime despite the `builder/` path)
- `src/platform/FontLoader{Browser,Node}.js`
- `src/utils/{AtlasLRU,AtlasCellDimensions}.js`
- `scripts/image-to-js-converter.js` (the file:// wrap converter; called by
  `npm run text:wrap-for-file` — see its file-top "VENDORING NOTES" block for
  the contract upstream is committing to)

Also vendored from upstream's `lib/` (not part of the `src/` snapshot, but
needed at runtime for Node-side text rendering tests):

- `lib/QOIDecode.js` — decodes the QOI-encoded smoke-fixture atlases at
  Node load time. Node has no built-in WebP decoder, so the Node-side
  smoke set is QOI rather than WebP. Vendored alongside the rest of the
  engine on each pin bump.
- `lib/QOIEncode.js` — the inverse, used at authoring time (NOT runtime) by
  `scripts/build-smoke-fixture.js` to re-derive the Node smoke fixture's QOI
  atlases from the published WebP release. Vendored alongside QOIDecode.

**Not** vendored:

- `src/platform/canvas-mock.js` — SWCanvas provides its own canvas factory.
- `scripts/rebuild-from-minimal.sh`, `scripts/webp-to-qoi-converter.js`,
  `scripts/build-smoke-set.js` — upstream tooling. SWCanvas does not consume a
  pre-built smoke zip; instead `scripts/build-smoke-fixture.js` re-derives
  `font-assets/_smoke/` locally from the published WebP release (porting the
  WebP→QOI + bundle-subset logic, using the vendored `lib/QOIEncode.js`). See
  "The font-assets release-tag pin" below.

## Wrapping atlases for `file://` loading

```bash
npm run text:wrap-for-file
```

Browsers block cross-`file://` Image loads (same-origin treats each local
file as a separate origin), so `FontLoaderBrowser`'s `file://` path uses
`<script>`-tag injection to load base64-wrapped atlases instead of raw
WebPs. The wrappers (`atlas-*-webp.js`) don't ship in the published
font-assets release — they're generated locally by the vendored
`vendor/bitmaptext/scripts/image-to-js-converter.js`, which `npm run
text:wrap-for-file` invokes against `font-assets/` with the `--webp` flag.

About 4550 atlases at ~20 KB each ⇒ `font-assets/` grows from ~70 MB to
~157 MB after wrapping. Only needed if you want to open
`examples/text-lru-atlas-demo.html` directly from disk; `http://` /
`https://` loading works against the raw `.webp` files unchanged.

## The font-assets release-tag pin

The engine source (this file's main subject) and the published font assets
are two independent cadences with two independent pins:

| Pin file                          | Pins                                  | Bump trigger                                        |
|-----------------------------------|---------------------------------------|-----------------------------------------------------|
| `vendor/bitmaptext.pin`           | BitmapText.js source SHA              | New upstream commit you want to vendor              |
| `vendor/bitmaptext-release.pin`   | Font-assets release tag               | New `font-assets-YYYY-MM-DD` release published      |

`vendor/bitmaptext-release.pin` is read at runtime by
`scripts/download-bitmaptext-assets.sh` (the full ~157 MB WebP set). The
committed Node smoke fixture (`font-assets/_smoke/`, QOI) is regenerated from
that same WebP set by `scripts/build-smoke-fixture.js`, so this one pin is the
single source of truth for both browser (WebP) and Node (QOI) text assets.

### Drift check

```bash
npm run text:check-pin
```

Compares the local pin against
`api.github.com/repos/davidedc/BitmapText.js/releases/latest`. Exit 0
on match, exit 1 (with a diff) on drift. Set `GITHUB_TOKEN` if you hit
the unauthenticated 60-req/hour limit.

### Bumping the release pin

```bash
# Edit vendor/bitmaptext-release.pin to the new tag, then:
./scripts/download-bitmaptext-assets.sh --force   # full WebP set (browser)
node scripts/build-smoke-fixture.js               # re-derive _smoke/ QOI from the WebP
npm run build && npm test                         # confirms Node text tests still pass
git diff vendor/bitmaptext-release.pin font-assets/_smoke/
git add vendor/bitmaptext-release.pin font-assets/_smoke/
git commit -m "bump font-assets release pin to <tag>"
```

The full `font-assets/` is gitignored (only `_smoke/` is committed), so the
commit diff is just the pin file plus whatever changed in the smoke
fixture. The engine SHA (`vendor/bitmaptext.pin`) need not move when only
the asset release changes.

## Invariants

- **Never edit anything under `vendor/bitmaptext/` directly.** It's gitignored
  and will be wiped by the next vendor script run. Patch upstream and bump
  the pin.
- **The pin file is the contract.** Don't write a SHA to `VERSION` directly;
  it's generated metadata. Edit `vendor/bitmaptext.pin`, run the script.
- **`scripts/vendor-bitmaptext.sh` is the single entry point.** Don't write a
  parallel script for "just download" or "just rsync" — use the modes.
- **`vendor/bitmaptext-release.pin` is the single source of truth for the
  font-assets tag.** Don't hard-code the tag in either downloader; both
  scripts already read the pin at runtime.

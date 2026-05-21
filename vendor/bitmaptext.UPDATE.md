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

**Not** vendored:

- `src/platform/canvas-mock.js` — SWCanvas provides its own canvas factory.
- `scripts/rebuild-from-minimal.sh`, `scripts/webp-to-qoi-converter.js` —
  needed only if SWCanvas grows Node-side text rendering tests. Deferred per
  TEXT-INTEGRATION-HANDOFF.md §15 Part 2.
- Anything under upstream's `lib/` — would be needed if vendoring the qoi
  converter; not yet warranted.

## Invariants

- **Never edit anything under `vendor/bitmaptext/` directly.** It's gitignored
  and will be wiped by the next vendor script run. Patch upstream and bump
  the pin.
- **The pin file is the contract.** Don't write a SHA to `VERSION` directly;
  it's generated metadata. Edit `vendor/bitmaptext.pin`, run the script.
- **`scripts/vendor-bitmaptext.sh` is the single entry point.** Don't write a
  parallel script for "just download" or "just rsync" — use the modes.

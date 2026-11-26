# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Changed
- HTML files: inline `<script>` (no `src`; no `type`, `text/javascript` or `module`) and `<style>` contents are now checked with the JS and CSS rules, reported at their original HTML line and column. A syntax error in one inline block skips only that block. Other script types (for example `application/json`, `text/template`), event-handler attributes and `style` attributes are still not scanned.
- Behavior change: HTML files can now produce more findings, so a CI run that was clean may exit 1. Users of `--known` may also see new findings from inline code.

### Known limitations
- A syntax error inside one inline block skips that block silently; it is not listed under skipped files.
- `<style>` blocks wrapped in `<!-- ... -->` markers are skipped as a syntax error.
- `<script type="application/javascript">` and other legacy MIME types are not scanned.

## [0.1.3]

### Documentation
- Document that inline `<script>`/`<style>` contents and `style` attributes in HTML files are not scanned.

## [0.1.2]

### Added
- Regression tests for the `array-last-index` array-like exclusions.

## [0.1.1]

### Fixed
- `array-last-index` no longer reports `children`/`childNodes`, `arguments`, or variables initialised from `querySelectorAll`/`getElementsBy*` (no `.at()` on those).

## [0.1.0]

### Added
- 13 rules over JS/TS/JSX/TSX, CSS and HTML: `json-deep-clone`, `xhr`, `hasown-call`,
  `array-last-index`, `scroll-listener`, `div-dialog`, `img-data-src`, `js-accordion`,
  `unneeded-prefix`, `padding-hack-ratio`, `owl-spacing`, `discouraged-clip`,
  `discouraged-color-adjust`.
- Baseline gate (`--baseline widely|newly|YYYY`) with redirect handling for moved and split ids.
- `text`, `json` and `sarif` (2.1.0) output, `--explain`, `--confidence`, `--exclude`.
- Known-findings file (`--write-known`, `--known`) keyed by content fingerprints.
- `rules` subcommand and `--version`.
- English and Korean output (`--lang`, `BASELINE_MODERNIZE_LANG`, `LC_ALL`/`LC_MESSAGES`/`LANG`).
- Pinned web-features 3.46.0 data snapshot.

# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

# Changelog

This project adheres to [semantic versioning](https://semver.org).

## 1.1.0

_2026-08-06_

### Added

- Directive comments suppress findings for prose a reviewer has decided to keep. `<!-- diction-md-disable-next-line -->`
  covers the findings reported on the following source line, and `<!-- diction-md-disable -->` opens a range that
  `<!-- diction-md-enable -->` closes, running to the end of the file when unmatched. A directive optionally names the
  finding categories it covers, and covers every category when it names none.
- Suppressed prose still counts toward the readability metrics, so silencing a finding does not change the document's
  score. Directives inside frontmatter and code fences have no effect.

### Fixed

- Findings that attach to a block, such as `long-paragraph`, now report the first line that contributes prose. A block
  opening with a line that normalizes to nothing, such as an HTML comment or an image-only line, previously reported
  that stripped line.

## 1.0.0

_2026-07-31_

Initial release.

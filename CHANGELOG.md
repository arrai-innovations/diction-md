# Changelog

This project adheres to [semantic versioning](https://semver.org).

## Unreleased

### Added

- The CLI reads standard input when given no file arguments, and reports findings against `<stdin>`. This checks text
  that is not a file yet, such as a commit message or a pull request body. File arguments take precedence, and running
  the command with neither prints the usage message.

- The `@arrai-innovations/diction-md/commitlint` entry point exports commitlint rules that check a commit subject and
  body. Four rules report separately so severity matches intent. `diction-subject-error` and `diction-body-error`
  default to level 2 and fail the commit. `diction-subject-warning` and `diction-body-warning` default to level 1 and
  print without blocking. A project opts in through its own commitlint config.
- The `honorDirectives` option, and the matching `--no-directives` flag, ignore inline suppression comments and report
  every finding. The commitlint rules set it, so the directive syntax carries no meaning in a commit message.

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

# Upstream

Rowbase is an engineering fork of
[jysperm/obsidian-csv-database](https://github.com/jysperm/obsidian-csv-database).
The original project is licensed under the MIT License; that license and
attribution are preserved in `LICENSE`.

## Source Commit

- Upstream URL: https://github.com/jysperm/obsidian-csv-database.git
- Starting commit: `ec2fa13c384b964ed3c5cc566728bdee50da778b`

## Baseline Inherited Areas

The following upstream areas were inherited unmodified at the starting commit:

- `src/csv-parser.ts`
- `src/types.ts`
- `src/relation-utils.ts`
- `src/database-view.ts`
- `src/components/` (the React components)

## Maintenance Rule

Rowbase is maintained independently. It does not depend on the upstream
package at build time or runtime. The source tree is progressively reorganized
where that improves the boundaries needed by the Rowbase feature set; unrelated
upstream behavior is not carried forward automatically. The upstream repository
may be retained as a Git remote for comparison only.

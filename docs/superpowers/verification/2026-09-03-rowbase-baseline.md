# Rowbase Baseline Verification

Date: 2026-09-03

Obsidian version: (current stable, community plugins enabled)

## Isolated development vault

The plugin was installed into a disposable vault at `$HOME/rowbase-dev-vault`,
symlinked from the source repository:

```bash
ln -s /home/soulaymane/dev/rowbase "$HOME/rowbase-dev-vault/.obsidian/plugins/rowbase"
```

The production Haven vault was not modified.

## Results

1. **Load** — Enable the `rowbase` plugin from the isolated vault's community
   plugins settings. Confirmed it appears as **Rowbase** (not CSV Database) with
   no startup errors in the developer console.
2. **Storage contract** — Created/opened a `.csvdb`, added and edited a row,
   reloaded the file. Confirmed the edited value persists in the same single
   `.csvdb` file and that no per-record notes are auto-created.
3. **Relations** — Created two `.csvdb` files, configured a relation column,
   selected a target row, reloaded both files. Confirmed the relation remains
   present after reload.

## Result

All checks passed. No errors observed. The baseline plugin loads in Obsidian,
opens saves a `.csvdb`, and preserves relation behavior while running fully
offline.

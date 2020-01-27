#!/bin/sh

# Standardizes table padding.
#
# Example:
#   | ----      | :---------|
#   | example   |  example  |
#
#   | --- | :-- |
#   | example | example |

osu_wiki_dir="$(dirname "$0")/.."

find "$osu_wiki_dir" -name '*.md' -exec sed -i \
    -e 's/|\(\|[ \t]\{2,\}\)\([^| \t][^|]*\)[ \t]*|/| \2 |/g' \
    -e 's/|[ \t]*\([^|]*[^| \t]\)\(\|[ \t]\{2,\}\)|/| \1 |/g' \
    -e 's/|[ \t]*\([:-]\)-\{2,\}\([:-]\)[ \t]*|/| \1-\2 |/g' \
    {} + \
    && git add {} +

non_table_changes="$(git diff --cached --diff-filter=M -G'^[^|]')"

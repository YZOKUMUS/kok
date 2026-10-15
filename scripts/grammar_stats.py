"""Count word occurrences in the roots by part of speech and grammar tag."""

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LETTER = re.compile(r"[\u0621-\u064A\u0671]")


def quran_words():
    verses = json.loads((ROOT / "content" / "uthmani.json").read_text(encoding="utf-8"))
    return sum(1 for text in verses.values() for token in text.split() if LETTER.search(token))


def main():
    print("quran words", quran_words())
    pos = Counter()
    raw = Counter()
    lemmas = {}
    roots = 0
    for path in sorted((ROOT / "content" / "roots").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        roots += 1
        for occ in data.get("occurrences", []):
            grammar = occ.get("grammar") or {}
            kind = grammar.get("partOfSpeech") or "?"
            pos[kind] += 1
            for tag in grammar.get("raw") or []:
                raw[tag] += 1
            lemma = (occ.get("lemmaFormArabic") or "").split(">")[-1]
            lemmas.setdefault(kind, set()).add((data["id"], lemma))
    print("roots", roots, "occurrences", sum(pos.values()))
    for kind, count in pos.most_common():
        print(f"pos {kind}: {count} occurrences, {len(lemmas[kind])} distinct words")
    print("untagged", sorted(lemmas.get("?", [])))
    for tag, count in raw.most_common(60):
        print(f"tag {tag}: {count}")


if __name__ == "__main__":
    main()

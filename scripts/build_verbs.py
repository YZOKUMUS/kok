"""Write content/verbs.json: lemmas whose occurrences are only Fiil, not İsim."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def plain(value: str) -> str:
    text = str(value or "")
    if ">" in text:
        text = text[text.rfind(">") + 1 :]
    return " ".join(text.split())


def root_filename(root_id: str) -> str:
    return "".join(f"_{ch.lower()}" if ch.isupper() else ch for ch in root_id)


def main() -> None:
    index = json.loads((ROOT / "content" / "index.json").read_text(encoding="utf-8"))
    verbs = []
    for entry in index["roots"]:
        path = ROOT / "content" / "roots" / f"{root_filename(entry['id'])}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        grouped: dict[str, list[dict]] = {}
        for occ in data.get("occurrences") or []:
            lemma = plain(occ.get("lemmaFormArabic") or "")
            if not lemma:
                continue
            grouped.setdefault(lemma, []).append(occ)
        for lemma, rows in grouped.items():
            kinds = {(row.get("grammar") or {}).get("partOfSpeech") for row in rows}
            kinds.discard(None)
            kinds.discard("")
            if kinds != {"Fiil"}:
                continue
            sample = rows[0]
            meaning = (data.get("meanings") or [""])[0]
            verbs.append(
                {
                    "rootId": entry["id"],
                    "latinName": entry.get("latinName") or "",
                    "lettersArabic": entry.get("lettersArabic") or "",
                    "meaning": meaning[:180],
                    "lemma": lemma,
                    "count": len(rows),
                    "gloss": sample.get("gloss") or "",
                    "formInAyah": plain(sample.get("formInAyah") or lemma),
                    "transliteration": sample.get("transliteration") or "",
                    "sura": sample.get("sura") or 0,
                    "ayah": sample.get("ayah") or 0,
                    "verseArabic": sample.get("verseArabic") or "",
                    "verseMeaning": sample.get("verseMeaning") or "",
                }
            )
    verbs.sort(key=lambda item: (-item["count"], item["latinName"]))
    out = ROOT / "content" / "verbs.json"
    out.write_text(json.dumps({"verbs": verbs}, ensure_ascii=False), encoding="utf-8")
    print(f"verbs {len(verbs)} -> {out}")


if __name__ == "__main__":
    main()

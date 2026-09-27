"""Download quran.com Uthmani verse text into content/uthmani.json."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content" / "uthmani.json"


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "KuranHaritasi/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def main() -> None:
    verses: dict[str, str] = {}
    for chapter in range(1, 115):
        data = get(f"https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number={chapter}")
        for verse in data["verses"]:
            verses[verse["verse_key"]] = verse["text_uthmani"]
        print(chapter, len(data["verses"]))
    OUT.write_text(json.dumps(verses, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(verses)} -> {OUT}")


if __name__ == "__main__":
    main()

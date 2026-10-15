"""Diyanet İşleri Başkanlığı meali, one entry per verse.

Pages are read from kuran.diyanet.gov.tr in mushaf order. A surah title can sit
on the page before its first verse, so surahs are tracked by verse numbers: a block
either continues the previous one or starts a new surah at 1.
Diyanet sometimes translates several verses as one (70:15-16); each verse in the
range gets that text, prefixed with the range.
Writes content/meals.json and the verseMeaning of every occurrence in content/roots.
"""

import html
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / "_diyanet_cache"
URL = "https://kuran.diyanet.gov.tr/mushaf/kuran-meal-2/sure-{sura}/ayet-{ayah}/diyanet-isleri-baskanligi-meali-1"
TEXT = 'class="mealViewFullText">'
NUMBER = re.compile(r"<span class='Ayet-Number'>﴾<span>(\d+)(?:-(\d+))?</span>﴿</span>")


def ayah_counts() -> dict[int, int]:
    verses = json.loads((ROOT / "content" / "uthmani.json").read_text(encoding="utf-8"))
    counts: dict[int, int] = {}
    for key in verses:
        sura, ayah = (int(part) for part in key.split(":"))
        counts[sura] = max(counts.get(sura, 0), ayah)
    return counts


def page(sura: int, ayah: int) -> str:
    path = CACHE / f"{sura}-{ayah}.html"
    if not path.exists():
        request = urllib.request.Request(URL.format(sura=sura, ayah=ayah), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
        time.sleep(0.3)
    return path.read_text(encoding="utf-8")


def clean(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def page_blocks(text: str) -> list[tuple[int, int, str]]:
    start = text.find('id="mealAyetsContainer"')
    end = text.find('id="quranContainer"', start)
    body = text[start:end]
    blocks = []
    at = body.find(TEXT)
    while at >= 0:
        number = NUMBER.search(body, at)
        if not number:
            raise RuntimeError("verse number missing after meal text")
        first = int(number.group(1))
        last = int(number.group(2) or first)
        blocks.append((first, last, clean(body[at + len(TEXT) : number.start()])))
        at = body.find(TEXT, number.end())
    return blocks


def read_diyanet() -> dict[str, str]:
    CACHE.mkdir(parents=True, exist_ok=True)
    counts = ayah_counts()
    meals: dict[str, str] = {}
    sura, ayah = 1, 1
    while sura <= 114:
        blocks = page_blocks(page(sura, ayah))
        while blocks and blocks[0][1] < ayah:
            # A block that spans two pages is printed on both.
            blocks.pop(0)
        if not blocks or blocks[0][0] != ayah:
            raise RuntimeError(f"page for {sura}:{ayah} does not start at that verse")
        expected = ayah
        for first, last, meal in blocks:
            if first == 1 and expected > counts[sura]:
                sura, expected = sura + 1, 1
            if first != expected or last > counts[sura]:
                raise RuntimeError(f"unexpected block {first}-{last} after {sura}:{expected - 1}")
            text = meal if first == last else f"({first}-{last}) {meal}"
            for number in range(first, last + 1):
                meals[f"{sura}:{number}"] = text
            expected = last + 1
        sura, ayah = (sura, expected) if expected <= counts[sura] else (sura + 1, 1)
    missing = [f"{s}:{a}" for s, n in counts.items() for a in range(1, n + 1) if not meals.get(f"{s}:{a}")]
    if missing:
        raise RuntimeError(f"{len(missing)} verses without meal, first {missing[:5]}")
    return dict(sorted(meals.items(), key=lambda item: tuple(int(part) for part in item[0].split(":"))))


def apply_to_roots(meals: dict[str, str]) -> int:
    changed = 0
    for path in sorted((ROOT / "content" / "roots").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        dirty = False
        for item in data.get("occurrences") or []:
            meal = meals.get(f"{item.get('sura')}:{item.get('ayah')}", "")
            if item.get("verseMeaning") != meal:
                item["verseMeaning"] = meal
                dirty = True
        if dirty:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    meals = read_diyanet()
    out = ROOT / "content" / "meals.json"
    out.write_text(json.dumps(meals, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(meals)} meals -> {out.name}")
    print(f"{apply_to_roots(meals)} root files updated")


if __name__ == "__main__":
    main()

"""Import a kuranharitasi root page dump into app/public/content/kuran-haritasi/roots/{id}.json"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HEADER_RE = re.compile(r"^([^\n]+?)\s+(\d+):\s*(\d+)\s*$", re.M)
ARABIC_START = re.compile(r"^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
FORM_RE = re.compile(r"^(\S+)\s+(\S+)\s+(.+)$")
TITLE_RE = re.compile(
    r"^\s*([A-Za-zÇĞİÖŞÜçğıöşü\-]+)\s+([\u0600-\u06FF](?:\s+[\u0600-\u06FF])+)\s*$",
    re.M,
)
TOTAL_RE = re.compile(r"toplamda\s+(\d+)\s+kez", re.I)
LEMMA_RE = re.compile(r"\|\s*(\d+)\s+kez\s+(\S+)\s*\|")


def split_grammar(joined: str) -> list[str]:
    gj = joined
    for pattern, repl in [
        (r"(Kalıbı)(İsim)", r"\1 \2"),
        (r"(Fiil)(Dişil)", r"\1 \2"),
        (r"(Dişil)(Mansûb)", r"\1 \2"),
        (r"(Dişil)(Mecrûr)", r"\1 \2"),
        (r"(Dişil)(Merfû)", r"\1 \2"),
        (r"(İsim)(Dişil)", r"\1 \2"),
        (r"(İsim)(Tef)", r"\1 \2"),
        (r"(İsim)(Eril)", r"\1 \2"),
        (r"(Çoğul)(Mecrûr)", r"\1 \2"),
        (r"(Çoğul)(Mansûb)", r"\1 \2"),
        (r"(Mecrûr İsim)(Belirsiz)", r"\1 \2"),
        (r"(Mansûb İsim)(Belirsiz)", r"\1 \2"),
        (r"(Dişil,)(Çoğul)", r"\1 \2"),
        (r"(Eril,)(Çoğul)", r"\1 \2"),
    ]:
        gj = re.sub(pattern, repl, gj)
    parts = [p for p in re.split(r"\s{2,}|\s·\s", gj) if p.strip()]
    if len(parts) == 1:
        parts = [
            p
            for p in re.split(
                r"\s+(?=(?:İsim|Fiil|Tef|Dişil|Eril|Mansûb|Mecrûr|Merfû|Çoğul|Belirsiz))",
                gj,
            )
            if p.strip()
        ]
    return parts


def build_grammar(raw_tags: list[str], joined: str) -> dict | None:
    if not raw_tags and not joined:
        return None
    tags = raw_tags if raw_tags else [joined]
    grammar: dict = {"raw": tags}
    text = " ".join(tags)
    if "İsim" in text:
        grammar["partOfSpeech"] = "İsim"
    if "Fiil" in text and "İsim Fiil" not in text:
        grammar["partOfSpeech"] = "Fiil"
    if "Dişil" in text:
        grammar["gender"] = "Dişil"
    if "Eril" in text:
        grammar["gender"] = "Eril"
    if "Çoğul" in text:
        grammar["number"] = "Çoğul"
    for pattern_name in ("Tef’il Kalıbı", "Tef'il Kalıbı", "Tefa’ul Kalıbı", "Tefa'ul Kalıbı"):
        if pattern_name in text:
            grammar["pattern"] = pattern_name.replace("'", "’")
            break
    for case in ("Mansûb İsim", "Mecrûr İsim", "Merfû İsim"):
        if case in text:
            grammar["case"] = case
    return grammar


def split_verse_line(verse_line: str) -> tuple[str, str, str]:
    parts = re.split(r"\s+(?=[A-Za-zİıŞşĞğÜüÖöÇçÂâÎîÛû])", verse_line, maxsplit=1)
    if len(parts) != 2:
        return verse_line.strip(), "", ""

    verse_arabic = parts[0].strip()
    rest = parts[1].strip()
    split_m = re.search(r"\.\s+(?=[A-ZÇĞİÖŞÜÂÎÛ“\"'(])", rest)
    if split_m:
        return (
            verse_arabic,
            rest[: split_m.start() + 1].strip(),
            rest[split_m.end() :].strip(),
        )
    # Fallback: long rest without clear meal — keep as transliteration
    return verse_arabic, rest, ""


def parse_occurrences(text: str) -> list[dict]:
    start_marker = "işaretine tıklayarak"
    idx = text.find(start_marker)
    body = text[idx:] if idx >= 0 else text
    headers = list(HEADER_RE.finditer(body))
    occurrences: list[dict] = []

    for i, match in enumerate(headers):
        lemma = match.group(1).strip()
        sura = int(match.group(2))
        ayah = int(match.group(3))
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(body)
        chunk = body[start:end].strip()
        lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]

        form = ""
        translit = ""
        gloss = ""
        grammar_parts: list[str] = []
        verse_line = None

        if lines:
            form_m = FORM_RE.match(lines[0])
            if form_m:
                form, translit, gloss = form_m.group(1), form_m.group(2), form_m.group(3).strip()
            else:
                form = lines[0]
            for ln in lines[1:]:
                if ARABIC_START.match(ln) and len(ln) > 20:
                    verse_line = ln
                    break
                grammar_parts.append(ln)

        grammar_joined = " ".join(grammar_parts)
        grammar = build_grammar(split_grammar(grammar_joined) if grammar_joined else [], grammar_joined)

        occ: dict = {
            "lemmaFormArabic": lemma,
            "sura": sura,
            "ayah": ayah,
            "formInAyah": form,
            "transliteration": translit,
            "gloss": gloss,
        }
        if grammar:
            occ["grammar"] = grammar
        if verse_line:
            verse_arabic, verse_translit, verse_meaning = split_verse_line(verse_line)
            if verse_arabic:
                occ["verseArabic"] = verse_arabic
            if verse_translit:
                occ["verseTransliteration"] = verse_translit
            if verse_meaning:
                occ["verseMeaning"] = verse_meaning
        occurrences.append(occ)

    return occurrences


def extract_header(text: str) -> dict:
    title = TITLE_RE.search(text)
    latin_name = title.group(1).strip() if title else ""
    letters = title.group(2).strip() if title else ""

    total_m = TOTAL_RE.search(text)
    total = int(total_m.group(1)) if total_m else 0

    lemmas = [{"formArabic": form, "count": int(count)} for count, form in LEMMA_RE.findall(text)]

    # Meanings block: between title line and "Kur'an'da bu kökten"
    meanings: list[str] = []
    turkish: list[str] = []
    notes: list[str] = []
    if title:
        after = text[title.end() : total_m.start() if total_m else title.end() + 800]
        block = " ".join(line.strip() for line in after.splitlines() if line.strip())
        block = re.split(r"\s*Kur'an'da bu kökten", block, maxsplit=1)[0].strip()
        if "Türkçe’ye girmiş türevler:" in block or "Türkçe'ye girmiş türevler:" in block:
            split_key = (
                "Türkçe’ye girmiş türevler:"
                if "Türkçe’ye girmiş türevler:" in block
                else "Türkçe'ye girmiş türevler:"
            )
            before, after_tr = block.split(split_key, 1)
            meanings = [before.strip()] if before.strip() else []
            tr_part = re.split(r"\s+(?=Akad|İbr|Sry\.|Süryanice|Aram)", after_tr, maxsplit=1)[0]
            turkish = [part.strip() for part in re.split(r",\s*", tr_part) if part.strip()]
        else:
            meanings = [block.strip()] if block.strip() else []

    return {
        "latinName": latin_name,
        "lettersArabic": letters,
        "meanings": meanings,
        "derivativeNotes": notes,
        "turkishDerivatives": turkish,
        "totalOccurrencesInQuran": total,
        "lemmas": lemmas,
    }


def root_filename(root_id: str) -> str:
    """NTFS-safe file stem. Root ids differ by case (Hkm / hkm); Windows folds case."""
    return "".join(f"_{ch.lower()}" if ch.isupper() else ch for ch in root_id)


def upsert_index(repo: Path, entry: dict) -> None:
    index_path = repo / "content" / "index.json"
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {
            "version": "0.2.0",
            "source": "https://kuranharitasi.com",
            "notes": "Kök dizini. Detaylar roots/{id}.json.",
            "roots": [],
        }
    roots = [r for r in index.get("roots", []) if r.get("id") != entry["id"]]
    preview = entry["meanings"][0] if entry["meanings"] else entry["latinName"]
    if len(preview) > 80:
        preview = preview[:77] + "…"
    roots.append(
        {
            "id": entry["id"],
            "latinName": entry["latinName"],
            "lettersArabic": entry["lettersArabic"],
            "totalOccurrencesInQuran": entry["totalOccurrencesInQuran"],
            "lemmaCount": len(entry["lemmas"]),
            "meaningsPreview": preview,
        }
    )
    roots.sort(key=lambda r: r["latinName"].lower())
    index["roots"] = roots
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: import_root_dump.py <rootId> <dump.txt>", file=sys.stderr)
        return 1

    root_id = sys.argv[1]
    dump_path = Path(sys.argv[2])
    text = dump_path.read_text(encoding="utf-8")
    header = extract_header(text)
    occurrences = parse_occurrences(text)
    if header["totalOccurrencesInQuran"] == 0:
        header["totalOccurrencesInQuran"] = len(occurrences)

    root = {
        "id": root_id,
        **header,
        "cognates": [],
        "occurrences": occurrences,
        "sourceUrl": f"https://kuranharitasi.com/kokler.aspx?kok={root_id}",
    }

    # Preserve richer cognates for known seeds if present in dump phrasing
    if "šamû" in text or "šāmayim" in text:
        root["cognates"] = [
            {"language": "Akad", "form": "šamû", "meaning": "Gökler, cennet, gökyüzü, sema"},
            {
                "language": "Süryanice",
                "form": "šmayā",
                "script": "ܫܡܲܝܵܐ",
                "meaning": "Gökler, cennet, gökyüzü, sema",
            },
            {
                "language": "İbranice",
                "form": "šāmayim",
                "script": "שָׁמַיִם",
                "meaning": "Gökler, cennet, gökyüzü, sema",
            },
        ]
        root["derivativeNotes"] = [
            "semavat - yükseklikler, gökler, yağmur, yağmur bulutları.",
            "ism - Bir şeyin, nesnenin ayırt edici işareti.",
        ]

    repo = Path(__file__).resolve().parents[1]
    out_dir = repo / "content" / "roots"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{root_filename(root_id)}.json"
    out_path.write_text(json.dumps(root, ensure_ascii=False, indent=2), encoding="utf-8")

    missing_ar = sum(1 for o in occurrences if not o.get("verseArabic"))
    missing_mean = sum(1 for o in occurrences if not o.get("verseMeaning"))
    print(
        f"{root_id}: occurrences={len(occurrences)} "
        f"expected={root['totalOccurrencesInQuran']} "
        f"missingArabic={missing_ar} missingMeaning={missing_mean}"
    )
    print(f"wrote {out_path}")
    upsert_index(repo, root)
    print("updated index.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

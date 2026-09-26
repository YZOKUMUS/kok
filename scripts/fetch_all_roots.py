"""Fetch every root from kuranharitasi.com into content/roots/{id}.json.

Discovery: the letter dropdown posts back and returns that letter's root ids.
Each root page is parsed into the same JSON shape as import_root_dump.py.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_root_dump import build_grammar, root_filename

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "content" / "roots"
INDEX_PATH = ROOT / "content" / "index.json"
BASE = "https://kuranharitasi.com/kokler.aspx"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KuranHaritasi/0.2"
WORKERS = 6

GRAMMAR_FIELDS = (
    "cinsLabel",
    "fiilformLabel",
    "etkenlikLabel",
    "fiilisimLabel",
    "zamirLabel1",
    "zamankipiLabel2",
    "haliLabel3",
    "Alan15Label4",
)

LANG_RE = re.compile(
    r"(Akad|Akkad|Süryanice|Suryanice|Sry|İbranice|Ibranice|İbr|Aramice|Aram|İbr/Aram|Ibr/Aram)\.?",
    re.I,
)
LANG_NAME = {
    "akad": "Akad",
    "akkad": "Akad",
    "sry": "Süryanice",
    "süryanice": "Süryanice",
    "suryanice": "Süryanice",
    "ibr": "İbranice",
    "i̇br": "İbranice",
    "ibranice": "İbranice",
    "i̇branice": "İbranice",
    "aram": "Aramice",
    "aramice": "Aramice",
    "ibr/aram": "İbranice/Aramice",
    "i̇br/aram": "İbranice/Aramice",
}


def clean(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = unescape(value).replace("\xa0", " ").replace("\u200b", "")
    return re.sub(r"\s+", " ", value).strip()


def span_by_id(html: str, element_id: str) -> str:
    match = re.search(rf'id="{re.escape(element_id)}"[^>]*>(.*?)</span>', html, re.S)
    return clean(match.group(1)) if match else ""


def hidden_value(html: str, name: str) -> str:
    match = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    if not match:
        match = re.search(rf'value="([^"]*)"[^>]*name="{re.escape(name)}"', html)
    return unescape(match.group(1)) if match else ""


def http_get(url: str, timeout: int = 120) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 5:
                raise
            time.sleep(1.5 * (attempt + 1))
            last = exc
    raise RuntimeError(last)


def http_post(url: str, data: dict[str, str], timeout: int = 180) -> str:
    body = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(url)


def discover_root_ids() -> list[str]:
    page = http_get(f"{BASE}?kok=Abb")
    letters = re.findall(
        r'name="ctl00\$ContentPlaceHolder1\$arapharflerlist".*?</select>',
        page,
        re.S,
    )
    if not letters:
        raise RuntimeError("letter dropdown missing")
    letter_values = re.findall(r'<option[^>]*value="([^"]+)"', letters[0])
    ids: list[str] = []
    seen: set[str] = set()

    def take(html: str) -> None:
        block = re.search(
            r'id="ContentPlaceHolder1_koklerlist"(.*?)</select>',
            html,
            re.S,
        )
        if not block:
            return
        for root_id in re.findall(r'<option[^>]*value="([^"]+)"', block.group(1)):
            if root_id not in seen:
                seen.add(root_id)
                ids.append(root_id)

    take(page)
    for letter in letter_values:
        fields = {
            "__EVENTTARGET": "ctl00$ContentPlaceHolder1$arapharflerlist",
            "__EVENTARGUMENT": "",
            "__LASTFOCUS": "",
            "__VIEWSTATE": hidden_value(page, "__VIEWSTATE"),
            "__VIEWSTATEGENERATOR": hidden_value(page, "__VIEWSTATEGENERATOR"),
            "__EVENTVALIDATION": hidden_value(page, "__EVENTVALIDATION"),
            "ctl00$ContentPlaceHolder1$arapharflerlist": letter,
            "ctl00$ContentPlaceHolder1$koklerlist": ids[0] if ids else "Abb",
        }
        posted = http_post(f"{BASE}?kok=Abb", fields)
        before = len(ids)
        take(posted)
        print(f"letter {letter}: +{len(ids) - before} (total {len(ids)})", flush=True)
        page = posted
    return ids


def anlam_inner(html: str) -> str:
    match = re.search(r'id="ContentPlaceHolder1_anlamLabel"[^>]*>', html)
    if not match:
        return ""
    start = match.end()
    end = html.find('id="ContentPlaceHolder1_kelimesaylbl"', start)
    if end < 0:
        end = start + 4000
    chunk = html[start:end]
    cut = chunk.rfind("</p>")
    if cut >= 0:
        chunk = chunk[:cut]
    chunk = re.sub(r"</span>\s*$", "", chunk.strip())
    return chunk


def parse_cognate_block(text: str) -> list[dict]:
    cognates: list[dict] = []
    matches = list(LANG_RE.finditer(text))
    if not matches:
        return cognates
    meaning = ""
    if "=" in text:
        meaning = clean(text.split("=", 1)[1])
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        piece = text[start:end]
        piece = piece.split("=", 1)[0]
        script = "".join(ch for ch in piece if "\u0590" <= ch <= "\u074f" or "\u0780" <= ch <= "\u07bf" or "\ufb1d" <= ch <= "\ufb4f")
        form = "".join(ch if not ("\u0590" <= ch <= "\u08ff") else " " for ch in piece)
        form = clean(form).strip(" ,.;:")
        key = match.group(1).lower().replace("i̇", "i")
        language = LANG_NAME.get(key, match.group(1))
        if not form and not script:
            continue
        entry = {"language": language, "form": form}
        if script:
            entry["script"] = script
        if meaning:
            entry["meaning"] = meaning
        cognates.append(entry)
    return cognates


def parse_anlam(inner: str) -> dict:
    blocked = re.sub(r"<br\s*/?>", "\n", inner, flags=re.I)
    raw_parts = [part.strip() for part in re.split(r"\n+", blocked) if clean(part)]
    meanings: list[str] = []
    notes: list[str] = []
    turkish: list[str] = []
    cognates: list[dict] = []
    for part in raw_parts:
        plain = clean(part)
        if not plain:
            continue
        if re.search(r"Türkçe['’]ye girmiş türevler", plain, re.I):
            after = re.split(r"Türkçe['’]ye girmiş türevler\s*:?", plain, maxsplit=1, flags=re.I)[-1]
            turkish = [item.strip(" .") for item in re.split(r",\s*", after) if item.strip(" .")]
            continue
        if LANG_RE.search(plain) and re.search(r"\b(Akad|Sry|İbr|Aram)\b", plain):
            found = parse_cognate_block(plain)
            if found:
                cognates.extend(found)
                continue
        strong = re.findall(r"<strong>(.*?)</strong>", part, re.S)
        if strong and " - " in plain and not plain.lower().startswith("kur'an"):
            label = clean(strong[0]).rstrip(":")
            if label and "türev" not in label.lower():
                notes.append(plain)
                continue
        if plain.lower().startswith("kur'an'da bu kökten"):
            continue
        meanings.append(plain)
    if not meanings and notes:
        meanings = [notes.pop(0)]
    return {
        "meanings": meanings,
        "derivativeNotes": notes,
        "turkishDerivatives": turkish,
        "cognates": cognates,
    }


def parse_lemmas(html: str) -> list[dict]:
    lemmas = []
    for count, form in re.findall(
        r'id="ContentPlaceHolder1_govdediz_sayLabel_\d+"[^>]*>(.*?)</span>\s*kez\s*'
        r'<span id="ContentPlaceHolder1_govdediz_govdeLabel_\d+"[^>]*>(.*?)</span>',
        html,
        re.S,
    ):
        lemmas.append({"formArabic": clean(form), "count": int(clean(count) or "0")})
    return lemmas


def field(chunk: str, name: str) -> str:
    match = re.search(
        rf'id="ContentPlaceHolder1_kurandakiyerdata_{name}_\d+"[^>]*>(.*?)</span>',
        chunk,
        re.S,
    )
    return clean(match.group(1)) if match else ""


def parse_occurrences(html: str) -> list[dict]:
    parts = re.split(r'id="ContentPlaceHolder1_kurandakiyerdata_Label1_\d+"', html)
    occurrences: list[dict] = []
    for chunk in parts[1:]:
        lemma = clean(chunk.split("</span>", 1)[0])
        sura = field(chunk, "sure_noLabel")
        ayah = field(chunk, "ayet_noLabel")
        if not sura or not ayah:
            continue
        tags = [field(chunk, name) for name in GRAMMAR_FIELDS]
        tags = [tag for tag in tags if tag]
        grammar = build_grammar(tags, " ".join(tags))
        occ = {
            "lemmaFormArabic": lemma,
            "sura": int(sura),
            "ayah": int(ayah),
            "formInAyah": field(chunk, "arabicLabel"),
            "transliteration": field(chunk, "transliterasyonLabel"),
            "gloss": field(chunk, "turkceLabel"),
        }
        if grammar:
            occ["grammar"] = grammar
        verse_ar = field(chunk, "tekstLabel")
        verse_tr = field(chunk, "latinLabel")
        verse_mean = field(chunk, "yasar_nuri_ozturkLabel")
        if verse_ar:
            occ["verseArabic"] = verse_ar
        if verse_tr:
            occ["verseTransliteration"] = verse_tr
        if verse_mean:
            occ["verseMeaning"] = verse_mean
        occurrences.append(occ)
    return occurrences


def parse_root(html: str, root_id: str) -> dict:
    if "Server Error" in html and "kokarabLabel" not in html:
        raise RuntimeError(f"{root_id}: server error")
    header = {
        "latinName": span_by_id(html, "ContentPlaceHolder1_kokuzunLabel"),
        "lettersArabic": span_by_id(html, "ContentPlaceHolder1_kokarabLabel"),
        **parse_anlam(anlam_inner(html)),
    }
    total_text = span_by_id(html, "ContentPlaceHolder1_kelimesaylbl")
    occurrences = parse_occurrences(html)
    total = int(total_text) if total_text.isdigit() else len(occurrences)
    return {
        "id": root_id,
        **header,
        "totalOccurrencesInQuran": total,
        "lemmas": parse_lemmas(html),
        "occurrences": occurrences,
        "sourceUrl": f"https://kuranharitasi.com/kokler.aspx?kok={urllib.parse.quote(root_id)}",
    }


def index_entry(root: dict) -> dict:
    preview = root["meanings"][0] if root["meanings"] else root["latinName"]
    if len(preview) > 80:
        preview = preview[:77] + "…"
    return {
        "id": root["id"],
        "latinName": root["latinName"],
        "lettersArabic": root["lettersArabic"],
        "totalOccurrencesInQuran": root["totalOccurrencesInQuran"],
        "lemmaCount": len(root["lemmas"]),
        "meaningsPreview": preview,
    }


def write_index(entries: list[dict]) -> None:
    entries = sorted(entries, key=lambda item: (item["latinName"] or item["id"]).lower())
    index = {
        "version": "0.2.0",
        "source": "https://kuranharitasi.com",
        "notes": "Ayrı proje: Desktop/KuranHaritasi. Detaylar roots/{id}.json.",
        "roots": entries,
    }
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def root_path(root_id: str) -> Path:
    return OUT_DIR / f"{root_filename(root_id)}.json"


def read_root_id(path: Path) -> str:
    with path.open(encoding="utf-8") as handle:
        head = handle.read(240)
    match = re.search(r'"id": "([^"]+)"', head)
    if not match:
        raise RuntimeError(f"id missing in {path.name}")
    return match.group(1)


def entry_from_file(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        buf = handle.read(250_000)
    cut = buf.find('"occurrences":')
    if cut < 0:
        root = json.loads(path.read_text(encoding="utf-8"))
    else:
        head = buf[:cut].rstrip().rstrip(",") + "\n}"
        root = json.loads(head)
    return index_entry(root)


def normalize_existing_files() -> None:
    for path in list(OUT_DIR.glob("*.json")):
        root_id = read_root_id(path)
        target = root_path(root_id)
        if path.name == target.name:
            continue
        if target.exists():
            raise RuntimeError(f"filename collision {path.name} -> {target.name}")
        path.rename(target)
        print(f"renamed {path.name} -> {target.name}", flush=True)


def seed_entries() -> dict[str, dict]:
    entries: dict[str, dict] = {}
    for path in OUT_DIR.glob("*.json"):
        root_id = read_root_id(path)
        entries[root_id] = entry_from_file(path)
    return entries


def fetch_one(root_id: str) -> dict:
    html = http_get(f"{BASE}?kok={urllib.parse.quote(root_id)}")
    root = parse_root(html, root_id)
    root_path(root_id).write_text(json.dumps(root, ensure_ascii=False, indent=2), encoding="utf-8")
    missing = root["totalOccurrencesInQuran"] - len(root["occurrences"])
    if missing:
        print(
            f"WARN {root_id}: listed {len(root['occurrences'])} expected {root['totalOccurrencesInQuran']}",
            flush=True,
        )
    return index_entry(root)


def main() -> int:
    only = sys.argv[1:]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if only and only[0] == "--discover":
        ids = discover_root_ids()
        path = ROOT / "content" / "root-ids.json"
        path.write_text(json.dumps(ids, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"discovered {len(ids)} -> {path}")
        return 0

    ids_path = ROOT / "content" / "root-ids.json"
    if only:
        ids = only
    elif ids_path.exists():
        ids = json.loads(ids_path.read_text(encoding="utf-8"))
    else:
        ids = discover_root_ids()
        ids_path.write_text(json.dumps(ids, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"discovered {len(ids)}", flush=True)

    normalize_existing_files()
    entries = seed_entries()
    pending = [root_id for root_id in ids if root_id not in entries]
    print(f"pending {len(pending)} / {len(ids)}", flush=True)
    done = 0
    failed: list[str] = []

    def drain(batch: list[str]) -> list[str]:
        nonlocal done
        again: list[str] = []
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(fetch_one, root_id): root_id for root_id in batch}
            for future in as_completed(futures):
                root_id = futures[future]
                try:
                    entries[root_id] = future.result()
                    done += 1
                    if done % 25 == 0 or done == len(pending):
                        print(f"fetched {done}/{len(pending)}", flush=True)
                        write_index(list(entries.values()))
                except Exception as exc:  # noqa: BLE001 - keep the batch moving
                    again.append(root_id)
                    print(f"FAIL {root_id}: {exc}", flush=True)
        return again

    failed = drain(pending)
    if failed:
        print(f"retrying {len(failed)}", flush=True)
        time.sleep(3)
        failed = drain(failed)
    write_index(list(entries.values()))
    print(f"done fetched={done} failed={len(failed)} index={len(entries)}")
    if failed:
        (ROOT / "content" / "fetch-failures.txt").write_text("\n".join(failed), encoding="utf-8")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

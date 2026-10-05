import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

DIAC = re.compile(r"[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]")

CACHE = "scripts/_en_cache"
OUT = "content/gloss-en.json"
os.makedirs(CACHE, exist_ok=True)


def fold(value, mode):
    text = str(value or "").replace("\u0640", "")
    text = text.replace("ى\u0670", "ا").replace("و\u0670", "ا").replace("\u0670", "ا")
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
    if mode != "strict":
        text = text.replace("ؤ", "").replace("ئ", "").replace("ء", "")
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = DIAC.sub("", text)
    text = "".join(text.split())
    text = re.sub(r"ا{2,}", "ا", text)
    if mode != "strict" and text.endswith("وا"):
        text = text[:-1]
    return text


def plain(value):
    text = str(value or "")
    if ">" in text:
        text = text[text.rfind(">") + 1 :]
    out = []
    skip = False
    for ch in text:
        if ch == "<":
            skip = True
        elif ch == ">":
            skip = False
        elif not skip:
            out.append(ch)
    return " ".join("".join(out).split())


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "KuranHaritasi/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def fetch_chapter(number):
    path = os.path.join(CACHE, f"{number}.json")
    if os.path.exists(path) and os.path.getsize(path) > 2:
        return number
    page = 1
    verses = []
    while True:
        url = (
            "https://api.quran.com/api/v4/verses/by_chapter/"
            f"{number}?language=en&words=true&per_page=50&page={page}"
            "&word_fields=text_uthmani,translation"
        )
        data = get_json(url)
        verses.extend(data["verses"])
        nxt = data.get("pagination", {}).get("next_page")
        if not nxt:
            break
        page = nxt
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(verses, handle, ensure_ascii=False)
    print("chapter", number, "verses", len(verses), flush=True)
    return number


def words_of(verse):
    rows = []
    for word in verse.get("words") or []:
        if word.get("char_type_name") != "word":
            continue
        translation = word.get("translation") or {}
        text = translation.get("text") if isinstance(translation, dict) else str(translation or "")
        rows.append({"text": word.get("text_uthmani") or "", "en": " ".join(str(text or "").split())})
    return rows


def choose(words, form):
    for mode in ("strict", "loose"):
        key = fold(form, mode)
        if not key:
            return None
        hits = [word for word in words if fold(word["text"], mode) == key and word["en"]]
        if hits:
            return hits[0]["en"]
    return None


def needed():
    pairs = []
    for name in os.listdir("content/roots"):
        if not name.endswith(".json"):
            continue
        root = json.load(open(os.path.join("content/roots", name), encoding="utf-8"))
        for item in root.get("occurrences") or []:
            form = plain(item.get("formInAyah"))
            if form:
                pairs.append((item["sura"], item["ayah"], form))
    for path, key in (("content/verbs.json", "verbs"), ("content/nouns.json", "nouns")):
        rows = json.load(open(path, encoding="utf-8"))[key]
        for item in rows:
            form = plain(item.get("formInAyah"))
            if form:
                pairs.append((item["sura"], item["ayah"], form))
    return pairs


def main():
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(fetch_chapter, number) for number in range(1, 115)]
        for fut in as_completed(futures):
            fut.result()
    by_verse = {}
    for number in range(1, 115):
        verses = json.load(open(os.path.join(CACHE, f"{number}.json"), encoding="utf-8"))
        for verse in verses:
            by_verse[verse["verse_key"]] = words_of(verse)
    book = {}
    missed = 0
    for sura, ayah, form in needed():
        key = f"{sura}:{ayah}\t{form}"
        if key in book:
            continue
        english = choose(by_verse.get(f"{sura}:{ayah}") or [], form)
        if english:
            book[key] = english
        else:
            missed += 1
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(book, handle, ensure_ascii=False, separators=(",", ":"))
    print("glosses", len(book), "missed", missed, flush=True)


if __name__ == "__main__":
    main()

"""One Turkish meal per verse, taken from root occurrences."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
meals = {}
for path in sorted((ROOT / "content" / "roots").glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data.get("occurrences") or []:
        sura = item.get("sura")
        ayah = item.get("ayah")
        meal = (item.get("verseMeaning") or "").strip()
        if not sura or not ayah or not meal:
            continue
        meals.setdefault(f"{sura}:{ayah}", meal)

ordered = dict(sorted(meals.items(), key=lambda item: tuple(int(part) for part in item[0].split(":"))))
out = ROOT / "content" / "meals.json"
out.write_text(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(ordered)} meals -> {out.name}")

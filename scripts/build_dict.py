"""Search text for the dictionary: full glosses and Turkish derivatives."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
entries = {}
for path in sorted((ROOT / "content" / "roots").glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    root_id = data.get("id")
    if not root_id:
        continue
    meanings = " ".join(part.strip() for part in (data.get("meanings") or []) if str(part).strip())
    derivatives = ", ".join(part.strip() for part in (data.get("turkishDerivatives") or []) if str(part).strip())
    entries[root_id] = [meanings, derivatives]

out = ROOT / "content" / "dict.json"
out.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(entries)} roots -> {out.name} ({out.stat().st_size} bytes)")

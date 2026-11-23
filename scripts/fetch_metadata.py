"""공공데이터포털 데이터 상세 페이지에서 공개 메타데이터만 옮겨 data/datasets.json 으로 저장.

- 읽는 곳: 각 데이터 상세 페이지(https://www.data.go.kr/data/<id>/<type>.do)의
  schema.org JSON-LD 블록 + '공간범위·시간범위·업데이트 주기·비용부과유무' 등 표 항목
- 값은 페이지에 적힌 그대로 저장. 비어 있으면 비어 있는 대로 둠(빈 칸 자체가 기획서의 문제의식).
- 원-윈도우 AI 검색 API 는 호출하지 않음.

사용: python -I scripts/fetch_metadata.py            (data/cache/*.json 이 있으면 재사용)
      python -I scripts/fetch_metadata.py --refresh  (모두 새로 받기)
"""
import sys, re, html, json, glob, os, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (metadata-demo)"}
CHECKED_AT = "2026-11-23"

LABELS = ["파일데이터명", "분류체계", "제공기관", "관리부서명", "업데이트 주기", "설명", "확장자",
          "키워드", "데이터 한계", "공간범위", "시간범위", "제공형태", "URL", "등록일", "수정일",
          "비용부과유무", "이용허락범위", "API 유형", "데이터포맷", "심의유형"]


def text(s):
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def fetch(i, t):
    url = f"https://www.data.go.kr/data/{i}/{t}.do"
    h = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "ignore")
    rec = {"id": i, "type": t, "url": url}
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    if m:
        ld = json.loads(m.group(1))
        rec.update({"name": ld.get("name"), "description": ld.get("description"),
                    "keywords": ld.get("keywords"), "publisher": (ld.get("creator") or {}).get("name"),
                    "free": ld.get("isAccessibleForFree"), "dateModified": ld.get("dateModified")})
    table = {}
    pat = (r'<strong class="key">(.*?)</strong>\s*<(?:div|span)[^>]*class="value[^"]*"[^>]*>(.*?)</(?:div|span)>'
           r'|<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>')
    for mm in re.finditer(pat, h, re.S):
        k = text(mm.group(1) or mm.group(3))
        v = text((mm.group(2) if mm.group(1) else mm.group(4)) or "")
        if k in LABELS and k not in table:
            table[k] = v
    rec["table"] = table
    return rec


def blank(v):
    v = (v or "").strip()
    return "" if v in ("", "-") else v


def main():
    ids = json.load(open(os.path.join(ROOT, "data", "dataset_ids.json"), encoding="utf-8"))
    cache = {}
    if "--refresh" not in sys.argv:
        for f in glob.glob(os.path.join(ROOT, "data", "cache", "*.json")):
            for r in json.load(open(f, encoding="utf-8")):
                if not r.get("error"):
                    cache[r["id"]] = r
    out = []
    for entry in ids:
        i, t = entry["id"], entry["type"]
        r = cache.get(i) or fetch(i, t)
        tb = r.get("table", {})
        out.append({
            "id": i,
            "portal": "공공데이터포털",
            "kind": "Open API" if t == "openapi" else "파일",
            "name": r.get("name"),
            "provider": r.get("publisher") or tb.get("제공기관"),
            "description": r.get("description") or tb.get("설명", ""),
            "keywords": [k.strip() for k in (r.get("keywords") or tb.get("키워드", "")).split(",") if k.strip()],
            "spatialRange": blank(tb.get("공간범위")),
            "temporalRange": blank(tb.get("시간범위")),
            "updateCycle": tb.get("업데이트 주기", ""),
            "cost": tb.get("비용부과유무") or ("무료" if r.get("free") else ""),
            "sourceUrl": tb.get("URL", ""),
            "modified": r.get("dateModified") or tb.get("수정일", ""),
            "url": r["url"],
            "checkedAt": CHECKED_AT,
        })
    json.dump(out, open(os.path.join(ROOT, "data", "datasets.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    empty = sum(1 for d in out if not d["spatialRange"] and not d["temporalRange"])
    print(f"datasets.json: {len(out)}건 저장 (공간·시간범위 모두 공란 {empty}건)")


if __name__ == "__main__":
    main()

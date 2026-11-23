// 결합축 추출: (1) 설명문에서 규칙(정규식)으로 1차 추출 → (2) 직접 판독본(axes_manual.json)과 합쳐 data/axes.json 저장.
// 직접 판독본의 근거 문장(evidence)은 설명문 원문에 글자 그대로 있어야 함. 없으면 실패(지어낸 근거 방지).
// 사용: node scripts/extract_axes.mjs   (npm run build 전에 자동 실행)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const datasets = read('data/datasets.json');
const manual = read('data/axes_manual.json');
const byId = Object.fromEntries(datasets.map((d) => [d.id, d]));

const RULES = {
  식별자: /(대여소\s?ID|대여소번호|관리번호|지점번호|역번호|코드집|법정동\s?코드|행정구역코드)/g,
  공간: /(위\s?·?\s?경도|경위도|위도|경도|[XY]좌표|좌표|시도|시군구|자치구|읍면동|행정동|법정동|지자체|반경\s?\d+\s?m|\d+여?개\s?지점|광역)/g,
  시간: /(\d+\s?분\s?단위|관측주기는\s?\d+분|시간자료|시간별|시간대별|일자료|일자별|일별|발생일자|월별|연도별|년도별|연간|기준년도|과거\s?\d+년간?|\d+년간)/g,
};

function autoExtract(text) {
  const out = {};
  for (const [axis, re] of Object.entries(RULES)) {
    const hits = [...new Set([...(text || '').matchAll(re)].map((m) => m[0].replace(/\s+/g, ' ')))];
    if (hits.length) out[axis] = hits;
  }
  return out;
}

const errors = [];
const items = {};
for (const d of datasets) {
  const auto = autoExtract(d.description);
  const axes = (manual[d.id] || []).map((a) => {
    const src = byId[a.evidenceFrom || d.id];
    if (a.evidence && !(src && src.description.includes(a.evidence))) {
      errors.push(`${d.id} ${a.key}: 근거 문장이 설명문 원문에 없음 → "${a.evidence}"`);
    }
    if (!['A', 'B', 'C'].includes(a.grade)) errors.push(`${d.id} ${a.key}: 등급 오류`);
    if (a.grade !== 'C' && !a.evidence) errors.push(`${d.id} ${a.key}: A·B 등급은 근거 문장 필요`);
    return { ...a, evidenceFrom: a.evidenceFrom || null };
  });
  items[d.id] = { auto, axes, method: axes.length ? '규칙 1차 추출 + 직접 판독' : '규칙 1차 추출만' };
}

// 화면 건수 = datasets.json 건수 확인: 모든 데이터가 후보·재료이거나 그 근거 문장의 출처여야 함
const recipes = read('data/recipes.json');
const shown = new Set();
for (const r of recipes) {
  for (const id of [...r.topics.flatMap((t) => t.ids), ...r.graphOnlyTopic.ids]) {
    if (!byId[id]) errors.push(`recipes ${r.id}: datasets.json 에 없는 ID ${id}`);
    shown.add(id);
    for (const a of manual[id] || []) if (a.evidenceFrom) shown.add(a.evidenceFrom);
  }
}
for (const d of datasets) if (!shown.has(d.id)) errors.push(`${d.id} ${d.name}: 화면 어디에도 나오지 않음 → 빼거나 후보에 넣을 것`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const out = {
  generatedFrom: 'data/datasets.json + data/axes_manual.json',
  gradeRule: {
    A: '코드·단위가 명시됨 (예: 대여소 ID, 지점번호, 역번호, 위경도, 5분 단위)',
    B: '단위만 있음 (예: 시군구별, 일자별, 시간별, 좌표계 없는 좌표)',
    C: '설명문에 없음 → 추정',
  },
  items,
};
writeFileSync(new URL('data/axes.json', root), JSON.stringify(out, null, 1));
const judged = Object.values(items).filter((i) => i.axes.length).length;
console.log(`axes.json: ${datasets.length}건 규칙 추출, ${judged}건 직접 판독(근거 문장 원문 대조 통과)`);

import './style.css';
import datasets from '../data/datasets.json';
import axesFile from '../data/axes.json';
import recipes from '../data/recipes.json';

const DS = Object.fromEntries(datasets.map((d) => [d.id, d]));
const AX = axesFile.items;
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
const TABS = [
  { key: 'now', label: '현행 검색', num: '①' },
  { key: 'split', label: '질문 분해만', num: '②' },
  { key: 'graph', label: '분해 + 결합 그래프', num: '③' },
];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const axis = (id, key) => (AX[id]?.axes || []).find((a) => a.key === key);
const shortName = (d) => d.name.replace(/^([^_]+)_\1_/, '$1_'); // '기상청_기상청_…' 중복 접두어만 정리

const state = { q: 'q1', tab: 'graph' };

function readHash() {
  const m = location.hash.match(/^#(q[123])(?:\/(now|split|graph))?$/);
  if (m) {
    state.q = m[1];
    if (m[2]) state.tab = m[2];
  }
}

/* ---------- 조각 ---------- */
function badge(id, key) {
  const a = axis(id, key);
  if (!a) return '';
  const tip = a.evidence ? `근거: “${a.evidence}”` : `근거 문장 없음 — ${a.note || '추정'}`;
  return `<span class="badge g${a.grade}" title="${esc(tip)}"><span class="ax">${esc(a.value)}</span><b>${a.grade}</b></span>`;
}

function kindTag(d) {
  return d.kind === 'Open API' ? 'Open API·인증키' : '파일';
}

function panelNow(r) {
  const c = r.current;
  return `
    <div class="measured">${esc(c.measured)}</div>
    <div class="searchbox" aria-label="검색어"><span class="mag" aria-hidden="true"></span>${esc(r.question)}</div>
    <ul class="now-lines">
      ${c.lines.map((l) => `<li class="${l.ok ? 'ok' : 'no'}">${esc(l.text)}</li>`).join('')}
    </ul>
    <div class="verdict">판정 <b>${esc(c.verdict)}</b></div>
    <p class="fine">기획서 근거①의 실측 요약을 그대로 옮김. 검색 결과 목록은 새로 만들어 넣지 않음.</p>`;
}

function exampleNote() {
  return `<div class="example-note">평가 설계를 보여 주는 예시 · 정확도·재현율 수치 아님</div>`;
}

function topicList(r, withSelection) {
  const groups = withSelection ? [...r.topics, r.graphOnlyTopic] : r.topics;
  return groups
    .map((t, gi) => {
      const extra = withSelection && gi === groups.length - 1;
      return `
      <div class="topic ${extra ? 'extra' : ''}">
        <div class="topic-h">${esc(t.name)} <span class="cnt">${t.ids.length}건</span></div>
        <ul>
          ${t.ids
            .map((id) => {
              const d = DS[id];
              const s = r.selection[id];
              if (!withSelection) {
                return `<li><a href="${d.url}" target="_blank" rel="noopener">${esc(shortName(d))}</a><span class="meta">${esc(d.provider)} · ${kindTag(d)}</span></li>`;
              }
              return `<li class="${s.pick ? 'pick' : 'drop'} ${s.highlight ? 'hl' : ''}">
                <span class="mark" aria-label="${s.pick ? '선택' : '제외'}">${s.pick ? '✓' : '✕'}</span>
                <span class="body"><a href="${d.url}" target="_blank" rel="noopener">${esc(shortName(d))}</a>
                <span class="why">${esc(s.why)}</span></span></li>`;
            })
            .join('')}
        </ul>
      </div>`;
    })
    .join('');
}

function panelSplit(r) {
  return `${exampleNote()}
    <p class="lead">질문을 주제로 나눠 주제마다 다시 검색한 후보 (공공데이터포털 등록 데이터)</p>
    ${topicList(r, false)}
    <div class="missing"><b>무엇을 골라 어떻게 붙일지</b>: 안내 없음</div>`;
}

function highlightBox(r) {
  const hs = Object.entries(r.selection).filter(([, s]) => s.highlight);
  if (!hs.length) return '';
  return `<div class="key-pick">
    <div class="kp-h">핵심 선택 — 결합축(공간·시간 해상도)으로 고름</div>
    ${hs
      .map(([id, s]) => {
        const d = DS[id];
        return `<div class="kp-row ${s.pick ? 'pick' : 'drop'}"><span class="mark">${s.pick ? '✓' : '✕'}</span><span><b>${esc(shortName(d))}</b> — ${esc(s.why)}</span></div>`;
      })
      .join('')}
  </div>`;
}

function recipeCard(r) {
  const c = r.card;
  const ing = c.ingredients
    .map((g, i) => {
      const d = DS[g.id];
      return `<div class="ing">
        <div class="ing-h"><span class="no">${CIRCLED[i]}</span><span>${esc(g.label)}&nbsp;<a class="src" href="${d.url}" target="_blank" rel="noopener" title="원천 페이지: ${esc(d.name)}" aria-label="원천 페이지 열기: ${esc(d.name)}">↗</a></span></div>
        <div class="ing-m">${esc(d.provider)} · ${kindTag(d)} · ${esc(d.cost || '확인 필요')}</div>
        <div class="badges">${g.badges.map((k) => badge(g.id, k)).join('')}</div>
      </div>`;
    })
    .join('');

  const rows = c.ingredients
    .flatMap((g, i) =>
      g.badges.map((k) => {
        const a = axis(g.id, k);
        if (!a) return '';
        const from = a.evidenceFrom ? ` <span class="from">(${esc(shortName(DS[a.evidenceFrom]))} 설명문)</span>` : '';
        return `<tr><td>${CIRCLED[i]}</td><td>${esc(a.axis)}</td><td>${esc(a.value)}</td><td><span class="gl g${a.grade}">${a.grade}</span></td>
          <td>${a.evidence ? `“${esc(a.evidence)}”${from}` : '<span class="none">근거 문장 없음</span>'}${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}</td></tr>`;
      }),
    )
    .join('');

  return `<article class="card" aria-label="결합 레시피 카드">
    <header class="card-h"><h3>${esc(c.title)}</h3><span class="grade-legend"><span class="gl gA">A</span>코드·단위 명시 <span class="gl gB">B</span>단위만 <span class="gl gC">C</span>추정</span></header>
    <div class="ing-grid">${ing}</div>
    ${highlightBox(r)}
    <section class="how">
      <h4>붙이는 법</h4>
      <p class="sum">${esc(c.summary)}</p>
      <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </section>
    <section class="warn">
      <h4>주의</h4>
      <ul>${c.cautions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      ${c.cautions.length > 3 ? `<div class="more">외 ${c.cautions.length - 3}건 · 붙이는 법 단계별 설명은 QR로 연 시연판에서 확인</div>` : ''}
    </section>
    <details class="evidence">
      <summary>축별 신뢰등급과 근거 문장 (설명문 원문 인용)</summary>
      <div class="tbl-wrap"><table>
        <thead><tr><th>재료</th><th>축</th><th>값</th><th>등급</th><th>근거</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </details>
    <footer class="card-f">
      <button type="button" class="copy" data-copy>레시피 링크 복사</button>
      <span class="fine">재료 이름 옆 ↗는 공공데이터포털 상세 페이지(원천 플랫폼)로 연결</span>
    </footer>
  </article>`;
}

function panelGraph(r) {
  return `${exampleNote()}
    ${recipeCard(r)}
    <details class="why-all">
      <summary>후보별 선택 이유 (②의 후보 + 결합 그래프가 더한 변환 수단)</summary>
      ${topicList(r, true)}
    </details>`;
}

/* ---------- 결합 그래프 (정적 SVG) ---------- */
function textW(s) {
  let w = 0;
  for (const ch of s) w += /[가-힣①-⑧→↔·]/.test(ch) ? 13.2 : 7.4;
  return w;
}

function graphSvg(r) {
  const g = r.graph;
  const N = Object.fromEntries(
    g.nodes.map((n) => {
      const w = Math.max(n.kind === 'axis' ? 84 : 120, textW(n.label) + (n.kind === 'conv' ? 22 : 26));
      return [n.id, { ...n, w, h: n.kind === 'axis' ? 30 : 34 }];
    }),
  );
  const edges = g.edges
    .map(([a, b, t]) => {
      const p = N[a], q = N[b];
      const line = `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="e ${t ? `e-${t}` : ''}"/>`;
      if (t !== 'unsure') return line;
      const mx = p.x + (q.x - p.x) * 0.75, my = p.y + (q.y - p.y) * 0.75;
      return `${line}<text x="${mx + 8}" y="${my + 4}" class="e-lab">좌표 확인 필요(C)</text>`;
    })
    .join('');
  const nodes = Object.values(N)
    .map((n) => {
      const x = n.x - n.w / 2, y = n.y - n.h / 2;
      const rx = n.kind === 'axis' ? n.h / 2 : 6;
      return `<g class="n n-${n.kind}"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${rx}"/><text x="${n.x}" y="${n.y + 4.5}">${esc(n.label)}</text></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${g.w} ${g.h + 20}" role="img" aria-label="결합 그래프: 데이터셋과 결합축, 변환표의 연결">
    <g transform="translate(0,10)">${edges}${nodes}</g></svg>`;
}

function graphSection(r) {
  return `<section class="graph-sec" aria-labelledby="gh">
    <div class="sec-h"><h2 id="gh">결합 그래프</h2><span class="fine">레시피 카드의 재료 번호와 같음 · 정적 그림</span></div>
    <div class="legend">
      <span><i class="lg lg-data"></i>데이터셋</span><span><i class="lg lg-axis"></i>결합축</span><span><i class="lg lg-conv"></i>변환표(재료로 추가)</span>
      <span><i class="lg lg-line"></i>데이터가 가진 축</span><span><i class="lg lg-dash"></i>변환표로 잇는 축</span>
      ${r.graph.edges.some((e) => e[2] === 'unsure') ? '<span><i class="lg lg-unsure"></i>메타데이터로 확인 안 된 연결</span>' : ''}
    </div>
    <div class="svg-wrap">${graphSvg(r)}</div>
  </section>`;
}

/* ---------- 메타데이터 표 ---------- */
function metaSection(r) {
  const ids = [...new Set([...r.topics.flatMap((t) => t.ids), ...r.graphOnlyTopic.ids])];
  const empty = ids.filter((id) => !DS[id].spatialRange && !DS[id].temporalRange).length;
  const cell = (v) => (v ? esc(v) : '<span class="blank">공란</span>');
  return `<section class="meta-sec" aria-labelledby="mh">
    <div class="sec-h"><h2 id="mh">이 질문에 쓴 공개 메타데이터 ${ids.length}건</h2>
      <span class="fine">공간범위·시간범위 칸이 둘 다 공란: <b>${empty}건</b> — 원천 포털 표기 그대로 (${esc(datasets[0].checkedAt)} 확인)</span></div>
    <div class="tbl-wrap"><table class="meta">
      <thead><tr><th>데이터명</th><th>제공기관</th><th>유형</th><th>공간범위</th><th>시간범위</th><th>선택</th></tr></thead>
      <tbody>${ids
        .map((id) => {
          const d = DS[id], s = r.selection[id];
          return `<tr><td><a href="${d.url}" target="_blank" rel="noopener">${esc(shortName(d))}</a></td><td>${esc(d.provider)}</td><td>${esc(d.kind)}</td><td>${cell(d.spatialRange)}</td><td>${cell(d.temporalRange)}</td><td>${s.pick ? '<span class="pk">재료</span>' : '<span class="dp">후보</span>'}</td></tr>`;
        })
        .join('')}</tbody>
    </table></div>
  </section>`;
}

/* ---------- 화면 ---------- */
function render() {
  const r = recipes.find((x) => x.id === state.q);
  const app = document.getElementById('app');
  app.innerHTML = `
  <header class="top">
    <div>
      <h1>데이터 결합 레시피 <span class="tag">시연판</span></h1>
      <p class="sub">질문 하나로 ‘같이 쓸 데이터’와 ‘붙이는 법’까지 · 공개 메타데이터 ${datasets.length}건 · 레시피 ${recipes.length}종</p>
    </div>
  </header>

  <nav class="qpick" aria-label="시연 질문 고르기">
    ${recipes.map((x, i) => `<button type="button" data-q="${x.id}" aria-pressed="${x.id === state.q}"><span class="qn">질문 ${CIRCLED[i]}</span>${esc(x.short)}</button>`).join('')}
  </nav>

  <section class="ask">
    <span class="who">질문</span><p>“${esc(r.question)}”</p><span class="scope">${esc(r.scope)}</span>
  </section>

  <div class="compare">
    <div class="tabs" role="tablist" aria-label="같은 질문, 세 조건">
      ${TABS.map((t) => `<button type="button" role="tab" id="tab-${t.key}" data-tab="${t.key}" aria-controls="p-${t.key}" aria-selected="${state.tab === t.key}"><span class="tn">${t.num}</span>${t.label}</button>`).join('')}
    </div>
    <div class="panels">
      <section class="panel p-now" id="p-now" role="tabpanel" aria-labelledby="tab-now" ${state.tab === 'now' ? '' : 'data-hidden'}>${panelNow(r)}</section>
      <section class="panel p-split" id="p-split" role="tabpanel" aria-labelledby="tab-split" ${state.tab === 'split' ? '' : 'data-hidden'}>${panelSplit(r)}</section>
      <section class="panel p-graph" id="p-graph" role="tabpanel" aria-labelledby="tab-graph" ${state.tab === 'graph' ? '' : 'data-hidden'}>${panelGraph(r)}</section>
    </div>
  </div>

  ${graphSection(r)}
  ${metaSection(r)}

  <footer class="foot">
    <p><b>공모전 제안 시연판</b> — 공개 메타데이터로 구성한 예시이며 원-윈도우 공식 서비스가 아님. 원-윈도우 AI 검색 API는 호출하지 않았음.</p>
    <p>재료 정보: 공공데이터포털 데이터 상세 페이지의 공개 메타데이터(데이터명·제공기관·설명문·키워드·공간/시간범위) ${datasets.length}건을 옮겨 적음 (${esc(datasets[0].checkedAt)} 확인). ‘현행 검색’ 탭은 기획서 근거①의 2026.11.20 실측 요약.</p>
    <p>신뢰등급: A ${esc(axesFile.gradeRule.A)} / B ${esc(axesFile.gradeRule.B)} / C ${esc(axesFile.gradeRule.C)}. 결합축은 설명문에서 규칙(정규식)으로 1차 추출한 뒤 직접 판독했고, 근거 문장은 설명문 원문과 대조함.</p>
    <p>분석·추적 스크립트, 외부 글꼴, 로그인 없음.</p>
  </footer>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) {
    state.q = q.dataset.q;
    history.replaceState(null, '', `#${state.q}`);
    render();
    return;
  }
  const t = e.target.closest('[data-tab]');
  if (t) {
    state.tab = t.dataset.tab;
    history.replaceState(null, '', `#${state.q}/${state.tab}`);
    render();
    document.getElementById(`tab-${state.tab}`)?.focus();
    return;
  }
  const c = e.target.closest('[data-copy]');
  if (c) {
    const url = `${location.href.split('#')[0]}#${state.q}`;
    const done = () => { c.textContent = '복사됨'; setTimeout(() => (c.textContent = '레시피 링크 복사'), 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('링크를 복사하세요', url));
    else prompt('링크를 복사하세요', url);
  }
});

document.addEventListener('keydown', (e) => {
  const t = e.target.closest?.('[role="tab"]');
  if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const i = TABS.findIndex((x) => x.key === t.dataset.tab);
  const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
  state.tab = n.key;
  render();
  document.getElementById(`tab-${n.key}`)?.focus();
});

window.addEventListener('hashchange', () => { readHash(); render(); });
if (new URLSearchParams(location.search).has('capture')) document.documentElement.classList.add('capture');

// 상단 고정 문구가 좁은 화면에서 두 줄이 되어도 탭이 그 아래에 붙도록 높이를 반영
const bar = document.querySelector('.notice-bar');
const syncBar = () => document.documentElement.style.setProperty('--nb', `${bar.offsetHeight}px`);
window.addEventListener('resize', syncBar);
syncBar();

readHash();
render();

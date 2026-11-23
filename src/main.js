import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';
import datasets from '../data/datasets.json';
import axesFile from '../data/axes.json';
import recipes from '../data/recipes.json';

const DS = Object.fromEntries(datasets.map((d) => [d.id, d]));
const AX = axesFile.items;
const CHECKED = datasets[0].checkedAt.replaceAll('-', '.');
const pad = (n) => String(n).padStart(2, '0');
const CIRCLED = '①②③④⑤⑥⑦⑧';
const TABS = [
  { key: 'now', n: 1, label: '현행 검색', cap: '2026.11.20 실측' },
  { key: 'split', n: 2, label: '질문 분해만', cap: '평가 설계 예시 · 성능 수치 아님' },
  { key: 'graph', n: 3, label: '분해 + 결합 그래프', cap: '평가 설계 예시 · 성능 수치 아님' },
];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const axis = (id, key) => (AX[id]?.axes || []).find((a) => a.key === key);
const shortName = (d) => d.name.replace(/^([^_]+)_\1_/, '$1_'); // '기상청_기상청_…' 중복 접두어만 정리
const kind = (d) => (d.kind === 'Open API' ? 'Open API · 인증키' : '파일');
const ext = (d, text, cls = '') =>
  `<a class="${cls}" href="${d.url}" target="_blank" rel="noopener" title="${esc(d.name)} — 공공데이터포털">${text}</a>`;

// 화면에 실제로 나오는 데이터: 후보·재료 + 그들의 근거 문장을 빌려 온 데이터(evidenceFrom)
function idsFor(r) {
  const base = [...r.topics.flatMap((t) => t.ids), ...r.graphOnlyTopic.ids];
  const src = base.flatMap((id) => (AX[id]?.axes || []).map((a) => a.evidenceFrom).filter(Boolean));
  return [...new Set([...base, ...src])];
}
const SHOWN_N = new Set(recipes.flatMap(idsFor)).size;

const state = { q: 'q1', tab: 'graph' };

function readHash() {
  const m = location.hash.match(/^#(q[123])(?:\/(now|split|graph))?$/);
  if (m) {
    state.q = m[1];
    if (m[2]) state.tab = m[2];
  }
}

/* ---------- 작은 조각 ---------- */
const grade = (g) => `<i class="gr gr-${g}" aria-label="신뢰등급 ${g}">${g}</i>`;

function tag(id, key) {
  const a = axis(id, key);
  if (!a) return '';
  const tip = a.evidence ? `근거: “${a.evidence}”` : `근거 문장 없음 — ${a.note || '추정'}`;
  return `<span class="tag" title="${esc(tip)}">${esc(a.value)}${grade(a.grade)}</span>`;
}

function headline(r, t) {
  if (t.key === 'now') return '같이 쓸 데이터·붙이는 법 <em>없음</em>';
  if (t.key === 'split') {
    const n = r.topics.reduce((s, x) => s + x.ids.length, 0);
    return `후보 ${n}건 · 고르는 기준 <em>없음</em>`;
  }
  return `재료 ${r.card.ingredients.length}종 · 결합 키 <b>${r.card.joinKey.map(esc).join(' + ')}</b>`;
}

/* ---------- 조건 1: 현행 ---------- */
function panelNow(r) {
  const c = r.current;
  return `
    <div class="search"><span class="mag" aria-hidden="true"></span><span>${esc(r.question)}</span></div>
    <ol class="miss">${c.lines.map((l) => `<li><span class="x" aria-hidden="true"></span>${esc(l.text)}</li>`).join('')}</ol>
    <dl class="verdict"><dt>판정</dt><dd>${esc(c.verdict)}</dd></dl>
    <p class="note">기획서 근거① 실측 요약을 그대로 옮김.<br>검색 결과 목록은 새로 만들어 넣지 않음.</p>`;
}

/* ---------- 조건 2: 분해만 ---------- */
function panelSplit(r) {
  return `
    <p class="lede">주제마다 다시 검색한 후보 · 공공데이터포털 등록 데이터</p>
    ${r.topics
      .map(
        (t) => `<section class="topic">
        <h4>${esc(t.name)}<span>${t.ids.length}</span></h4>
        <ul>${t.ids.map((id) => `<li>${ext(DS[id], esc(shortName(DS[id])))}<small>${esc(DS[id].provider)} · ${kind(DS[id])}</small></li>`).join('')}</ul>
      </section>`,
      )
      .join('')}
    <p class="gap"><span>어떤 걸 골라 어떻게 붙일지</span><b>안내 없음</b></p>`;
}

/* ---------- 조건 3: 레시피 카드 ---------- */
function recipeCard(r, idx) {
  const c = r.card;
  const picks = Object.entries(r.selection).filter(([, s]) => s.highlight).sort((a, b) => b[1].pick - a[1].pick);
  const rows = c.ingredients
    .flatMap((g, i) =>
      g.badges.map((k) => {
        const a = axis(g.id, k);
        if (!a) return '';
        const from = a.evidenceFrom ? `<span class="from"> — ${esc(shortName(DS[a.evidenceFrom]))} 설명문</span>` : '';
        return `<tr><td><span class="num">${i + 1}</span></td><td>${esc(a.axis)}</td><td>${esc(a.value)}</td><td>${grade(a.grade)}</td>
          <td>${a.evidence ? `“${esc(a.evidence)}”${from}` : '<span class="none">근거 문장 없음</span>'}${a.note ? `<div class="aside">${esc(a.note)}</div>` : ''}</td></tr>`;
      }),
    )
    .join('');

  return `<article class="recipe" aria-label="결합 레시피 카드">
    <header class="r-head">
      <div><span class="kicker">RECIPE ${pad(idx + 1)}</span><h3>${esc(c.title.replace(/\s*·\s*재료.*$/, ''))}</h3></div>
      <div class="r-count"><b>${c.ingredients.length}</b><span>재료</span></div>
    </header>

    <div class="key">
      <span class="key-l">결합 키</span>
      <span class="key-v">${c.joinKey.map((k) => `<b>${esc(k)}</b>`).join('<i>+</i>')}</span>
      <span class="key-s">${esc(c.summary)}</span>
    </div>

    <ol class="ings">
      ${c.ingredients
        .map((g, i) => {
          const d = DS[g.id];
          return `<li>
            <span class="num">${i + 1}</span>
            <div class="ing-b">
              <div class="ing-n">${esc(g.label)} ${ext(d, '↗', 'src')}</div>
              <div class="ing-m">${esc(d.provider)} · ${kind(d)} · ${esc(d.cost || '확인 필요')}</div>
              <div class="tags">${g.badges.map((k) => tag(g.id, k)).join('')}</div>
            </div>
          </li>`;
        })
        .join('')}
    </ol>

    ${
      picks.length
        ? `<div class="pick">
      <span class="sec-l">핵심 선택</span>
      <ul>${picks
        .map(([id, s]) => `<li class="${s.pick ? 'yes' : 'no'}"><span class="mk" aria-label="${s.pick ? '선택' : '제외'}"></span><div><b>${esc(shortName(DS[id]))}</b><span>${esc(s.why)}</span></div></li>`)
        .join('')}</ul>
    </div>`
        : ''
    }

    <div class="two">
      <section class="how"><span class="sec-l">붙이는 법</span>
        <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>
      <section class="warn"><span class="sec-l">주의</span>
        <ul>${c.cautions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        ${c.cautions.length > 3 ? `<p class="more">외 ${c.cautions.length - 3}건 · 단계별 설명과 근거 문장은 QR로 연 시연판에서 확인</p>` : ''}
      </section>
    </div>

    <details class="ev">
      <summary><span>축별 신뢰등급과 근거 문장</span><span class="legend">${grade('A')}코드·단위 명시 ${grade('B')}단위만 ${grade('C')}추정</span></summary>
      <div class="scroll"><table>
        <thead><tr><th>재료</th><th>축</th><th>값</th><th>등급</th><th>근거 (설명문 원문)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </details>

    <footer class="r-foot">
      <button type="button" data-copy>레시피 링크 복사</button>
      <span>재료 이름 옆 ↗ — 원천 플랫폼(공공데이터포털) 상세 페이지</span>
    </footer>
  </article>`;
}

function panelGraph(r, idx) {
  return `${recipeCard(r, idx)}
    <details class="why">
      <summary>후보별 선택 이유 <span>조건 2의 후보 + 결합 그래프가 더한 변환 수단</span></summary>
      ${[...r.topics, r.graphOnlyTopic]
        .map(
          (t, gi, all) => `<section class="topic ${gi === all.length - 1 ? 'conv' : ''}">
          <h4>${esc(t.name)}<span>${t.ids.length}</span></h4>
          <ul>${t.ids
            .map((id) => {
              const s = r.selection[id];
              return `<li class="${s.pick ? 'yes' : 'no'}"><span class="mk" aria-label="${s.pick ? '선택' : '제외'}"></span><div>${ext(DS[id], esc(shortName(DS[id])))}<small>${esc(s.why)}</small></div></li>`;
            })
            .join('')}</ul>
        </section>`,
        )
        .join('')}
    </details>`;
}

/* ---------- 결합 그래프 (정적 SVG) ---------- */
function textW(s) {
  let w = 0;
  for (const ch of s) w += /[가-힣①-⑧→↔·]/.test(ch) ? 13 : 7.6;
  return w;
}

function graphSvg(r) {
  const g = r.graph;
  const N = Object.fromEntries(
    g.nodes.map((n) => {
      const label = n.kind === 'data' ? n.label.replace(/^[①-⑧]\s*/, '') : n.label;
      const no = n.kind === 'data' ? n.label.match(/^([①-⑧])/)?.[1] : null;
      const w = Math.max(n.kind === 'axis' ? 86 : 132, textW(label) + (n.kind === 'data' ? 48 : 28));
      return [n.id, { ...n, label, no, w, h: n.kind === 'axis' ? 30 : 36 }];
    }),
  );
  const edges = g.edges
    .map(([a, b, t]) => {
      const p = N[a], q = N[b];
      const line = `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="e ${t ? `e-${t}` : ''}"/>`;
      if (t !== 'unsure') return line;
      const mx = p.x + (q.x - p.x) * 0.75, my = p.y + (q.y - p.y) * 0.75;
      return `${line}<text x="${mx + 9}" y="${my + 4}" class="e-lab">좌표 확인 필요 (C)</text>`;
    })
    .join('');
  const nodes = Object.values(N)
    .map((n) => {
      const x = n.x - n.w / 2, y = n.y - n.h / 2;
      if (n.kind === 'data') {
                return `<g class="n n-data"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="3"/>
          <circle cx="${x + 19}" cy="${n.y}" r="9" class="nc"/><text x="${x + 19}" y="${n.y + 4}" class="nn">${n.no ? CIRCLED.indexOf(n.no) + 1 : ''}</text>
          <text x="${x + 34}" y="${n.y + 4.5}" class="nl">${esc(n.label)}</text></g>`;
      }
      const rx = n.kind === 'axis' ? n.h / 2 : 3;
      return `<g class="n n-${n.kind}"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${rx}"/><text x="${n.x}" y="${n.y + 4.5}">${esc(n.label)}</text></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${g.w} ${g.h + 20}" role="img" aria-label="결합 그래프: 데이터셋과 결합축, 변환표의 연결">
    <g transform="translate(0,10)">${edges}${nodes}</g></svg>`;
}

function graphSection(r) {
  const unsure = r.graph.edges.some((e) => e[2] === 'unsure');
  return `<section class="block" aria-labelledby="gh">
    <header class="block-h">
      <h2 id="gh">결합 그래프</h2>
      <p>데이터셋과 결합축을 잇고, 축이 다르면 변환표를 재료로 더함. 번호는 레시피 카드와 같음.</p>
    </header>
    <ul class="key-legend">
      <li><i class="k-data"></i>데이터셋</li><li><i class="k-axis"></i>결합축</li><li><i class="k-conv"></i>변환표</li>
      <li><i class="k-line"></i>데이터가 가진 축</li><li><i class="k-dash"></i>변환표로 잇는 축</li>
      ${unsure ? '<li><i class="k-dot"></i>메타데이터로 확인 안 된 연결</li>' : ''}
    </ul>
    <div class="graph">${graphSvg(r)}</div>
  </section>`;
}

/* ---------- 메타데이터 표 ---------- */
function metaSection(r) {
  const ids = idsFor(r);
  const use = (s) => (!s ? '근거 인용' : s.pick ? '재료' : '후보');
  const empty = ids.filter((id) => !DS[id].spatialRange && !DS[id].temporalRange).length;
  const cell = (v) => (v ? esc(v) : '<span class="blank">공란</span>');
  return `<section class="block" aria-labelledby="mh">
    <header class="block-h">
      <h2 id="mh">이 질문에 쓴 공개 메타데이터</h2>
      <p class="stat"><b>${ids.length}</b>건 중 공간범위·시간범위가 모두 공란 <b class="acc">${empty}</b>건 <span>원천 포털 표기 그대로 · ${CHECKED} 확인</span></p>
    </header>
    <div class="scroll"><table class="meta">
      <thead><tr><th>데이터명</th><th>제공기관</th><th>유형</th><th>공간범위</th><th>시간범위</th><th>쓰임</th></tr></thead>
      <tbody>${ids
        .map((id) => {
          const d = DS[id], s = r.selection[id];
          return `<tr class="${s?.pick ? 'is-pick' : ''}"><td>${ext(d, esc(shortName(d)))}</td><td>${esc(d.provider)}</td><td>${esc(d.kind)}</td><td>${cell(d.spatialRange)}</td><td>${cell(d.temporalRange)}</td><td${s ? '' : ' title="후보 비교에 쓴 설명문 인용의 출처"'}>${use(s)}</td></tr>`;
        })
        .join('')}</tbody>
    </table></div>
  </section>`;
}

/* ---------- 화면 ---------- */
function render() {
  const idx = recipes.findIndex((x) => x.id === state.q);
  const r = recipes[idx];
  document.getElementById('app').innerHTML = `
  <header class="mast">
    <div class="brand"><h1>데이터 결합 레시피</h1><span>시연판</span></div>
    <p>공개 메타데이터 ${SHOWN_N}건 · 레시피 ${recipes.length}종 · ${CHECKED} 기준</p>
  </header>

  <nav class="qs" aria-label="시연 질문">
    ${recipes
      .map((x, i) => `<button type="button" data-q="${x.id}" aria-pressed="${x.id === state.q}"><span>${pad(i + 1)}</span>${esc(x.short)}</button>`)
      .join('')}
  </nav>

  <section class="hero">
    <span class="hero-l">질문 ${pad(idx + 1)}<em>${esc(r.scope)}</em></span>
    <p>${esc(r.question)}</p>
  </section>

  <div class="cmp" data-tab="${state.tab}">
    <div class="tabs" role="tablist" aria-label="같은 질문, 세 조건">
      ${TABS.map(
        (t) => `<button type="button" role="tab" id="tab-${t.key}" data-tab="${t.key}" aria-controls="p-${t.key}" aria-selected="${state.tab === t.key}">
          <span class="t-n">${t.n}</span><span class="t-l">${t.label}</span></button>`,
      ).join('')}
    </div>
    <div class="cols">
      ${TABS.map(
        (t) => `<section class="col col-${t.key}" id="p-${t.key}" role="tabpanel" aria-labelledby="tab-${t.key}" ${state.tab === t.key ? '' : 'data-hidden'}>
          <header class="col-h">
            <div class="col-t"><span class="t-n">${t.n}</span><h2>${t.label}</h2></div>
            <p class="col-c ${t.key === 'now' ? '' : 'ex'}">${t.cap}</p>
            <p class="col-r">${headline(r, t)}</p>
          </header>
          <div class="col-b">${t.key === 'now' ? panelNow(r) : t.key === 'split' ? panelSplit(r) : panelGraph(r, idx)}</div>
        </section>`,
      ).join('')}
    </div>
  </div>

  ${graphSection(r)}
  ${metaSection(r)}

  <footer class="foot">
    <div><b>공모전 제안 시연판</b><p>공개 메타데이터로 구성한 예시이며 원-윈도우 공식 서비스가 아님. 원-윈도우 AI 검색 API는 호출하지 않음.</p></div>
    <div><b>자료</b><p>공공데이터포털 상세 페이지의 공개 메타데이터 ${SHOWN_N}건(데이터명·제공기관·설명문·키워드·공간/시간범위, ${CHECKED} 확인). 조건 1은 기획서 근거①의 2026.11.20 실측 요약.<br>재료로 쓴 데이터는 모두 원-윈도우 검색으로 등록을 확인함(2026.11.23).</p></div>
    <div><b>신뢰등급</b><p>A ${esc(axesFile.gradeRule.A)}<br>B ${esc(axesFile.gradeRule.B)}<br>C ${esc(axesFile.gradeRule.C)}<br>설명문에서 규칙으로 1차 추출 후 직접 판독, 근거 문장은 원문과 대조.</p></div>
    <div><b>이 페이지</b><p>분석·추적 스크립트, 외부 요청, 로그인 없음.</p></div>
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
  const t = e.target.closest('button[data-tab]');
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
    const done = () => {
      c.textContent = '복사됨';
      setTimeout(() => (c.textContent = '레시피 링크 복사'), 1600);
    };
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

window.addEventListener('hashchange', () => {
  readHash();
  render();
});
if (new URLSearchParams(location.search).has('capture')) document.documentElement.classList.add('capture');

// 상단 고정 문구가 좁은 화면에서 두 줄이 되어도 탭이 그 아래에 붙도록 높이를 반영
const bar = document.querySelector('.notice-bar');
const syncBar = () => document.documentElement.style.setProperty('--nb', `${bar.offsetHeight}px`);
window.addEventListener('resize', syncBar);
syncBar();
readHash();
render();

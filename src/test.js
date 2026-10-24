// 자녀 증여 엔진 시험 — 기대값은 상속세 및 증여세법(2025-10-01 시행본)으로 손계산.
// rules.js는 페이지의 <script src> 버전을 읽어 위쪽 폴더의 허브 clone → 없으면 고정 주소 순으로 찾는다.
(function loadRules() {
  const fs = require('fs'), path = require('path');
  const page = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const rel = page.match(/rules\/v[\d.]+\/rules\.js/)[0];
  let src = null;
  for (let d = __dirname, i = 0; i < 6 && src === null; i++, d = path.dirname(d)) {
    const f = path.join(d, 'ttokjaetv.github.io', rel);
    if (fs.existsSync(f)) src = fs.readFileSync(f, 'utf8');
  }
  if (src === null) src = require('child_process').execFileSync(process.execPath, ['-e',
    `fetch('https://ttokjaetv.github.io/${rel}').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => process.stdout.write(t))`]).toString();
  const m = { exports: {} };
  new Function('module', 'exports', src)(m, m.exports);
  global.TTOKJAE_RULES = m.exports;
})();
const R = global.TTOKJAE_RULES;
const { sgGiftTax, sgOvTax, sgOvAdd, sgCalc, sgFin } = require('./engine.js');
const M = 1e4, E = 1e8;
let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (got !== want) { fail++; console.log(`✗ ${name}: ${got} (기대 ${want})`); } };
const P = o => ({ cost: 0, value: 0, sale: 0, prior: 0, otherMe: 0, otherSp: 0, ...o });

// 해외주식 양도세: (차익 − 250만) × 20% + 2%
eq('양도세 2억 차익', sgOvTax(2 * E, R), 43450000);
eq('양도세 250만 이하 0', sgOvTax(250 * M, R), 0);
eq('다른 이익 1천만 있을 때 1천만 더 → 220만', sgOvAdd(1000 * M, 1000 * M, R), 2200000);
eq('손실이면 0', sgOvAdd(-5000 * M, 0, R), 0);

// 증여세: 배우자 6억 공제, 10년 합산, 과세최저한, 신고세액공제 3%
eq('6억 이하 0', sgGiftTax(3 * E, 0, R).tax, 0);
eq('8억 → 과표 2억 → 3천만 × 0.97', sgGiftTax(8 * E, 0, R).tax, 29100000);
eq('이전 5억 + 이번 3억 → 같은 결과', sgGiftTax(3 * E, 5 * E, R).tax, 29100000);
eq('공제 남은 한도 = 6억 − 이전', sgGiftTax(1 * E, 5 * E, R).room, 1 * E);
eq('과표 40만 → 0', sgGiftTax(600400000, 0, R).tax, 0);
eq('이전 7억 + 이번 3억: 과표 4억 산출 7천만 − 이전(과표 1억) 1천만', sgGiftTax(3 * E, 7 * E, R).own, 60000000);

// 사례 1: 원가 1억, 평가 3억, 3억에 판매
let r = sgCalc(P({ cost: 1 * E, value: 3 * E, sale: 3 * E }), R);
eq('1 A 내가 팔면', r.A.total, 43450000);
eq('1 B 증여 후 1년 지나 → 0', r.B.total, 0);
eq('1 절세액', r.saveB, 43450000);
eq('1 C 1년 안 → 이월과세로 A와 같음', r.C.total, 43450000);
eq('1 C 이월과세 적용', r.C.carry, true);

// 사례 2: 원가 2억, 평가 8억 → 증여세 2,910만
r = sgCalc(P({ cost: 2 * E, value: 8 * E, sale: 8 * E }), R);
eq('2 A', r.A.total, 131450000);
eq('2 B = 증여세만', r.B.total, 29100000);
eq('2 C 필요경비 = 산출세액 3천만', r.C.giftExp, 30000000);
eq('2 C 양도세 (5.7억 − 250만) × 22%', r.C.cgt, 124850000);
eq('2 C 합계', r.C.total, 153950000);

// 사례 3: 이전 증여 5억 + 이번 3억 → 증여세 상당액은 산출세액을 금액 비율로 나눔
r = sgCalc(P({ cost: 1 * E, value: 3 * E, sale: 3 * E, prior: 5 * E }), R);
eq('3 증여세 상당액 3천만 × 3/8', r.C.giftExp, 11250000);

// 사례 4: 증여 뒤 값이 떨어져 평가액보다 싸게 팔면 배우자 양도세 0
r = sgCalc(P({ cost: 1 * E, value: 3 * E, sale: 2.5 * E }), R);
eq('4 B 0', r.B.cgt, 0);
eq('4 C 이월과세 (1.5억 − 250만) × 22%', r.C.cgt, 32450000);

// 사례 5: 내 원가가 평가액보다 높으면 이월과세 쪽이 세금이 적어 적용 안 함(제97조의2②3호)
r = sgCalc(P({ cost: 4 * E, value: 3 * E, sale: 3.5 * E }), R);
eq('5 이월과세 적용 안 함', r.C.carry, false);
eq('5 C = B 양도세', r.C.cgt, 10450000);

// 배당 나누기
const f = sgFin({ myFin: 3000 * M, spFin: 0, div: 1500 * M }, R);
eq('배당 옮긴 뒤 내 금융소득', f.meAfter, 1500 * M);
eq('옮기기 전 2천만 넘음', f.overBefore[0], true);
eq('옮긴 뒤 둘 다 안 넘음', f.overAfter[0] || f.overAfter[1], false);

console.log(fail ? `실패 ${fail}/${n}` : `ALL PASS (${n}개)`);
process.exit(fail ? 1 : 0);

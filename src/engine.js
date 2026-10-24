/* 배우자 증여 절세 엔진 — 해외주식을 배우자에게 증여한 뒤 배우자가 팔 때. 금액 원.
 * 제도 숫자는 rules.js(R.GIFT·R.OVERSEAS_STOCK·R.FIN_INCOME, v2026.3 이상)에서 읽는다.
 *
 * 세 가지를 비교한다 (양도세는 해당 연도의 다른 해외주식 손익과 합쳐 늘어나는 몫만 본다)
 *   A 그대로 내가 판다: 양도차익 = 매도금액 − 내 취득가액
 *   B 배우자에게 증여 → 1년 지나 배우자가 판다: 취득가액 = 증여 평가액(소득세법 시행령 제163조⑨)
 *   C 배우자에게 증여 → 1년 안에 배우자가 판다: 이월과세(소득세법 제97조의2, 주식은 2025-01-01 이후 증여분)
 *     취득가액 = 내 취득가액, 증여세 상당액은 필요경비(시행령 제163조의2②: 산출세액 × 이 자산 ÷ 과세가액, 한도 = 차익)
 *     이월과세로 계산한 세금이 적용 안 한 세금보다 적으면 적용하지 않는다(제97조의2②3호) → 둘 중 큰 쪽
 *   증여세(상속세 및 증여세법): 배우자 공제 10년 합계(제53조), 10년 합산(제47조②)·이전 산출세액 공제(제58조),
 *     과세최저한(제55조②), 신고세액공제(제69조②). 이월과세가 적용돼도 증여세는 그대로 낸다.
 */
function sgGiftCalc(base, R) {
  if (!(base > 0)) return 0;
  for (const [lim, rate, ded] of R.GIFT.brackets) if (base <= lim) return Math.floor(base * rate - ded);
  return 0;
}
function sgGiftBase(agg, R) {
  const b = Math.max(0, agg - R.GIFT.deductionSpouse);
  return b < R.GIFT.minTaxBase ? 0 : b;
}

/* 이번 증여 value (10년 안 이전 증여 prior) → 증여세 */
function sgGiftTax(value, prior, R) {
  const agg = value + prior;
  const base = sgGiftBase(agg, R), calc = sgGiftCalc(base, R);
  const prev = Math.min(calc, sgGiftCalc(sgGiftBase(prior, R), R));   // 이전 증여를 따로 신고했을 때의 산출세액
  const own = calc - prev, credit = Math.floor(own * R.GIFT.filingCreditRate);
  return { agg, ded: Math.min(R.GIFT.deductionSpouse, agg), base, calc, prev, own, credit, tax: own - credit,
    room: Math.max(0, R.GIFT.deductionSpouse - prior) };
}

/* 해외주식 양도세 — 연간 양도차익 합계 gain에 대해 */
function sgOvTax(gain, R) {
  const O = R.OVERSEAS_STOCK, base = Math.max(0, gain - O.basicDeduction);
  return Math.floor(base * O.rateNational) + Math.floor(base * O.rateLocal);
}
/* 다른 손익 other가 있을 때 이 거래 gain이 늘리는 세금 */
const sgOvAdd = (gain, other, R) => sgOvTax(gain + other, R) - sgOvTax(other, R);

/* p = { cost, value, sale, prior, otherMe, otherSp } */
function sgCalc(p, R) {
  const g = sgGiftTax(p.value, p.prior, R);
  const gainA = p.sale - p.cost, taxA = sgOvAdd(gainA, p.otherMe, R);
  const gainB = p.sale - p.value, taxB = sgOvAdd(gainB, p.otherSp, R);
  // 이월과세
  const giftExpRaw = g.agg > 0 ? Math.floor(g.calc * p.value / g.agg) : 0;
  const giftExp = Math.max(0, Math.min(giftExpRaw, p.sale - p.cost));
  const gainC = p.sale - p.cost - giftExp, taxC1 = sgOvAdd(gainC, p.otherSp, R);
  const carry = taxC1 >= taxB;                       // 제97조의2②3호
  const taxC = carry ? taxC1 : taxB;
  const A = { gain: gainA, cgt: taxA, gift: 0, total: taxA };
  const B = { gain: gainB, cgt: taxB, gift: g.tax, total: g.tax + taxB };
  const C = { gain: carry ? gainC : gainB, cgt: taxC, gift: g.tax, total: g.tax + taxC, carry, giftExp };
  return { gift: g, A, B, C, saveB: A.total - B.total, saveC: A.total - C.total };
}

/* 배당 나누기: 증여한 주식의 연 배당 div가 내 금융소득에서 배우자 금융소득으로 옮겨감 */
function sgFin(o, R) {
  const th = R.FIN_INCOME.threshold;
  const meBefore = Math.max(0, o.myFin), spBefore = Math.max(0, o.spFin), div = Math.max(0, Math.min(o.div, meBefore));
  const meAfter = meBefore - div, spAfter = spBefore + div;
  return { th, div, meBefore, meAfter, spBefore, spAfter,
    overBefore: [meBefore > th, spBefore > th], overAfter: [meAfter > th, spAfter > th] };
}

if (typeof module !== 'undefined') module.exports = { sgGiftCalc, sgGiftTax, sgOvTax, sgOvAdd, sgCalc, sgFin };

let WORDS = {};

const BASE = {};
("あ a い i う u え e お o か ka き ki く ku け ke こ ko さ sa し shi|si す su せ se そ so " +
  "た ta ち chi|ti つ tsu|tu て te と to な na に ni ぬ nu ね ne の no は ha ひ hi ふ fu|hu へ he ほ ho " +
  "ま ma み mi む mu め me も mo や ya ゆ yu よ yo ら ra り ri る ru れ re ろ ro わ wa を wo " +
  "が ga ぎ gi ぐ gu げ ge ご go ざ za じ ji|zi ず zu ぜ ze ぞ zo だ da ぢ di づ du で de ど do " +
  "ば ba び bi ぶ bu べ be ぼ bo ぱ pa ぴ pi ぷ pu ぺ pe ぽ po").split(" ")
  .forEach((v, i, a) => { if (i % 2 === 0) BASE[v] = a[i + 1].split("|"); });
const YSTEM = { "し": ["sh", "sy"], "ち": ["ch", "ty", "cy"], "じ": ["j", "jy", "zy"] };
const YV = { "ゃ": "a", "ゅ": "u", "ょ": "o" };

function toHira(str) {
  return [...str].map(c => { const n = c.charCodeAt(0); return n >= 0x30A1 && n <= 0x30F6 ? String.fromCharCode(n - 0x60) : c; }).join("");
}
function buildCandidates(kana) {
  const h = [...toHira(kana.normalize("NFKC").replace(/、/g, ",").replace(/。/g, ".").toLowerCase())], toks = [];
  let small = false;
  for (let i = 0; i < h.length; i++) {
    const c = h[i];
    if (c === "っ") { small = true; continue; }
    let t;
    if (c === "ー") {
      t = { opts: ["-"] };
    } else if (c === "ん") {
      t = { n: true };
    } else if (YV[h[i + 1]] && BASE[c]) {
      const stems = YSTEM[c] || [BASE[c][0].replace(/i$/, "") + "y"];
      t = { opts: stems.map(st => st + YV[h[i + 1]]) }; i++;
    } else {
      t = { opts: BASE[c] || [c] };
    }
    if (small && t.opts) {
      const o2 = [];
      t.opts.forEach(o => { if (/^[bcdfghjklmpqrstvwxyz]/.test(o)) o2.push(o[0] + o); });
      t.opts.forEach(o => { o2.push("xtu" + o, "ltu" + o, "xtsu" + o, "ltsu" + o); });
      t = { opts: o2 }; small = false;
    }
    toks.push(t);
  }
  let res = [""];
  toks.forEach((t, i) => {
    let opts = t.opts;
    if (t.n) {
      const nx = toks[i + 1];
      const plain = !nx || (nx.opts && nx.opts.every(o => !/^[aiueoy]/.test(o)));
      opts = plain ? ["n", "nn", "xn"] : ["nn", "xn"];
    }
    const next = [];
    res.forEach(r => opts.forEach(o => next.push(r + o)));
    res = next;
  });
  return [...new Set(res)];
}
let cands = [], typed = "";
const TOTAL = 60;
const SHARE_URL = ""; // どわーｗｗ
const $ = id => document.getElementById(id);
const screens = { start: $("start"), play: $("play"), end: $("end") };
let state = "start", word, last = [], score, combo, maxCombo, endTime, raf, keys, miss, done, missed, topLevel, curLevel;

function show(name) { state = name; for (const k in screens) screens[k].classList.toggle("hidden", k !== name); }
function getBest() { try { return +localStorage.getItem("typing-best") || 0; } catch (e) { return 0; } }
function setBest(v) { try { localStorage.setItem("typing-best", v); } catch (e) { } }
$("best").textContent = getBest();

/* 連続ｗ */
function pickLevel() {
  const target = 1 + Math.min(3, combo / 4);
  const w = [1, 2, 3, 4].map(L => Math.max(0.08, 1 - Math.abs(L - target) * 0.5));
  if (done < 4) w[2] = w[3] = 0; // 最初の4語は必ずレベル1〜2にしとくかｗ
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return i + 1; }
  return 4;
}
function nextWord() {
  const lv = pickLevel(); curLevel = lv; topLevel = Math.max(topLevel, lv);
  // 直近８語は出さないみたいな？そう言うノリｗ
  let list = WORDS[lv].filter(w => !last.includes(w.text));
  if (!list.length) list = WORDS[lv].filter(w => w.text !== last[last.length - 1]);
  const pick = list[Math.floor(Math.random() * list.length)];
  word = pick.text;
  last.push(word); if (last.length > 8) last.shift();                       // 画面に表示する文字（笑）
  typed = ""; missed = false; cands = buildCandidates(pick.kana); // 入力は読み仮名から作っちゃったり？
  $("kana").textContent = word; fit($("kana"));
  const longest = cands.reduce((a, b) => b.length > a.length ? b : a);
  $("romaji").textContent = longest; fit($("romaji"));
  render();
}
/* はみでそうとかｗマジおもろいわｗ */
function fit(el) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 10) { size -= 1; el.style.fontSize = size + "px"; }
}
function render() {
  const r = cands[0];
  $("romaji").innerHTML = `<span class="d">${typed}</span><span class="c">${r[typed.length]}</span><span class="n">${r.slice(typed.length + 1)}</span>`;
}
function start() {
  if (!WORDS[1]) return;
  score = combo = maxCombo = keys = miss = done = 0; topLevel = 1; last = [];
  $("score").textContent = 0; $("combo").textContent = 0; $("time").textContent = TOTAL; $("msg").textContent = "";
  $("bar").style.transform = "scaleX(1)"; $("bar").classList.remove("low");
  show("play"); nextWord();
  endTime = performance.now() + TOTAL * 1000;
  cancelAnimationFrame(raf);
  const tick = now => {
    if (state !== "play") return;
    const left = Math.max(0, endTime - now);
    $("bar").style.transform = `scaleX(${left / (TOTAL * 1000)})`;
    $("time").textContent = Math.ceil(left / 1000);
    $("bar").classList.toggle("low", left <= 10000);
    if (left <= 0) return finish();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function finish() {
  cancelAnimationFrame(raf);
  const hits = keys - miss, acc = keys ? Math.round(hits / keys * 100) : 0;
  $("rScore").textContent = score; $("rKpm").textContent = Math.round(hits * 60 / TOTAL);
  $("rAcc").textContent = acc + "%"; $("rWords").textContent = done;
  const best = getBest();
  if (score > best) { setBest(score); $("rBest").textContent = "ベストスコアを更新しました！"; }
  else $("rBest").textContent = "ベストスコア：" + best;
  $("best").textContent = Math.max(best, score);
  const text = `冷笑タイピング（笑）で${score}点ｗ（${done}語・正確さ${acc}%・最大${maxCombo}連続）`;
  $("share").href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + (SHARE_URL ? "&url=" + encodeURIComponent(SHARE_URL) : "");
  show("end");
}
function press(ch) {
  keys++;
  const t2 = typed + ch, f = cands.filter(c => c.startsWith(t2));
  if (f.length) {
    typed = t2; cands = f;
    if (cands.includes(typed)) {
      done++;
      if (!missed) { combo++; maxCombo = Math.max(maxCombo, combo); }
      // 基本点（レベル4は20、他は10）＋ 5連続ごとに+5
      score += (curLevel === 4 ? 20 : 10) + Math.floor(combo / 5) * 5;
      $("msg").textContent = combo >= 5 ? combo + " 連続！" : "";
      nextWord();
    } else render();
  } else {
    miss++; missed = true; combo = 0; $("msg").textContent = "";
    const k = $("kana"); k.classList.remove("shake"); void k.offsetWidth; k.classList.add("shake");
  }
  $("score").textContent = score; $("combo").textContent = combo;
}
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (state !== "play") {
    if (e.key === "Enter") { e.preventDefault(); start(); }
    return;
  }
  if (e.key.length === 1) { e.preventDefault(); press(e.key.toLowerCase()); }
});
$("go").onclick = start; $("again").onclick = start;

$("go").disabled = true;
fetch("words.json")
  .then(r => r.json())
  .then(d => {
    // "猫 ねこ" → {text, kana}　（読みが同じ言葉は "ゲーム" のように1つだけでOK）
    for (const k in d.levels) WORDS[k] = d.levels[k].map(s => { const [text, kana = text] = s.split(" "); return { text, kana }; });
    $("go").disabled = false;
  })
  .catch(() => { $("go").textContent = "words.json を読み込めません"; });
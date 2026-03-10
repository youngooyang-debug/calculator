'use strict';

// ── Complex number arithmetic ─────────────────────────────────────────────────
class Complex {
  constructor(re, im = 0) { this.re = re; this.im = im; }
  static from(v)   { return v instanceof Complex ? v : new Complex(v, 0); }
  add(b)  { b = Complex.from(b); return new Complex(this.re + b.re, this.im + b.im); }
  sub(b)  { b = Complex.from(b); return new Complex(this.re - b.re, this.im - b.im); }
  mul(b)  { b = Complex.from(b); return new Complex(this.re*b.re - this.im*b.im, this.re*b.im + this.im*b.re); }
  div(b) {
    b = Complex.from(b);
    const d = b.re*b.re + b.im*b.im;
    if (d === 0) return new Complex(Infinity, Infinity);
    return new Complex((this.re*b.re + this.im*b.im)/d, (this.im*b.re - this.re*b.im)/d);
  }
  pow(b) {
    b = Complex.from(b);
    if (b.im === 0 && this.im === 0) return new Complex(Math.pow(this.re, b.re));
    const r = Math.sqrt(this.re*this.re + this.im*this.im);
    if (r === 0) return new Complex(0);
    const theta = Math.atan2(this.im, this.re);
    const nr    = Math.pow(r, b.re) * Math.exp(-b.im * theta);
    const ntheta = b.re * theta + b.im * Math.log(r);
    return new Complex(nr * Math.cos(ntheta), nr * Math.sin(ntheta));
  }
  neg()  { return new Complex(-this.re, -this.im); }
  conj() { return new Complex(this.re, -this.im); }
  abs()  { return Math.sqrt(this.re*this.re + this.im*this.im); }
  isReal(eps = 1e-10) { return Math.abs(this.im) <= eps * (1 + Math.abs(this.re)); }
  toNum() { return this.isReal() ? this.re : this; }

  toString() {
    const f = v => {
      if (!isFinite(v)) return v > 0 ? '∞' : '-∞';
      if (Number.isInteger(v)) return String(v);
      return parseFloat(v.toPrecision(10)).toString();
    };
    const s = this.toNum();
    if (!(s instanceof Complex)) return f(s);
    const imAbs = Math.abs(this.im);
    const imStr = (parseFloat(imAbs.toPrecision(10)) === 1) ? 'i' : f(imAbs) + 'i';
    if (Math.abs(this.re) < 1e-10 * (1 + imAbs)) return (this.im < 0 ? '−' : '') + imStr;
    return f(this.re) + (this.im < 0 ? ' − ' : ' + ') + imStr;
  }
}

// Arithmetic helpers — promote to Complex when either operand is complex
function cadd(a, b) { return (a instanceof Complex || b instanceof Complex) ? Complex.from(a).add(b)  : a + b; }
function csub(a, b) { return (a instanceof Complex || b instanceof Complex) ? Complex.from(a).sub(b)  : a - b; }
function cmul(a, b) { return (a instanceof Complex || b instanceof Complex) ? Complex.from(a).mul(b)  : a * b; }
function cdiv(a, b) { return (a instanceof Complex || b instanceof Complex) ? Complex.from(a).div(b)  : a / b; }
function cpow(a, b) { return (a instanceof Complex || b instanceof Complex) ? Complex.from(a).pow(b)  : Math.pow(a, b); }

// ── Calculator ────────────────────────────────────────────────────────────────
class ScientificCalculator {
  constructor() {
    this.expr       = '';
    this.prevResult = null;
    this.isRad      = false;
    this.is2nd      = false;
    this.justCalc   = false;
    this._updateDisplay();
  }

  // ── Input helpers ──────────────────────────────────────────────────────────

  appendChar(ch) {
    if (this.justCalc) {
      if (/^[0-9.(πei]/.test(ch)) this.expr = '';
      this.justCalc = false;
    }
    // Implicit multiplication: 2π→2*π, 2e→2*e, 2i→2*i, 2(→2*(
    if (ch.length === 1 && this.expr && /[0-9.πei)]$/.test(this.expr) && /^[πei(]$/.test(ch)) {
      this.expr += '*';
    }
    this.expr += ch;
    this._updateDisplay();
  }

  inputDecimal() {
    const lastNum = this.expr.match(/[0-9.]*$/)[0];
    if (lastNum.includes('.')) return;
    if (this.justCalc) { this.expr = ''; this.justCalc = false; }
    if (!this.expr || /[+\-*/^(%]$/.test(this.expr)) this.expr += '0';
    this.expr += '.';
    this._updateDisplay();
  }

  inputPlusMinus() {
    if (this.justCalc) {
      this.expr = this._complexExprStr(this.prevResult);
      this.justCalc = false;
    }
    if (!this.expr) return;
    this.expr = '(-1)*(' + this.expr + ')';
    this._updateDisplay();
  }

  backspace() {
    if (this.justCalc) { this.expr = ''; this.justCalc = false; this._updateDisplay(); return; }
    const multi = ['asinh(', 'acosh(', 'atanh(', 'asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'tanh(', 'sin(', 'cos(', 'tan(', 'sqrt(', 'cbrt(', 'log(', 'ln(', 'abs(', 'floor(', 'conj(', 'fact(', 'ANS', '(-1)*(', 'e^(', '10^('];
    let hit = false;
    for (const m of multi) {
      if (this.expr.endsWith(m)) { this.expr = this.expr.slice(0, -m.length); hit = true; break; }
    }
    if (!hit) this.expr = this.expr.slice(0, -1);
    this._updateDisplay();
  }

  clear() {
    this.expr = '';
    this.justCalc = false;
    this.prevResult = null;
    this._updateDisplay();
  }

  // ── Scientific function buttons ────────────────────────────────────────────

  inputTrig(fn) {
    const actual = this.is2nd ? 'a' + fn : fn;
    if (this.is2nd) this._set2nd(false);
    this._insertFn(actual);
  }

  inputHyp(fn) {
    const actual = this.is2nd ? 'a' + fn : fn;
    if (this.is2nd) this._set2nd(false);
    this._insertFn(actual);
  }

  inputLogFn() {
    if (this.is2nd) { this._set2nd(false); this.appendChar('10^('); }
    else this._insertFn('log');
  }

  inputLnFn() {
    if (this.is2nd) { this._set2nd(false); this.appendChar('e^('); }
    else this._insertFn('ln');
  }

  inputX2() {
    if (this.is2nd) { this._set2nd(false); this.appendChar('^3'); }
    else this.appendChar('^2');
  }

  inputSqrtFn() {
    if (this.is2nd) { this._set2nd(false); this._insertFn('cbrt'); }
    else this._insertFn('sqrt');
  }

  inputFact() {
    if (this.justCalc) { this.expr = this._complexExprStr(this.prevResult); this.justCalc = false; }
    this.expr += '!';
    this._updateDisplay();
  }

  input1divX() {
    if (this.justCalc) { this.expr = this._complexExprStr(this.prevResult); this.justCalc = false; }
    if (!this.expr) return;
    this.expr = '1/(' + this.expr + ')';
    this._updateDisplay();
  }

  inputAns() {
    if (this.prevResult === null) return;
    if (this.justCalc) { this.expr = ''; this.justCalc = false; }
    this.expr += 'ANS';
    this._updateDisplay();
  }

  inputConj() {
    this._insertFn('conj');
  }

  // ── Mode toggles ───────────────────────────────────────────────────────────

  toggleAngleMode() {
    this.isRad = !this.isRad;
    const btn = document.getElementById('degRadBtn');
    btn.textContent = this.isRad ? 'RAD' : 'DEG';
    btn.classList.toggle('active', this.isRad);
    document.getElementById('angleModeLabel').textContent = this.isRad ? 'RAD' : 'DEG';
  }

  toggle2nd() {
    this._set2nd(!this.is2nd);
  }

  // ── Calculate ──────────────────────────────────────────────────────────────

  calculate() {
    if (!this.expr) return;
    try {
      // Auto-close any unclosed parentheses
      const open  = (this.expr.match(/\(/g) || []).length;
      const close = (this.expr.match(/\)/g) || []).length;
      if (open > close) this.expr += ')'.repeat(open - close);

      let val = this._evaluate(this.expr);
      if (val instanceof Complex) val = val.toNum();
      document.getElementById('expression').textContent = this._display(this.expr) + ' =';
      this.prevResult = val;
      this.expr = this._complexExprStr(val);
      this.justCalc = true;
      this._setResult(this._fmt(val));
    } catch (e) {
      this._setResult('오류');
      this.expr = '';
      this.justCalc = false;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  // Returns a parseable string for storing complex/real results in this.expr
  _complexExprStr(val) {
    if (val instanceof Complex) {
      return '(' + val.re + (val.im >= 0 ? '+' : '') + val.im + '*i)';
    }
    return String(val ?? 0);
  }

  _insertFn(fn) {
    if (this.justCalc) { this.expr = ''; this.justCalc = false; }
    // Implicit multiplication: 2sin(→2*sin(
    if (this.expr && /[0-9.πei)]$/.test(this.expr)) this.expr += '*';
    this.expr += fn + '(';
    this._updateDisplay();
  }

  _set2nd(on) {
    this.is2nd = on;
    const btn = document.getElementById('invBtn');
    btn.classList.toggle('active', on);
    const map = on
      ? { sinBtn: 'sin⁻¹', cosBtn: 'cos⁻¹', tanBtn: 'tan⁻¹', logBtn: '10ˣ', lnBtn: 'eˣ', x2Btn: 'x³', sqrtBtn: '∛x', sinhBtn: 'sinh⁻¹', coshBtn: 'cosh⁻¹', tanhBtn: 'tanh⁻¹' }
      : { sinBtn: 'sin',   cosBtn: 'cos',   tanBtn: 'tan',   logBtn: 'log', lnBtn: 'ln',  x2Btn: 'x²', sqrtBtn: '√x', sinhBtn: 'sinh',  coshBtn: 'cosh',  tanhBtn: 'tanh'  };
    for (const [id, label] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    }
  }

  _display(e) {
    return e
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/sqrt\(/g, '√(')
      .replace(/cbrt\(/g, '∛(')
      .replace(/asinh\(/g, 'sinh⁻¹(')
      .replace(/acosh\(/g, 'cosh⁻¹(')
      .replace(/atanh\(/g, 'tanh⁻¹(')
      .replace(/asin\(/g, 'sin⁻¹(')
      .replace(/acos\(/g, 'cos⁻¹(')
      .replace(/atan\(/g, 'tan⁻¹(')
      .replace(/floor\(/g, '⌊(')
      .replace(/fact\(/g, 'n!(');
  }

  _fmt(n) {
    if (n instanceof Complex) {
      n = n.toNum();
      if (n instanceof Complex) return n.toString();
    }
    if (!isFinite(n)) return n > 0 ? '∞' : '오류';
    if (Number.isNaN(n)) return '오류';
    if (Number.isInteger(n)) return n.toString();
    return parseFloat(n.toPrecision(10)).toString();
  }

  _setResult(text) {
    const el = document.getElementById('result');
    el.textContent = text;
    el.className = 'result' + (text.length > 20 ? ' xsmall' : text.length > 13 ? ' small' : '');
  }

  _updateDisplay() {
    const exprEl = document.getElementById('expression');
    if (!this.justCalc) {
      exprEl.textContent = this._display(this.expr);
      if (this.expr.length > 1) {
        try {
          const v    = this._evaluate(this.expr);
          const disp = v instanceof Complex ? v.toNum() : v;
          if (disp instanceof Complex || (isFinite(disp) && !Number.isNaN(disp)))
            this._setResult(this._fmt(disp));
          else this._setResult(this.expr || '0');
        } catch (_) {
          this._setResult(this.expr || '0');
        }
      } else {
        this._setResult(this.expr || '0');
      }
    }
  }

  // ── Expression evaluator (recursive descent parser) ──────────────────────

  _evaluate(raw) {
    if (!raw) throw new Error('empty');
    let s = raw.replace(/π/g, String(Math.PI));
    // ANS substitution — handle complex previous result
    if (this.prevResult instanceof Complex) {
      const r = this.prevResult;
      s = s.replace(/ANS/g, '(' + r.re + (r.im >= 0 ? '+' : '') + r.im + '*i)');
    } else {
      s = s.replace(/ANS/g, String(this.prevResult ?? 0));
    }
    const tokens = this._tokenize(s);
    const pos = { i: 0 };
    const result = this._parseAddSub(tokens, pos);
    if (tokens[pos.i].type !== 'EOF') throw new Error('trailing');
    return result;
  }

  _tokenize(s) {
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ') { i++; continue; }

      // Number
      if (/[0-9.]/.test(ch)) {
        let num = '';
        while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
        tokens.push({ type: 'NUM', val: parseFloat(num) });
        // Implicit multiplication before standalone 'i' (imaginary unit)
        if (i < s.length && s[i] === 'i' && (i + 1 >= s.length || !/[a-zA-Z0-9_]/.test(s[i + 1])))
          tokens.push({ type: 'OP', val: '*' });
        continue;
      }

      // Identifiers / keywords
      if (/[a-zA-Z]/.test(ch)) {
        let id = '';
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
        const fns = ['sinh','cosh','tanh','asinh','acosh','atanh','sin','cos','tan','asin','acos','atan','log','ln','sqrt','cbrt','abs','floor','fact','conj'];
        if (fns.includes(id)) {
          tokens.push({ type: 'FN', val: id });
        } else if (id === 'i') {
          tokens.push({ type: 'NUM', val: new Complex(0, 1) });
        } else if (id === 'e') {
          tokens.push({ type: 'NUM', val: Math.E });
        } else if (id === 'Infinity') {
          tokens.push({ type: 'NUM', val: Infinity });
        } else {
          throw new Error(`Unknown: ${id}`);
        }
        continue;
      }

      switch (ch) {
        case '+': tokens.push({ type: 'OP',  val: '+' }); i++; break;
        case '-': tokens.push({ type: 'OP',  val: '-' }); i++; break;
        case '*': tokens.push({ type: 'OP',  val: '*' }); i++; break;
        case '/': tokens.push({ type: 'OP',  val: '/' }); i++; break;
        case '^': tokens.push({ type: 'OP',  val: '^' }); i++; break;
        case '%': tokens.push({ type: 'PCT'            }); i++; break;
        case '!': tokens.push({ type: 'FACT'           }); i++; break;
        case '(': tokens.push({ type: 'LPAR'           }); i++; break;
        case ')': tokens.push({ type: 'RPAR'           }); i++; break;
        default:  throw new Error(`Bad char: ${ch}`);
      }
    }
    tokens.push({ type: 'EOF' });
    return tokens;
  }

  // Grammar:
  //   AddSub  → MulDiv ((+|-) MulDiv)*
  //   MulDiv  → Power  ((*|/) Power)*
  //   Power   → Postfix (^ Power)?   [right-associative]
  //   Postfix → Unary  (! | %)*
  //   Unary   → -? Primary
  //   Primary → NUM | FN '(' AddSub ')' | '(' AddSub ')'

  _parseAddSub(tok, pos) {
    let left = this._parseMulDiv(tok, pos);
    while (tok[pos.i].type === 'OP' && (tok[pos.i].val === '+' || tok[pos.i].val === '-')) {
      const op = tok[pos.i++].val;
      const right = this._parseMulDiv(tok, pos);
      left = op === '+' ? cadd(left, right) : csub(left, right);
    }
    return left;
  }

  _parseMulDiv(tok, pos) {
    let left = this._parsePower(tok, pos);
    while (tok[pos.i].type === 'OP' && (tok[pos.i].val === '*' || tok[pos.i].val === '/')) {
      const op = tok[pos.i++].val;
      const right = this._parsePower(tok, pos);
      left = op === '*' ? cmul(left, right) : cdiv(left, right);
    }
    return left;
  }

  _parsePower(tok, pos) {
    const base = this._parsePostfix(tok, pos);
    if (tok[pos.i].type === 'OP' && tok[pos.i].val === '^') {
      pos.i++;
      const exp = this._parsePower(tok, pos); // right-associative
      return cpow(base, exp);
    }
    return base;
  }

  _parsePostfix(tok, pos) {
    let val = this._parseUnary(tok, pos);
    for (;;) {
      if (tok[pos.i].type === 'FACT') {
        pos.i++;
        const n = val instanceof Complex ? val.re : val;
        val = this._factorial(n);
      } else if (tok[pos.i].type === 'PCT') {
        pos.i++;
        val = cmul(val, 0.01);
      } else break;
    }
    return val;
  }

  _parseUnary(tok, pos) {
    if (tok[pos.i].type === 'OP' && tok[pos.i].val === '-') {
      pos.i++;
      const v = this._parsePrimary(tok, pos);
      return v instanceof Complex ? v.neg() : -v;
    }
    if (tok[pos.i].type === 'OP' && tok[pos.i].val === '+') { pos.i++; return this._parsePrimary(tok, pos); }
    return this._parsePrimary(tok, pos);
  }

  _parsePrimary(tok, pos) {
    const t = tok[pos.i];

    if (t.type === 'NUM') { pos.i++; return t.val; }

    if (t.type === 'FN') {
      pos.i++;
      if (tok[pos.i].type !== 'LPAR') throw new Error('Expected (');
      pos.i++;
      const arg = this._parseAddSub(tok, pos);
      if (tok[pos.i].type !== 'RPAR') throw new Error('Expected )');
      pos.i++;
      return this._applyFn(t.val, arg);
    }

    if (t.type === 'LPAR') {
      pos.i++;
      const val = this._parseAddSub(tok, pos);
      if (tok[pos.i].type !== 'RPAR') throw new Error('Expected )');
      pos.i++;
      return val;
    }

    throw new Error(`Unexpected token: ${t.type}`);
  }

  _applyFn(fn, rawArg) {
    // Simplify complex to real if imaginary part ≈ 0
    const arg = rawArg instanceof Complex ? rawArg.toNum() : rawArg;
    const toRad   = v => this.isRad ? v : v * Math.PI / 180;
    const fromRad = v => this.isRad ? v : v * 180 / Math.PI;

    // Functions with full complex support
    switch (fn) {
      case 'abs':
        return arg instanceof Complex ? arg.abs() : Math.abs(arg);
      case 'conj':
        return arg instanceof Complex ? arg.conj() : arg;
      case 'sqrt':
        if (arg instanceof Complex) {
          const r = arg.abs(), theta = Math.atan2(arg.im, arg.re);
          return (new Complex(Math.sqrt(r)*Math.cos(theta/2), Math.sqrt(r)*Math.sin(theta/2))).toNum();
        }
        return arg < 0 ? new Complex(0, Math.sqrt(-arg)) : Math.sqrt(arg);
      case 'ln':
        if (arg instanceof Complex)
          return (new Complex(Math.log(arg.abs()), Math.atan2(arg.im, arg.re))).toNum();
        return Math.log(arg);
      case 'log':
        if (arg instanceof Complex) {
          const lnz = new Complex(Math.log(arg.abs()), Math.atan2(arg.im, arg.re));
          return (new Complex(lnz.re/Math.LN10, lnz.im/Math.LN10)).toNum();
        }
        return Math.log10(arg);
    }

    // Real-only functions — use real part if given complex
    const x = arg instanceof Complex ? arg.re : arg;
    switch (fn) {
      case 'sin':   return Math.sin(toRad(x));
      case 'cos':   return Math.cos(toRad(x));
      case 'tan':   return Math.tan(toRad(x));
      case 'asin':  return fromRad(Math.asin(x));
      case 'acos':  return fromRad(Math.acos(x));
      case 'atan':  return fromRad(Math.atan(x));
      case 'sinh':  return Math.sinh(x);
      case 'cosh':  return Math.cosh(x);
      case 'tanh':  return Math.tanh(x);
      case 'asinh': return Math.asinh(x);
      case 'acosh': return Math.acosh(x);
      case 'atanh': return Math.atanh(x);
      case 'floor': return Math.floor(x);
      case 'cbrt':  return Math.cbrt(x);
      case 'fact':  return this._factorial(x);
      default:      throw new Error(`Unknown fn: ${fn}`);
    }
  }

  _factorial(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error('Factorial requires non-negative integer');
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // ── Engineering functions ─────────────────────────────────────────────────

  engConvert(fn) {
    let val;
    try { val = this._evaluate(this.expr); } catch (_) { val = this.prevResult; }
    if (val instanceof Complex) val = val.toNum();
    if (val instanceof Complex || val === null || val === undefined || isNaN(val)) {
      this._setResult('오류 (실수 필요)'); return;
    }
    let result, exprLabel, unit;
    switch (fn) {
      case 'wToDbm':
        if (val <= 0) { this._setResult('오류 (W>0)'); return; }
        result = 10 * Math.log10(val * 1000); exprLabel = `${this._fmt(val)} W =`; unit = 'dBm'; break;
      case 'dbmToW':
        result = Math.pow(10, val / 10) / 1000; exprLabel = `${this._fmt(val)} dBm =`; unit = 'W'; break;
      case 'msToMph':
        result = val * 3600 / 1609.344; exprLabel = `${this._fmt(val)} m/s =`; unit = 'mi/h'; break;
      case 'mphToMs':
        result = val * 1609.344 / 3600; exprLabel = `${this._fmt(val)} mi/h =`; unit = 'm/s'; break;
      default: return;
    }
    document.getElementById('expression').textContent = exprLabel;
    this.prevResult = result;
    this.expr = String(result);
    this.justCalc = true;
    this._setResult(this._engFmt(result) + ' ' + unit);
  }

  toggleFriisDisplay() {
    const normal    = document.getElementById('normalDisplay');
    const friis     = document.getElementById('friisDisplay');
    const btn       = document.getElementById('friisBtn');
    const showFriis = friis.style.display === 'none';
    friis.style.display  = showFriis ? 'flex' : 'none';
    normal.style.display = showFriis ? 'none' : '';
    btn.classList.toggle('active', showFriis);
  }

  computeFriisInline() {
    const get = id => parseFloat(document.getElementById(id).value);
    const [pt, gt, gr, d, f] = ['fri-pt','fri-gt','fri-gr','fri-d','fri-f'].map(get);
    const out = document.getElementById('friisResult');
    if ([pt, gt, gr, d, f].some(isNaN) || d <= 0 || f <= 0) {
      out.innerHTML = '<span class="fri-err">입력값 오류 (d, f &gt; 0)</span>'; return;
    }
    const fspl   = 20 * Math.log10(d) + 20 * Math.log10(f) - 147.55;
    const pr_dbm = pt + gt + gr - fspl;
    const pr_w   = Math.pow(10, (pr_dbm - 30) / 10);
    out.innerHTML =
      `FSPL <b>${fspl.toFixed(1)} dB</b> &nbsp; Pr <b>${pr_dbm.toFixed(1)} dBm</b> &nbsp; Pr <b>${this._engFmt(pr_w)} W</b>`;
    this.prevResult = pr_dbm;
  }

  _engFmt(n) {
    if (!isFinite(n) || isNaN(n)) return '오류';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e-3 && abs < 1e10) return parseFloat(n.toPrecision(6)).toString();
    return n.toExponential(4);
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
const calc = new ScientificCalculator();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

window.addEventListener('keydown', e => {
  const k = e.key;
  if (/^[0-9]$/.test(k))              calc.appendChar(k);
  else if (k === '.')                  calc.inputDecimal();
  else if (k === '+')                  calc.appendChar('+');
  else if (k === '-')                  calc.appendChar('-');
  else if (k === '*')                  calc.appendChar('*');
  else if (k === '/')                  { e.preventDefault(); calc.appendChar('/'); }
  else if (k === '^')                  calc.appendChar('^');
  else if (k === '%')                  calc.appendChar('%');
  else if (k === '(')                  calc.appendChar('(');
  else if (k === ')')                  calc.appendChar(')');
  else if (k === 'i')                  calc.appendChar('i');
  else if (k === 'Enter' || k === '=') calc.calculate();
  else if (k === 'Backspace')          calc.backspace();
  else if (k === 'Escape')             calc.clear();
});

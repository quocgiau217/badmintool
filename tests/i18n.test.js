// Ngôn ngữ: mọi chuỗi tx("...") trong code phải có bản tiếng Anh; tx điền giá trị đúng chỗ.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(lang) {
  const ctx = { localStorage: { getItem: k => (k === 'xs_lang' ? lang : null), setItem() {} }, navigator: { language: 'vi' } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8') + ';globalThis.out = { tx, EN, LANG };', ctx);
  return ctx.out;
}
const unq = s => JSON.parse(s[0] === "'" ? '"' + s.slice(1, -1).replace(/"/g, '\\"').replace(/\\'/g, "'") + '"' : s);

test('mọi chuỗi giao diện có bản tiếng Anh', () => {
  const { EN } = load('en');
  const dir = path.join(__dirname, '..', 'js'), missing = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/\btx\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
      const key = unq(m[1]).trim().replace(/\s+/g, ' ');
      if (key && !Object.prototype.hasOwnProperty.call(EN, key)) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('tx: tiếng Việt giữ nguyên, tiếng Anh dịch và điền giá trị', () => {
  const vi = load('vi'), en = load('en');
  assert.strictEqual(vi.LANG, 'vi'); assert.strictEqual(en.LANG, 'en');
  assert.strictEqual(vi.tx('Đã bỏ {0}. Còn {1} sân', ['Sân 2', 3]), 'Đã bỏ Sân 2. Còn 3 sân');
  assert.strictEqual(en.tx('Đã bỏ {0}. Còn {1} sân', ['Court 2', 3]), 'Removed Court 2. 3 courts left');
  assert.strictEqual(en.tx('  Huỷ\n  '), '  Cancel\n  ');
  assert.strictEqual(en.tx('Câu chưa có bản dịch'), 'Câu chưa có bản dịch');
});

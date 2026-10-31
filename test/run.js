// Runs Code.gs against small stand-ins for SpreadsheetApp, DriveApp and Drive, so the logic can be checked without Google.
// Usage: node test/run.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeEnv({ shareAnswer = 'NO' } = {}) {
  const alerts = [];
  const sheets = new Map([['Sheet1', null]]);
  const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const file = (id, name, mime, opts = {}) => ({
    id, sharing: 'private',
    getId: () => id, getName: () => name, getMimeType: () => mime, getSize: () => opts.size || 2097152,
    getLastUpdated: () => new Date('2026-10-01T00:00:00Z'), getUrl: () => 'https://drive.google.com/file/d/' + id,
    setSharing() { if (opts.locked) throw new Error('No permission'); this.sharing = 'link'; },
  });
  const folder = (name, files, subs = []) => ({ getName: () => name, getFiles: () => iter(files), getFolders: () => iter(subs) });
  const vid = file('v1', 'lecture.mp4', 'video/mp4');
  const locked = file('l1', 'shared-with-me.pdf', 'application/pdf', { locked: true });
  const tree = folder('Course', [file('a1', 'notes.pdf', 'application/pdf'), vid], [folder('Week 1', [locked, file('i1', 'img.png', 'image/png')])]);

  const sheet = (name) => {
    const s = { name, rows: [], getName: () => name,
      appendRow: (r) => s.rows.push(r),
      getRange: (r, c, nr, nc) => ({ setBackground: () => ({ setFontColor: () => ({ setFontWeight: () => {} }) }), setValues: (v) => { assert.strictEqual(v.length, nr); assert.strictEqual(v[0].length, nc); s.rows.push(...v); } }),
      setFrozenRows: () => {}, autoResizeColumns: () => {} };
    return s;
  };
  const ui = {
    ButtonSet: { OK_CANCEL: 1, YES_NO: 2 }, Button: { OK: 'OK', YES: 'YES', NO: 'NO' },
    alert: (...a) => { alerts.push(a); return a.length > 1 ? shareAnswer : undefined; },
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345' }),
    createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
  };
  const ss = { insertSheet: (n) => { assert(!sheets.get(n), 'duplicate sheet name ' + n); const s = sheet(n); sheets.set(n, s); return s; }, getSheetByName: (n) => sheets.has(n) ? {} : null };
  const ctx = {
    SpreadsheetApp: { getUi: () => ui, getActiveSpreadsheet: () => ss },
    DriveApp: { getFolderById: (id) => { assert.strictEqual(id, '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'); return tree; }, Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' } },
    Drive: { Files: { get: (id) => (id === 'v1' ? { videoMediaMetadata: { durationMillis: 3723000 } } : {}) } },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Code.gs'), 'utf8'), ctx);
  return { ctx, alerts, sheets, files: { vid, locked } };
}

// 1. Default (No): nothing shared, all 4 files indexed with full paths and video length.
{
  const { ctx, alerts, sheets, files } = makeEnv({ shareAnswer: 'NO' });
  ctx.showFolderDialog();
  const s = [...sheets.values()].find((x) => x && x.rows.length);
  assert.strictEqual(s.rows.length, 5, 'header + 4 files');
  const byName = Object.fromEntries(s.rows.slice(1).map((r) => [r[0], r]));
  assert.strictEqual(byName['lecture.mp4'][4], "'01:02:03");
  assert.strictEqual(byName['lecture.mp4'][5], 3723);
  assert.strictEqual(byName['img.png'][7], 'Course/Week 1/img.png');
  assert.strictEqual(byName['notes.pdf'][2], 2);
  assert(s.rows.slice(1).every((r) => r[8] === 'Unchanged'));
  assert.strictEqual(files.vid.sharing, 'private');
  assert(/Indexed 4 files/.test(alerts.at(-1)[0]));
  console.log('ok  default leaves sharing alone');
}

// 2. Yes: shares what it can, skips locked files without stopping.
{
  const { ctx, alerts, sheets, files } = makeEnv({ shareAnswer: 'YES' });
  ctx.showFolderDialog();
  const s = [...sheets.values()].find((x) => x && x.rows.length);
  assert.strictEqual(files.vid.sharing, 'link');
  assert.strictEqual(files.locked.sharing, 'private');
  assert(/Shared by link: 3\. Not changed \(no permission to share\): 1/.test(alerts.at(-1)[0]));
  assert.strictEqual(s.rows.find((r) => r[0] === 'shared-with-me.pdf')[8], 'Not changed (no permission)');
  console.log('ok  opt-in sharing, skips files it cannot share');
}

// 3. Running twice on the same folder makes a second tab instead of failing.
{
  const { ctx, sheets } = makeEnv();
  ctx.showFolderDialog();
  ctx.showFolderDialog();
  const names = [...sheets.keys()];
  assert(names.includes('Course (1AbC)') && names.includes('Course (1AbC) 2'), names.join(', '));
  console.log('ok  repeat runs get a unique tab name');
}

// 4. Folder ID parsing.
{
  const { ctx } = makeEnv();
  assert.strictEqual(ctx.extractFolderId('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345?usp=sharing'), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  assert.strictEqual(ctx.extractFolderId('1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  assert.strictEqual(ctx.extractFolderId('not a link'), null);
  console.log('ok  folder links and bare IDs');
}
console.log('all tests passed');

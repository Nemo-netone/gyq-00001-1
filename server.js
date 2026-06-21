const express = require('express');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'clipboard.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_copied_at INTEGER,
      sort_order INTEGER NOT NULL
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_clips_sort_order ON clips(sort_order DESC);`);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getCurrentTimestamp() {
  return Date.now();
}

function getAllClips() {
  const stmt = db.prepare('SELECT * FROM clips ORDER BY sort_order DESC');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function getClipById(id) {
  const stmt = db.prepare('SELECT * FROM clips WHERE id = ?');
  stmt.bind([id]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

app.get('/api/clips', (req, res) => {
  const clips = getAllClips();
  res.json(clips);
});

app.post('/api/clips', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: '内容不能为空' });
  }

  const maxResult = db.exec('SELECT MAX(sort_order) as max_order FROM clips');
  const maxOrder = maxResult.length > 0 && maxResult[0].values.length > 0
    ? maxResult[0].values[0][0]
    : 0;
  const nextOrder = (maxOrder || 0) + 1;
  const now = getCurrentTimestamp();
  const trimmedContent = content.trim();

  db.run(
    'INSERT INTO clips (content, created_at, sort_order) VALUES (?, ?, ?)',
    [trimmedContent, now, nextOrder]
  );
  saveDatabase();

  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  const clip = getClipById(lastId);
  res.status(201).json(clip);
});

app.delete('/api/clips/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: '无效的 ID' });
  }

  const clip = getClipById(id);
  if (!clip) {
    return res.status(404).json({ error: '记录不存在' });
  }

  db.run('DELETE FROM clips WHERE id = ?', [id]);
  saveDatabase();
  res.json({ success: true });
});

app.post('/api/clips/:id/copy', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: '无效的 ID' });
  }

  const clip = getClipById(id);
  if (!clip) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const now = getCurrentTimestamp();
  db.run('UPDATE clips SET last_copied_at = ? WHERE id = ?', [now, id]);
  saveDatabase();

  const updatedClip = getClipById(id);
  res.json(updatedClip);
});

app.post('/api/clips/:id/move-up', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: '无效的 ID' });
  }

  const clip = getClipById(id);
  if (!clip) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const stmt = db.prepare(
    'SELECT * FROM clips WHERE sort_order > ? ORDER BY sort_order ASC LIMIT 1'
  );
  stmt.bind([clip.sort_order]);
  let upperClip = null;
  if (stmt.step()) {
    upperClip = stmt.getAsObject();
  }
  stmt.free();

  if (!upperClip) {
    return res.status(400).json({ error: '已经是第一条了' });
  }

  db.run('UPDATE clips SET sort_order = ? WHERE id = ?', [clip.sort_order, upperClip.id]);
  db.run('UPDATE clips SET sort_order = ? WHERE id = ?', [upperClip.sort_order, clip.id]);
  saveDatabase();

  const clips = getAllClips();
  res.json(clips);
});

app.post('/api/clips/:id/move-down', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: '无效的 ID' });
  }

  const clip = getClipById(id);
  if (!clip) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const stmt = db.prepare(
    'SELECT * FROM clips WHERE sort_order < ? ORDER BY sort_order DESC LIMIT 1'
  );
  stmt.bind([clip.sort_order]);
  let lowerClip = null;
  if (stmt.step()) {
    lowerClip = stmt.getAsObject();
  }
  stmt.free();

  if (!lowerClip) {
    return res.status(400).json({ error: '已经是最后一条了' });
  }

  db.run('UPDATE clips SET sort_order = ? WHERE id = ?', [clip.sort_order, lowerClip.id]);
  db.run('UPDATE clips SET sort_order = ? WHERE id = ?', [lowerClip.sort_order, clip.id]);
  saveDatabase();

  const clips = getAllClips();
  res.json(clips);
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`剪贴板服务已启动: http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

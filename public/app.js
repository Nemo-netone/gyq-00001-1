const API_BASE = '/api/clips';

let allClips = [];
let clips = [];
let selectedIndex = -1;
let searchKeyword = '';
let searchTimer = null;

const clipInput = document.getElementById('clipInput');
const addBtn = document.getElementById('addBtn');
const charCount = document.getElementById('charCount');
const clipList = document.getElementById('clipList');
const totalCount = document.getElementById('totalCount');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

clipInput.addEventListener('input', () => {
  charCount.textContent = `${clipInput.value.length} 字`;
});

addBtn.addEventListener('click', addClip);

searchInput.addEventListener('input', () => {
  const keyword = searchInput.value.trim();
  clearSearchBtn.style.display = keyword ? 'inline-block' : 'none';

  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    performSearch(keyword);
  }, 200);
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  performSearch('');
});

clipInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    addClip();
  }
});

document.addEventListener('keydown', (e) => {
  if (document.activeElement === clipInput || document.activeElement === searchInput) return;

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelection(1);
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedIndex >= 0) {
    e.preventDefault();
    copyClip(clips[selectedIndex].id, true);
  } else if (e.key === 'Delete' && selectedIndex >= 0) {
    e.preventDefault();
    deleteClip(clips[selectedIndex].id);
  }
});

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 2000);
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function fetchClips() {
  try {
    const res = await fetch(API_BASE);
    allClips = await res.json();
    if (searchKeyword) {
      await performSearch(searchKeyword);
    } else {
      clips = [...allClips];
      if (selectedIndex >= clips.length) {
        selectedIndex = clips.length - 1;
      }
      renderClips();
    }
  } catch (err) {
    showToast('加载失败', 'error');
    console.error(err);
  }
}

async function performSearch(keyword) {
  searchKeyword = keyword;

  if (!keyword) {
    clips = [...allClips];
    if (selectedIndex >= clips.length) {
      selectedIndex = clips.length - 1;
    }
    renderClips();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '搜索失败');
    }
    clips = await res.json();
    if (selectedIndex >= clips.length) {
      selectedIndex = clips.length - 1;
    }
    renderClips();
  } catch (err) {
    showToast(err.message || '搜索失败', 'error');
  }
}

async function addClip() {
  const content = clipInput.value.trim();
  if (!content) {
    showToast('内容不能为空', 'error');
    return;
  }

  addBtn.disabled = true;
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '保存失败');
    }
    clipInput.value = '';
    charCount.textContent = '0 字';
    selectedIndex = 0;
    await fetchClips();
    showToast('已保存');
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    addBtn.disabled = false;
  }
}

async function deleteClip(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '删除失败');
    }
    await fetchClips();
    showToast('已删除');
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

async function copyClip(id, isShortcut = false) {
  const clip = clips.find(c => c.id === id);
  if (!clip) return;

  try {
    await navigator.clipboard.writeText(clip.content);
    await fetch(`${API_BASE}/${id}/copy`, { method: 'POST' });
    showToast(isShortcut ? '已复制 (快捷键)' : '已复制');
  } catch (err) {
    showToast('复制失败', 'error');
  }
}

async function moveClip(id, direction) {
  try {
    const endpoint = direction === 'up' ? 'move-up' : 'move-down';
    const res = await fetch(`${API_BASE}/${id}/${endpoint}`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '移动失败');
    }
    allClips = await res.json();
    if (searchKeyword) {
      await performSearch(searchKeyword);
    } else {
      clips = [...allClips];
      const newIndex = clips.findIndex(c => c.id === id);
      if (newIndex >= 0) selectedIndex = newIndex;
      renderClips();
    }
  } catch (err) {
    showToast(err.message || '移动失败', 'error');
  }
}

function moveSelection(direction) {
  if (clips.length === 0) return;
  let newIndex = selectedIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= clips.length) newIndex = clips.length - 1;
  selectedIndex = newIndex;
  renderClips();
}

function selectClip(index) {
  selectedIndex = index;
  renderClips();
}

function renderClips() {
  totalCount.textContent = clips.length;

  if (clips.length === 0) {
    if (searchKeyword) {
      clipList.innerHTML = `
        <div class="empty-state">
          <p>没有找到包含 "<strong>${escapeHtml(searchKeyword)}</strong>" 的内容</p>
          <p style="margin-top: 8px; color: #888; font-size: 13px;">试试其他关键词，或点击清空按钮查看全部</p>
        </div>
      `;
    } else {
      clipList.innerHTML = `
        <div class="empty-state">
          <p>暂无内容，粘贴一段文字开始使用吧！</p>
        </div>
      `;
    }
    return;
  }

  clipList.innerHTML = clips.map((clip, index) => {
    const isSelected = index === selectedIndex;
    const isFirst = index === 0;
    const isLast = index === clips.length - 1;
    const displayContent = clip.content.length > 500
      ? clip.content.substring(0, 500) + '...'
      : clip.content;

    return `
      <div class="clip-item ${isSelected ? 'selected' : ''}" data-index="${index}">
        <div class="clip-content">${escapeHtml(displayContent)}</div>
        <div class="clip-meta">
          <span class="clip-time">${formatTime(clip.created_at)}${clip.last_copied_at ? ' · 上次复制 ' + formatTime(clip.last_copied_at) : ''}</span>
          <div class="clip-actions">
            <button class="btn btn-icon" onclick="moveClip(${clip.id}, 'up')" ${isFirst ? 'disabled' : ''} title="上移">↑</button>
            <button class="btn btn-icon" onclick="moveClip(${clip.id}, 'down')" ${isLast ? 'disabled' : ''} title="下移">↓</button>
            <button class="btn btn-sm btn-copy" onclick="copyClip(${clip.id})">📋 复制</button>
            <button class="btn btn-sm btn-delete" onclick="deleteClip(${clip.id})">🗑 删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  clipList.querySelectorAll('.clip-item').forEach((item, index) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectClip(index);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

fetchClips();

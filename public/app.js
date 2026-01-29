/**
 * LocalDrop - Cross-Platform File Sharing Web App
 * Main Application JavaScript
 */

// ============================================
// Global State
// ============================================
const state = {
  files: [],
  serverInfo: null,
  socket: null,
  pendingDelete: null,
  theme: localStorage.getItem('theme') || 'dark'
};

// ============================================
// DOM Elements
// ============================================
const elements = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  uploadProgress: document.getElementById('uploadProgress'),
  progressFill: document.getElementById('progressFill'),
  progressPercent: document.getElementById('progressPercent'),
  filesGrid: document.getElementById('filesGrid'),
  emptyState: document.getElementById('emptyState'),
  fileActions: document.getElementById('fileActions'),
  fileCount: document.getElementById('fileCount'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  shareUrl: document.getElementById('shareUrl'),
  qrCode: document.getElementById('qrCode'),
  copyBtn: document.getElementById('copyBtn'),
  clientCount: document.getElementById('clientCount'),
  themeToggle: document.getElementById('themeToggle'),
  previewModal: document.getElementById('previewModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalDownload: document.getElementById('modalDownload'),
  modalClose: document.getElementById('modalClose'),
  confirmModal: document.getElementById('confirmModal'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmCancel: document.getElementById('confirmCancel'),
  confirmDelete: document.getElementById('confirmDelete'),
  toastContainer: document.getElementById('toastContainer')
};

// ============================================
// Utilities
// ============================================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type, extension) {
  const icons = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    pdf: '📄',
    code: '📝',
    archive: '📦',
    file: '📁'
  };
  return icons[type] || icons.file;
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// QR Code Generation (Simple SVG)
// ============================================
function generateQRCode(url) {
  // First try to load from API
  loadRealQRCode(url);
}

async function loadRealQRCode(url) {
  // Try using QR Server API for QR code
  const img = document.createElement('img');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=84x84&data=${encodeURIComponent(url)}`;
  img.alt = 'QR Code';
  img.style.width = '84px';
  img.style.height = '84px';
  
  img.onload = () => {
    elements.qrCode.innerHTML = '';
    elements.qrCode.appendChild(img);
  };
  
  img.onerror = () => {
    // Fallback: Generate simple canvas QR pattern
    generateFallbackQR(url);
  };
  
  // Set a timeout in case image doesn't load
  setTimeout(() => {
    if (!elements.qrCode.querySelector('img')) {
      generateFallbackQR(url);
    }
  }, 3000);
}

function generateFallbackQR(url) {
  const canvas = document.createElement('canvas');
  const size = 84;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = '#000000';
  const moduleSize = 4;
  const modules = Math.floor(size / moduleSize);
  
  // Generate pseudo-random but deterministic pattern based on URL
  const seed = url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (i) => Math.sin(seed * i * 0.1) * 10000 - Math.floor(Math.sin(seed * i * 0.1) * 10000);
  
  // Fixed corners (QR finder patterns)
  const drawFinder = (x, y) => {
    ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, moduleSize);
    ctx.fillRect(x * moduleSize, (y + 6) * moduleSize, 7 * moduleSize, moduleSize);
    ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, 7 * moduleSize);
    ctx.fillRect((x + 6) * moduleSize, y * moduleSize, moduleSize, 7 * moduleSize);
    ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
  };
  
  drawFinder(0, 0);
  drawFinder(modules - 7, 0);
  drawFinder(0, modules - 7);
  
  // Generate data pattern
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if ((x < 8 && y < 8) || (x >= modules - 8 && y < 8) || (x < 8 && y >= modules - 8)) continue;
      if (random(x * modules + y) > 0.5) {
        ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
      }
    }
  }
  
  elements.qrCode.innerHTML = '';
  elements.qrCode.appendChild(canvas);
}

// ============================================
// Theme Toggle
// ============================================
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = elements.themeToggle.querySelector('.theme-icon');
  icon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
  // Update aria-label for accessibility
  elements.themeToggle.setAttribute('aria-label', 
    state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('theme', state.theme);
  updateThemeIcon();
}

// ============================================
// Server Info & Socket Connection
// ============================================
async function fetchServerInfo() {
  try {
    const response = await fetch('/api/info');
    state.serverInfo = await response.json();
    
    elements.shareUrl.textContent = state.serverInfo.url;
    elements.clientCount.textContent = state.serverInfo.connectedClients;
    
    generateQRCode(state.serverInfo.url);
  } catch (error) {
    console.error('Failed to fetch server info:', error);
    elements.shareUrl.textContent = window.location.href;
    generateQRCode(window.location.href);
  }
}

function initSocket() {
  // Check if socket.io is available
  if (typeof io === 'undefined') {
    console.warn('Socket.io not available - real-time updates disabled');
    return;
  }
  
  state.socket = io();
  
  state.socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  state.socket.on('clients:count', (count) => {
    elements.clientCount.textContent = count;
  });
  
  state.socket.on('file:added', (file) => {
    // Check if file already exists (avoid duplicates)
    if (!state.files.find(f => f.filename === file.filename)) {
      state.files.unshift(file);
      renderFiles();
      showToast('New file uploaded!', 'info');
    }
  });
  
  state.socket.on('file:deleted', ({ filename }) => {
    state.files = state.files.filter(f => f.filename !== filename);
    renderFiles();
  });
}

// ============================================
// File Operations
// ============================================
async function fetchFiles() {
  try {
    const response = await fetch('/api/files');
    state.files = await response.json();
    renderFiles();
  } catch (error) {
    console.error('Failed to fetch files:', error);
    showToast('Failed to load files', 'error');
  }
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  
  // Show progress
  elements.uploadProgress.style.display = 'block';
  elements.progressFill.style.width = '0%';
  elements.progressPercent.textContent = '0%';
  
  try {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        elements.progressFill.style.width = `${percent}%`;
        elements.progressPercent.textContent = `${percent}%`;
      }
    });
    
    xhr.addEventListener('load', async () => {
      elements.uploadProgress.style.display = 'none';
      
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        showToast(`${response.files.length} file(s) uploaded!`, 'success');
        // Files are added via socket event
        await fetchFiles();
      } else {
        showToast('Upload failed', 'error');
      }
    });
    
    xhr.addEventListener('error', () => {
      elements.uploadProgress.style.display = 'none';
      showToast('Upload failed', 'error');
    });
    
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  } catch (error) {
    elements.uploadProgress.style.display = 'none';
    showToast('Upload failed', 'error');
    console.error('Upload error:', error);
  }
}

async function deleteFile(filename) {
  try {
    const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('File deleted', 'success');
      // File will be removed via socket event
    } else {
      showToast('Failed to delete file', 'error');
    }
  } catch (error) {
    showToast('Failed to delete file', 'error');
    console.error('Delete error:', error);
  }
}

async function deleteAllFiles() {
  const filesToDelete = [...state.files];
  for (const file of filesToDelete) {
    await deleteFile(file.filename);
  }
}

function downloadFile(file) {
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.displayName || file.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadAll() {
  window.location.href = '/api/download-all';
  showToast('Preparing ZIP download...', 'info');
}

// ============================================
// File Preview Modal
// ============================================
async function showPreview(file) {
  elements.modalTitle.textContent = file.displayName || file.filename;
  elements.modalDownload.href = file.url;
  elements.modalDownload.download = file.displayName || file.filename;
  
  let content = '';
  
  switch (file.type) {
    case 'image':
      content = `<img src="${file.url}" alt="${file.displayName}" />`;
      break;
      
    case 'video':
      content = `<video src="${file.url}" controls autoplay></video>`;
      break;
      
    case 'audio':
      content = `<audio src="${file.url}" controls autoplay></audio>`;
      break;
      
    case 'pdf':
      content = `<iframe src="${file.url}" title="${file.displayName}"></iframe>`;
      break;
      
    case 'code':
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(file.filename)}/content`);
        const data = await response.json();
        const escaped = data.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        content = `<pre><code>${escaped}</code></pre>`;
      } catch {
        content = `<div class="preview-error">Cannot preview this file</div>`;
      }
      break;
      
    default:
      content = `
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">${getFileIcon(file.type)}</div>
          <p style="color: var(--text-secondary);">Preview not available for this file type</p>
          <p style="font-size: 0.875rem; color: var(--text-muted);">${formatFileSize(file.size)}</p>
        </div>
      `;
  }
  
  elements.modalBody.innerHTML = content;
  elements.previewModal.classList.add('active');
}

function closePreview() {
  elements.previewModal.classList.remove('active');
  // Stop any playing media
  const video = elements.modalBody.querySelector('video');
  const audio = elements.modalBody.querySelector('audio');
  if (video) video.pause();
  if (audio) audio.pause();
}

// ============================================
// Confirm Modal
// ============================================
function showConfirm(title, message, onConfirm) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  state.pendingDelete = onConfirm;
  elements.confirmModal.classList.add('active');
}

function closeConfirm() {
  elements.confirmModal.classList.remove('active');
  state.pendingDelete = null;
}

function executeConfirm() {
  if (state.pendingDelete) {
    state.pendingDelete();
  }
  closeConfirm();
}

// ============================================
// Render Files Grid
// ============================================
function renderFiles() {
  // Update file count and actions visibility
  const fileCount = state.files.length;
  elements.fileCount.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
  elements.fileActions.style.display = fileCount > 0 ? 'flex' : 'none';
  elements.emptyState.classList.toggle('visible', fileCount === 0);
  
  // Clear and rebuild grid
  elements.filesGrid.innerHTML = '';
  
  state.files.forEach((file, index) => {
    const card = createFileCard(file, index);
    elements.filesGrid.appendChild(card);
  });
}

function createFileCard(file, index) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.style.animationDelay = `${index * 0.05}s`;
  
  let previewContent = '';
  
  switch (file.type) {
    case 'image':
      previewContent = `<img src="${file.url}" alt="${file.displayName}" loading="lazy" />`;
      break;
    case 'video':
      previewContent = `
        <video src="${file.url}" muted preload="metadata"></video>
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 2rem; opacity: 0.8;">▶️</span>
        </div>
      `;
      break;
    default:
      previewContent = `<span class="file-type-icon">${getFileIcon(file.type, file.extension)}</span>`;
  }
  
  card.innerHTML = `
    <div class="file-card-preview">
      ${previewContent}
      <div class="file-card-actions">
        <button class="file-action-btn download" title="Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="file-action-btn delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="file-card-info">
      <div class="file-card-name" title="${file.displayName}">${file.displayName}</div>
      <div class="file-card-meta">
        <span>${formatFileSize(file.size)}</span>
        <span>${formatTimeAgo(file.uploadedAt)}</span>
      </div>
    </div>
  `;
  
  // Event Listeners
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.file-action-btn')) {
      showPreview(file);
    }
  });
  
  const downloadBtn = card.querySelector('.file-action-btn.download');
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadFile(file);
  });
  
  const deleteBtn = card.querySelector('.file-action-btn.delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm(
      'Delete File?',
      `Are you sure you want to delete "${file.displayName}"?`,
      () => deleteFile(file.filename)
    );
  });
  
  return card;
}

// ============================================
// Drag & Drop
// ============================================
function initDragDrop() {
  let dragCounter = 0;
  
  // Prevent default drag behaviors on window
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  // Handle drag enter/leave for visual feedback
  document.body.addEventListener('dragenter', (e) => {
    dragCounter++;
    elements.dropZone.classList.add('drag-over');
  });
  
  document.body.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter === 0) {
      elements.dropZone.classList.remove('drag-over');
    }
  });
  
  // Handle drop
  document.body.addEventListener('drop', (e) => {
    dragCounter = 0;
    elements.dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFiles(files);
    }
  });
  
  // Click to browse
  elements.dropZone.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  // Keyboard support for drop zone
  elements.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elements.fileInput.click();
    }
  });
  
  elements.browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.fileInput.click();
  });
  
  elements.fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input
    e.target.value = '';
  });
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Copy URL
  elements.copyBtn.addEventListener('click', async () => {
    const url = elements.shareUrl.textContent;
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied to clipboard!', 'success');
    } catch {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('URL copied to clipboard!', 'success');
      } catch {
        showToast('Failed to copy. Please copy manually: ' + url, 'error');
      }
    }
  });
  
  // Download all
  elements.downloadAllBtn.addEventListener('click', downloadAll);
  
  // Delete all
  elements.deleteAllBtn.addEventListener('click', () => {
    showConfirm(
      'Delete All Files?',
      'This will permanently delete all uploaded files.',
      deleteAllFiles
    );
  });
  
  // Preview modal
  elements.modalClose.addEventListener('click', closePreview);
  elements.previewModal.addEventListener('click', (e) => {
    if (e.target === elements.previewModal) {
      closePreview();
    }
  });
  
  // Confirm modal
  elements.confirmCancel.addEventListener('click', closeConfirm);
  elements.confirmDelete.addEventListener('click', executeConfirm);
  elements.confirmModal.addEventListener('click', (e) => {
    if (e.target === elements.confirmModal) {
      closeConfirm();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePreview();
      closeConfirm();
    }
  });
}

// ============================================
// Initialize App
// ============================================
async function init() {
  initTheme();
  initDragDrop();
  initEventListeners();
  initSocket();
  
  await fetchServerInfo();
  await fetchFiles();
  
  console.log('✦ LocalDrop initialized');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

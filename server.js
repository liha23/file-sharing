const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Rate limiting configuration (generous limits for local network use)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 30, // 30 uploads per minute per IP
  message: { error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve original filename with timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 500 } // 500MB limit
});

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Get file metadata
function getFileInfo(filename) {
  const filepath = path.join(UPLOADS_DIR, filename);
  try {
    const stats = fs.statSync(filepath);
    const ext = path.extname(filename).toLowerCase();
    
    // Determine file type
    let type = 'file';
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    const codeExts = ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.xml', '.md', '.yaml', '.yml', '.sh', '.rb', '.go', '.rs', '.php'];
    const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'];
    
    if (imageExts.includes(ext)) type = 'image';
    else if (videoExts.includes(ext)) type = 'video';
    else if (audioExts.includes(ext)) type = 'audio';
    else if (ext === '.pdf') type = 'pdf';
    else if (codeExts.includes(ext) || ext === '.txt') type = 'code';
    else if (archiveExts.includes(ext)) type = 'archive';
    
    // Extract display name from stored filename (removes timestamp suffix)
    // Format: originalname-timestamp-random.ext -> originalname.ext
    const nameWithoutExt = path.basename(filename, ext);
    const displayName = nameWithoutExt.replace(/-\d+-\d+$/, '') + ext;
    
    return {
      filename: filename,
      originalName: displayName,
      displayName: displayName,
      size: stats.size,
      type: type,
      extension: ext,
      uploadedAt: stats.mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(filename)}`
    };
  } catch (err) {
    return null;
  }
}

// API: Get server info
app.get('/api/info', apiLimiter, (req, res) => {
  const localIP = getLocalIP();
  res.json({
    ip: localIP,
    port: PORT,
    url: `http://${localIP}:${PORT}`,
    connectedClients: io.engine.clientsCount
  });
});

// API: List all files
app.get('/api/files', apiLimiter, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => !f.startsWith('.'))
      .map(filename => getFileInfo(filename))
      .filter(f => f !== null)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(files);
  } catch (err) {
    res.json([]);
  }
});

// API: Upload file(s)
app.post('/api/upload', uploadLimiter, upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  const uploadedFiles = req.files.map(file => {
    const info = getFileInfo(file.filename);
    // Broadcast new file to all clients
    io.emit('file:added', info);
    return info;
  });
  
  res.json({ success: true, files: uploadedFiles });
});

// Helper: Validate file path to prevent path traversal
function isValidFilePath(filename) {
  // Sanitize filename - only allow alphanumeric, dash, underscore, dot
  const sanitized = path.basename(filename);
  if (sanitized !== filename || filename.includes('..')) {
    return false;
  }
  const filepath = path.normalize(path.join(UPLOADS_DIR, filename));
  return filepath.startsWith(UPLOADS_DIR + path.sep) || filepath === path.join(UPLOADS_DIR, filename);
}

// API: Delete file
app.delete('/api/files/:filename', apiLimiter, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  
  // Security: Prevent path traversal
  if (!isValidFilePath(filename)) {
    return res.status(403).json({ error: 'Invalid file path' });
  }
  
  const filepath = path.join(UPLOADS_DIR, filename);
  
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      io.emit('file:deleted', { filename });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// API: Download all files as ZIP
app.get('/api/download-all', apiLimiter, (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
  
  if (files.length === 0) {
    return res.status(404).json({ error: 'No files to download' });
  }
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=LocalDrop-files.zip');
  
  const archive = archiver('zip', { zlib: { level: 5 } });
  
  // Handle archive errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    }
  });
  
  archive.pipe(res);
  
  files.forEach(filename => {
    const filepath = path.join(UPLOADS_DIR, filename);
    // Check file exists before adding
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filename);
      const nameWithoutExt = path.basename(filename, ext);
      const displayName = nameWithoutExt.replace(/-\d+-\d+$/, '') + ext;
      archive.file(filepath, { name: displayName });
    }
  });
  
  archive.finalize();
});

// API: Get file content (for text preview)
app.get('/api/files/:filename/content', apiLimiter, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  
  // Security: Prevent path traversal
  if (!isValidFilePath(filename)) {
    return res.status(403).json({ error: 'Invalid file path' });
  }
  
  const filepath = path.join(UPLOADS_DIR, filename);
  const ext = path.extname(filename).toLowerCase();
  
  // Only allow text-based file previews
  const textExts = ['.txt', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.xml', '.md', '.yaml', '.yml', '.sh', '.rb', '.go', '.rs', '.php', '.log', '.conf', '.ini'];
  if (!textExts.includes(ext)) {
    return res.status(400).json({ error: 'File type not supported for text preview' });
  }
  
  try {
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    res.json({ content: content.substring(0, 50000) }); // Limit to 50KB for preview
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  io.emit('clients:count', io.engine.clientsCount);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    io.emit('clients:count', io.engine.clientsCount);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n');
  console.log('  ╔═══════════════════════════════════════════════════════╗');
  console.log('  ║                                                       ║');
  console.log('  ║   ✦ LocalDrop is running!                             ║');
  console.log('  ║                                                       ║');
  console.log(`  ║   Local:   http://localhost:${PORT}                      ║`);
  console.log(`  ║   Network: http://${localIP}:${PORT}                   ║`);
  console.log('  ║                                                       ║');
  console.log('  ║   Share the Network URL with other devices            ║');
  console.log('  ║   on your local network to start sharing files!       ║');
  console.log('  ║                                                       ║');
  console.log('  ╚═══════════════════════════════════════════════════════╝');
  console.log('\n');
});

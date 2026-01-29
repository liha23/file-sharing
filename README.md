# LocalDrop ✦

> Cross-platform local network file sharing made beautiful

![LocalDrop Banner](https://img.shields.io/badge/LocalDrop-File%20Sharing-8B5CF6?style=for-the-badge)

A stunning, modern file-sharing web application that enables seamless file transfers between any devices on the same local network. No cloud, no accounts — just instant peer-to-peer sharing.

## ✨ Features

- **🌐 Local Network Sharing** - Devices on the same WiFi/LAN can share files instantly
- **📱 QR Code Access** - Scan to connect from any mobile device
- **🎨 Stunning UI** - Glassmorphism design with smooth animations
- **🌙 Dark/Light Mode** - Toggle between themes
- **📤 Drag & Drop** - Easy file uploads with visual feedback
- **👀 File Previews** - Images, videos, audio, PDFs, and code files
- **📦 Download All** - Export all files as a ZIP archive
- **⚡ Real-time** - Live updates across all connected devices

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/localdrop.git
cd localdrop

# Install dependencies
npm install

# Start the server
npm start
```

The app will start and display:
- Local URL: `http://localhost:3000`
- Network URL: `http://192.168.x.x:3000`

### Usage

1. Open the Network URL on any device connected to the same network
2. Or scan the QR code displayed on the page
3. Drag and drop files or click to browse
4. Files are instantly available on all connected devices
5. Download individual files or all as ZIP

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla HTML/CSS/JS
- **File Handling**: Multer, Archiver
- **Styling**: CSS Custom Properties, Glassmorphism

## 📁 Project Structure

```
localdrop/
├── public/
│   ├── index.html    # Main HTML file
│   ├── styles.css    # Glassmorphism styles
│   └── app.js        # Frontend JavaScript
├── uploads/          # Uploaded files (auto-created)
├── server.js         # Express server
├── package.json
└── README.md
```

## 🎨 Design

- **Glassmorphism** with frosted glass panels
- **Dark mode first** with light mode toggle
- **Fluid animations** on every interaction
- **Electric violet (#8B5CF6)** to **cyan (#06B6D4)** gradients
- **Deep space black** background with animated orbs

## 🔒 Privacy

- Files are stored locally only
- No data leaves your network
- Files are automatically cleaned on server restart
- No accounts or tracking

## 📝 License

MIT License - feel free to use this for personal or commercial projects.

---

Made with ✦ by LocalDrop

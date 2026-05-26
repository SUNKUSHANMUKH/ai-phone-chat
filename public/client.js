const socket = io();
let currentRoom = null;
let isAiStreaming = false;
let streamingTempDiv = null;
let currentStreamingContent = '';

// DOM elements
const tabsList = document.getElementById('tabsList');
const newTabBtn = document.getElementById('newTabBtn');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const darkModeToggle = document.getElementById('darkModeToggle');
const callStatusText = document.getElementById('callStatusText');

// Toast helper
function showToast(message, duration = 2000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Helper: format time
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper: escape HTML
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Add message to UI
function addMessageToUI(text, sender, timestamp = Date.now(), isStreaming = false) {
  const div = document.createElement('div');
  div.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
  if (isStreaming) div.classList.add('streaming-message');
  div.innerHTML = `<div>${escapeHtml(text)}</div><div class="timestamp">${formatTime(timestamp)}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// Streaming handlers
function startStreaming() {
  if (streamingTempDiv) streamingTempDiv.remove();
  streamingTempDiv = document.createElement('div');
  streamingTempDiv.className = 'message ai-message streaming-message';
  streamingTempDiv.innerHTML = `<div><span class="stream-text"></span></div><div class="timestamp">${formatTime(Date.now())}</div>`;
  chatMessages.appendChild(streamingTempDiv);
  currentStreamingContent = '';
  isAiStreaming = true;
  typingIndicator.style.display = 'flex';
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendChunk(chunk) {
  if (!streamingTempDiv) return;
  currentStreamingContent += chunk;
  const span = streamingTempDiv.querySelector('.stream-text');
  if (span) span.innerText = currentStreamingContent;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function finishStreaming() {
  if (streamingTempDiv) {
    streamingTempDiv.classList.remove('streaming-message');
    const fullText = currentStreamingContent;
    streamingTempDiv.innerHTML = `<div>${escapeHtml(fullText)}</div><div class="timestamp">${formatTime(Date.now())}</div>`;
    streamingTempDiv = null;
  }
  isAiStreaming = false;
  typingIndicator.style.display = 'none';
  currentStreamingContent = '';
}

function handleInterruption() {
  if (streamingTempDiv) {
    streamingTempDiv.remove();
    streamingTempDiv = null;
    showToast('⏸️ Interrupted! AI stopped and will respond to your new message.');
  }
  isAiStreaming = false;
  typingIndicator.style.display = 'none';
  currentStreamingContent = '';
}

// Load history
function loadHistory(history) {
  chatMessages.innerHTML = '';
  if (history.length === 0) {
    const welcome = document.createElement('div');
    welcome.className = 'welcome-message';
    welcome.innerText = '✨ New call – AI will start speaking first ✨';
    chatMessages.appendChild(welcome);
  } else {
    history.forEach(msg => {
      addMessageToUI(msg.content, msg.role, msg.timestamp);
    });
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Socket events
socket.on('history-load', (history) => {
  if (currentRoom) loadHistory(history);
});

socket.on('ai-start', () => {
  startStreaming();
});

socket.on('ai-chunk', (chunk) => {
  appendChunk(chunk);
});

socket.on('ai-end', () => {
  finishStreaming();
});

socket.on('interrupted', () => {
  handleInterruption();
});

socket.on('ai-error', (err) => {
  console.error('AI error:', err);
  finishStreaming();
  addMessageToUI(`Error: ${err}`, 'ai');
  showToast('⚠️ AI error occurred', 3000);
});

// Send user message
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  if (currentRoom === null) {
    showToast('Please create or select a call first', 1500);
    return;
  }

  addMessageToUI(text, 'user');
  messageInput.value = '';

  const isInterruption = isAiStreaming;
  if (isInterruption) {
    handleInterruption();
  }

  socket.emit('user-message', { roomId: currentRoom, message: text, isInterruption });
}

// Tab Management
let tabs = [];

function createNewTab() {
  const id = 'room_' + Date.now();
  const name = `Call ${tabs.length + 1}`;
  tabs.push({ id, name });
  renderTabs();
  switchToTab(id);
  showToast(`📞 New call started: ${name}`);
}

function switchToTab(roomId) {
  if (currentRoom === roomId) return;
  currentRoom = roomId;
  socket.emit('join-room', roomId);
  // Update active tab UI
  document.querySelectorAll('.tab-item').forEach(tab => {
    if (tab.dataset.room === roomId) tab.classList.add('active');
    else tab.classList.remove('active');
  });
  // Clear ongoing streaming UI
  handleInterruption();
  callStatusText.innerText = 'Connected';
}

function closeTab(roomId, event) {
  event.stopPropagation();
  const index = tabs.findIndex(t => t.id === roomId);
  if (index !== -1) tabs.splice(index, 1);
  renderTabs();
  if (currentRoom === roomId) {
    if (tabs.length > 0) switchToTab(tabs[0].id);
    else {
      currentRoom = null;
      chatMessages.innerHTML = '<div class="welcome-message">📞 Create a new call to start chatting with AI</div>';
      callStatusText.innerText = 'No call active';
    }
  }
  showToast(`Closed ${roomId}`, 1000);
}

function renderTabs() {
  tabsList.innerHTML = '';
  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-item';
    if (currentRoom === tab.id) tabDiv.classList.add('active');
    tabDiv.dataset.room = tab.id;
    tabDiv.innerHTML = `<span>📞 ${escapeHtml(tab.name)}</span><button class="tab-close">✕</button>`;
    tabDiv.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      switchToTab(tab.id);
    });
    tabDiv.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tab.id, e));
    tabsList.appendChild(tabDiv);
  });
}

// Dark mode
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  const isDark = document.body.classList.contains('dark');
  darkModeToggle.textContent = isDark ? '☀️' : '🌙';
});
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark');
  darkModeToggle.textContent = '☀️';
} else {
  darkModeToggle.textContent = '🌙';
}

// Event listeners
newTabBtn.addEventListener('click', createNewTab);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Create first tab on load
createNewTab();

// Optional: idle detection UI hint (backend already does, but we can show toast when backend sends idle message? Not needed as AI will message)
// Add a small pulse to status when idle? Not required.
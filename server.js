require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory stores
const conversationHistory = new Map();   // roomId -> array of messages
const activeStreams = new Map();         // roomId -> AbortController
const lastActivity = new Map();           // roomId -> timestamp
const idleTimers = new Map();             // roomId -> NodeJS.Timeout

const IDLE_SECONDS = 15; // seconds before AI says "are you still there?"

// Helper: Save message to history
function addMessage(roomId, role, content, metadata = {}) {
  if (!conversationHistory.has(roomId)) {
    conversationHistory.set(roomId, []);
  }
  const msg = { role, content, timestamp: Date.now(), ...metadata };
  conversationHistory.get(roomId).push(msg);
  return msg;
}

// Helper: Get history (last 20 messages for context)
function getHistory(roomId) {
  return (conversationHistory.get(roomId) || []).slice(-20);
}

// Helper: Update last activity and reset idle timer
function updateActivity(roomId) {
  lastActivity.set(roomId, Date.now());
  if (idleTimers.has(roomId)) clearTimeout(idleTimers.get(roomId));
  // Set new idle timer
  const timer = setTimeout(() => {
    checkIdleAndRespond(roomId);
  }, IDLE_SECONDS * 1000);
  idleTimers.set(roomId, timer);
}

// Idle check and automatic AI message
async function checkIdleAndRespond(roomId) {
  const last = lastActivity.get(roomId);
  if (!last) return;
  const now = Date.now();
  if (now - last >= IDLE_SECONDS * 1000) {
    // Only respond if not already streaming
    if (!activeStreams.has(roomId)) {
      // Send "are you still there?" as AI message
      addMessage(roomId, 'assistant', 'Hello, are you still there?', { autoIdle: true });
      const history = getHistory(roomId);
      // Emit this message as a normal AI response (no streaming for idle message, but we stream anyway for consistency)
      startStreamingResponse(roomId, history.slice(-1)[0].content); // just send that one message
      updateActivity(roomId); // reset timer after sending
    } else {
      // If streaming, wait a bit then re-check
      setTimeout(() => checkIdleAndRespond(roomId), 2000);
    }
  }
}

// Function to stream AI response (full conversation)
async function startStreamingResponse(roomId, userMessageContent = null) {
  // If we already have an active stream in this room, abort it (interruption)
  if (activeStreams.has(roomId)) {
    activeStreams.get(roomId).abort();
    activeStreams.delete(roomId);
    // Notify frontend that stream was interrupted
    io.to(roomId).emit('interrupted');
  }

  const history = getHistory(roomId);
  if (history.length === 0) {
    // First message – AI starts conversation
    const initialMsg = "Hello! I'm your AI phone call assistant. How can I help you today?";
    addMessage(roomId, 'assistant', initialMsg);
    io.to(roomId).emit('ai-start');
    // Stream character by character slowly for demo
    await streamTextSlowly(roomId, initialMsg);
    io.to(roomId).emit('ai-end');
    return;
  }

  // Prepare messages for OpenAI (excluding auto-idle messages if needed, but fine)
  const openAiMessages = history.map(m => ({ role: m.role, content: m.content }));

  try {
    const controller = new AbortController();
    activeStreams.set(roomId, controller);

    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: openAiMessages,
      stream: true,
    }, { signal: controller.signal });

    let fullResponse = '';
    io.to(roomId).emit('ai-start');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        io.to(roomId).emit('ai-chunk', content);
        // Add artificial delay to make interruptions easy (slow streaming)
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms per chunk
      }
    }

    // Save the complete response to history
    addMessage(roomId, 'assistant', fullResponse);
    io.to(roomId).emit('ai-end');
    activeStreams.delete(roomId);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`Stream in room ${roomId} was interrupted.`);
      // Don't save the partial response
    } else {
      console.error('OpenAI error:', err);
      io.to(roomId).emit('ai-error', err.message);
    }
    activeStreams.delete(roomId);
  }
}

// Helper to simulate slow streaming for simple text (used for idle message)
async function streamTextSlowly(roomId, text) {
  const words = text.split('');
  for (let i = 0; i < words.length; i++) {
    io.to(roomId).emit('ai-chunk', words[i]);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    // Send existing history for this room
    const history = conversationHistory.get(roomId) || [];
    socket.emit('history-load', history);
    // Update activity
    updateActivity(roomId);
  });

  socket.on('user-message', async ({ roomId, message, isInterruption }) => {
    console.log(`Message in ${roomId}: ${message} (interruption: ${isInterruption})`);
    // Add user message to history
    addMessage(roomId, 'user', message);
    // Update activity (resets idle timer)
    updateActivity(roomId);
    // If there's an active stream, it will be aborted inside startStreamingResponse
    await startStreamingResponse(roomId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Cleanup timers for rooms where this socket was the last? For simplicity, leave as is.
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
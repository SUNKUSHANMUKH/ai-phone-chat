# 📞 Real-Time AI Chat Application – AI Phone Call

A WebSocket-based chat where the AI speaks first, streams responses **slowly** (so you can interrupt it), detects user idle time, and supports multiple independent conversations (tabs). Built with Node.js, Socket.IO, OpenAI API, and a modern responsive frontend.

![Demo Screenshot](https://via.placeholder.com/800x400?text=AI+Phone+Call+Demo)  
*(Add your own screenshot later)*

---

## ✨ Features

- **AI starts the conversation** – like a real phone call.
- **Streaming AI responses** – character‑by‑character (adjustable speed) to allow interruptions.
- **User interruptions** – type & send while AI is still speaking; the AI stops immediately and answers your new message.
- **Full conversation history** – maintained per chat tab, including interruption context.
- **Idle detection** – after 15 seconds of inactivity, AI asks *“Hello, are you still there?”*.
- **Multiple chat tabs** – independent conversations, each with its own history and streaming state.
- **Dark mode** – toggle between light and dark themes (persisted in localStorage).
- **Toast notifications** – visual feedback for interruptions, errors, and new calls.
- **Typing indicator** – animated dots when AI is thinking.
- **Responsive design** – works on desktop and mobile.

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | Node.js, Express, Socket.IO         |
| AI API      | OpenAI Chat Completions (streaming) |
| Frontend    | HTML5, CSS3, Vanilla JavaScript     |
| Real‑time   | WebSockets (Socket.IO)              |
| Styling     | CSS variables, animations, gradients|

---

## 📁 Project Structure

```
ai-phone-chat/
├── server.js              # Backend with Socket.IO & OpenAI streaming
├── package.json           # Dependencies & scripts
├── .env                   # Environment variables (API key, port)
├── public/
│   ├── index.html         # Main UI structure
│   ├── style.css          # Modern styling + dark mode
│   └── client.js          # Frontend logic (tabs, streaming, interruptions)
└── README.md              # This file
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ai-phone-chat.git
   cd ai-phone-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**  
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   PORT=3000
   ```

4. **Run the server**
   ```bash
   npm start
   ```

5. **Open your browser**  
   Navigate to `http://localhost:3000`

---

## 🎮 How to Use

### Starting a conversation
- When you open the app, a new call tab is created automatically.
- The AI will send the first message: *“Hello! I'm your AI phone call assistant…”*

### Sending messages
- Type your response in the input box and press **Send** or hit **Enter**.

### Interrupting the AI
- While the AI is streaming its answer (word by word), **type a new message and send it**.
- The AI will stop immediately and respond to your new message.
- A toast notification will confirm the interruption.

### Multiple calls (tabs)
- Click **+ New Call** to start a separate conversation.
- Switch between tabs – each has its own history and can be interrupted independently.
- Close a tab by clicking the **✕** button on the tab.

### Idle detection
- If you don’t type anything for **15 seconds**, the AI will automatically say *“Hello, are you still there?”* – just like a real phone call.

### Dark mode
- Click the **🌙** (moon) button in the top right to toggle dark mode. Your preference is saved.

---

## 🧠 Architecture Overview

```
┌─────────────┐      WebSocket (Socket.IO)      ┌─────────────┐
│   Browser   │ ◄─────────────────────────────► │   Node.js   │
│  (Frontend) │      rooms, events, chunks      │   Server    │
└─────────────┘                                  └──────┬──────┘
                                                        │
                                                        │ HTTP (streaming)
                                                        ▼
                                                  ┌─────────────┐
                                                  │  OpenAI API │
                                                  │ (GPT-3.5/4) │
                                                  └─────────────┘
```

- Each browser tab joins a unique **Socket.IO room**.
- The server stores conversation history per room in memory.
- When a user sends a message, the server calls OpenAI’s streaming API.
- If another message arrives **while a stream is active**, the server:
  - Aborts the previous stream (using `AbortController`).
  - Appends the new user message to history.
  - Starts a **new** streaming response.
- Idle detection: a timer resets on every user message; after timeout, the server triggers an automatic AI message.
- The frontend displays streaming chunks, manages the UI for multiple tabs, and sends interruption flags.

---

## 🧪 Testing Interruptions & Idle

### To test interruptions:
1. Send any message to the AI.
2. While the AI is still typing (slowly), type a new message like *“No, tell me about X instead”* and send it.
3. The AI will stop mid‑sentence and immediately start responding to your interruption.

### To test idle detection:
1. Wait for 15 seconds without typing anything.
2. The AI will automatically send: *“Hello, are you still there?”*

---

## ⚙️ Configuration

You can adjust these settings in `server.js`:

| Variable          | Description                          | Default |
|-------------------|--------------------------------------|---------|
| `IDLE_SECONDS`    | Idle timeout before auto‑message     | 15      |
| `model`           | OpenAI model (gpt-3.5-turbo, gpt-4)  | gpt-3.5-turbo |
| Streaming delay   | Artificial delay per chunk (in `startStreamingResponse`) | 50 ms |

---

## 📝 Possible Improvements

- Persist conversations in a database (MongoDB, PostgreSQL).
- Add user authentication (login with Google/GitHub).
- Voice input / text‑to‑speech (Web Speech API).
- Show interruption point (highlight how many words were spoken before interruption).
- Deploy to a cloud platform (Render, Heroku, Fly.io).

---

## 🐛 Troubleshooting

| Issue                                      | Solution |
|--------------------------------------------|----------|
| `Error: 401 Unauthorized`                 | Check your `OPENAI_API_KEY` in `.env` and restart the server. |
| AI responses are too fast (hard to interrupt) | Increase the artificial delay in `server.js` (the `setTimeout` after each chunk). |
| Messages not showing in a new tab          | Make sure you’re joining the room correctly; check browser console for errors. |
| Dark mode not persisting                   | Dark mode preference is saved in `localStorage`; clear it if needed. |

---

## Acknowledgements

- [OpenAI](https://openai.com) for the streaming API.
- [Socket.IO](https://socket.io) for real‑time WebSocket abstraction.
- All contributors and open‑source libraries used.

---

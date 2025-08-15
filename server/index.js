import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import connectDB from "./db.js";
import MemoryEntry from "./models/MemoryEntry.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Groq AI setup
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Analyze memory for summary & emotions
const analyzeMemory = async (text) => {
  try {
    const prompt = `
      Summarize the following memory in 1–2 sentences.
      Then, list 3–5 emotions the user might be feeling, comma-separated.
      Memory: "${text}"
    `;
    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
    });
    const output = completion.choices[0].message.content;
    const [summaryLine, emotionsLine] = output.split("\n");
    const summary = summaryLine?.replace("Summary:", "").trim() || "";
    const emotions = emotionsLine?.replace("Emotions:", "").split(",").map(e => e.trim()) || [];
    return { summary, emotions };
  } catch (err) {
    console.error("Groq AI error:", err);
    return { summary: "", emotions: [] };
  }
};

// ----------------------
// POST: AI chat or memory
// ----------------------
app.post("/api/message", async (req, res) => {
  const { userId, message, type, sessionId } = req.body;
  if (!userId || !message || !type) return res.status(400).json({ error: "Missing required fields." });

  try {
// ChatGPT-style system prompt
const systemPrompt = `
You are EchoMe AI, a highly intelligent and friendly personal AI assistant.
- Always answer every question clearly, concisely, and in detail.
- For coding questions:
  - Provide complete code in proper code blocks.
  - Include step-by-step explanations.
  - Highlight key steps in numbered lists.
  - Provide examples where applicable.
  - Provide copyable code blocks for ease of use.
- For links, commands, or reference text:
  - Provide them in copyable blocks.
  - Use clickable markdown links where possible.
  - Ensure formatting is clear and accessible.
- For technical, scientific, or mathematical questions:
  - Explain step-by-step.
  - Break down complex concepts.
  - Use examples, tables, or numbered lists if it helps understanding.
- For general advice or instructions:
  - Be friendly, helpful, and polite.
  - Offer additional tips or warnings if relevant.
- When summarizing memories:
  - Always provide a 1-2 sentence summary.
  - List 3-5 possible emotions in comma-separated form.
- Remember all previous messages in the same session to maintain context.
- Never give short or vague answers unless explicitly requested.
- Prioritize user clarity, safety, and practical usefulness.
- Format all responses with markdown for readability.
- If unsure about a user request, ask clarifying questions instead of guessing.
- Adapt tone to be helpful, patient, and engaging.
- If responding with code or commands, always include a "copy" friendly format.
- Avoid unnecessary repetition and filler text.
- Respond to errors or unclear inputs gracefully.
- Encourage the user with constructive guidance where appropriate.
- Include examples, illustrations, or analogies if it aids understanding.
- Keep messages concise but complete; balance detail with readability.
`;

// Previous session messages
let previousMessages = [];
if (sessionId) {
  previousMessages = await MemoryEntry.find({ user: userId, sessionId, type: "chat" }).sort({ date: 1 });
}

const messagesForAI = [
  { role: "system", content: systemPrompt },
  ...previousMessages.map(m => ({ role: "user", content: m.message })),
  { role: "user", content: message }
];

const chatCompletion = await groq.chat.completions.create({
  model: "llama3-70b-8192",
  messages: messagesForAI,
});

const reply = chatCompletion.choices[0].message.content;

let summary = "", emotions = [];
if (type === "memory") {
  const analysis = await analyzeMemory(message);
  summary = analysis.summary;
  emotions = analysis.emotions;
}

const newEntry = new MemoryEntry({
  user: userId,
  message,
  aiResponse: reply,
  type,
  sessionId: sessionId || null,
  summary,
  emotions,
});

await newEntry.save();
res.json({ reply, entry: newEntry });

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI error. Try again." });
  }
});

// ----------------------
// GET: Memories
// ----------------------
app.get("/api/memories/:userId", async (req, res) => {
  try {
    const entries = await MemoryEntry.find({ user: req.params.userId, type: "memory" }).sort({ date: -1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ error: "Failed to fetch memories." }); }
});

// ----------------------
// GET: Sessions
// ----------------------
app.get("/api/sessions/:userId", async (req, res) => {
  try {
    const sessions = await MemoryEntry.distinct("sessionId", { user: req.params.userId, type: "chat" });
    res.json(sessions.filter(s => s));
  } catch (err) { res.status(500).json({ error: "Failed to fetch sessions." }); }
});

// ----------------------
// GET: Chat messages for session
// ----------------------
app.get("/api/chats/:userId/:sessionId", async (req, res) => {
  try {
    const entries = await MemoryEntry.find({ user: req.params.userId, type: "chat", sessionId: req.params.sessionId }).sort({ date: 1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ error: "Failed to fetch chat messages." }); }
});

app.get("/", (req, res) => res.send("✅ Server is alive!"));

// ---------- Dynamic port for Replit ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

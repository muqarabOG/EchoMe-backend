import mongoose from "mongoose";

const memorySchema = new mongoose.Schema({
  user: { type: String, required: true },
  sessionId: { type: String },
  message: { type: String, required: true },
  aiResponse: { type: String },
  type: { type: String, enum: ["chat", "memory"], required: true },
  summary: { type: String },
  emotions: [{ type: String }],
  date: { type: Date, default: Date.now },
});

const MemoryEntry = mongoose.model("MemoryEntry", memorySchema);
export default MemoryEntry;

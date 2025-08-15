// routes/memories.js
import express from "express";
import MemoryEntry from "./models/MemoryEntry.js";
import { protect } from "./middleware/authMiddleware.js";

const router = express.Router();

// ✅ Save a memory
router.post("/", protect, async (req, res) => {
  try {
    const { text, aiResponse } = req.body;
    const newMemory = await MemoryEntry.create({
      user: req.user._id,
      text,
      aiResponse,
    });
    res.status(201).json(newMemory);
  } catch (err) {
    console.error("Memory save error:", err);
    res.status(500).json({ error: "Failed to save memory" });
  }
});

// ✅ Get all memories
router.get("/", protect, async (req, res) => {
  try {
    const memories = await MemoryEntry.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(memories);
  } catch (err) {
    console.error("Memory fetch error:", err);
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

export default router;

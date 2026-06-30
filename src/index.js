import express from "express";
import dotenv from "dotenv";
import { generateResponse } from "./claudeClient.js";

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send({ status: "Claude project is running", port });
});

app.post("/chat", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt in request body." });
    }

    const answer = await generateResponse(prompt);
    res.json({ prompt, answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message ?? "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Claude project running on http://localhost:${port}`);
});

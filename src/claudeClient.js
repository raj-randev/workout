import { Client } from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL ?? "claude-3.5";

if (!apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY in environment variables.");
}

const client = new Client(apiKey);

export async function generateResponse(prompt) {
  const response = await client.complete({
    model,
    prompt,
    max_tokens_to_sample: 1000,
  });

  return response.completion?.trim() ?? "";
}

import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Haiku handles every command by default; a command that Haiku can't map
// to any tool (no tool_use in its response) gets one retry on Sonnet,
// since that's the concrete, observable signature of an "ambiguous" command.
export const MODEL_FAST = "claude-haiku-4-5-20251001";
export const MODEL_CAPABLE = "claude-sonnet-5";

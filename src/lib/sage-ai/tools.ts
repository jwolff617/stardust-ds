import type Anthropic from "@anthropic-ai/sdk";

// Each tool is one Core verb (Add, Remove, Edit, Delete, Find, Share,
// Label) applied to one noun. Verbs that need someone on the other end
// (Connect, Match, Message, Email, Call, Vote) or money (Buy, Sell, Trade,
// Give) have no tool yet.
export const SAGE_AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "note_write",
    description: "Add: write a new Note in the user's Night DS. Notes have no title, only content.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "The note's content." },
      },
      required: ["body"],
    },
  },
  {
    name: "note_edit",
    description:
      "Edit: replace the content of a Note, found by its number (its position in the user's active note list, 1-based).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
        body: { type: "string", description: "New content to replace the note with." },
      },
      required: ["number", "body"],
    },
  },
  {
    name: "note_search",
    description:
      "Find: look through this user's Notes by content. Archived notes are left out unless includeArchived is true.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for." },
        includeArchived: { type: "boolean" },
      },
      required: ["query"],
    },
  },
  {
    name: "note_delete",
    description:
      "Delete: erase a Note for good, found by its number (its position in the user's active note list, 1-based).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
      },
      required: ["number"],
    },
  },
  {
    name: "note_share",
    description:
      "Share: set a Note to public or private, found by its number (its position in the user's active note list, 1-based). Public notes can be read by other users.",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The note's number in the active list (1-based)." },
        visibility: { type: "string", enum: ["public", "private"], description: "'public' or 'private'." },
      },
      required: ["number", "visibility"],
    },
  },
  {
    name: "info_search",
    description:
      "Find: look up terms and definitions across every dictionary this user has on.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for." },
      },
      required: ["query"],
    },
  },
  {
    name: "dictionary_add",
    description: "Add: turn a dictionary on for this user, by name or address.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: { type: "string", description: "The dictionary's name or address." },
      },
      required: ["dictionary"],
    },
  },
  {
    name: "dictionary_remove",
    description:
      "Remove: turn a dictionary off for this user, by name or address. Locked dictionaries (Core, Stardust, both Profiles) always stay on.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: { type: "string", description: "The dictionary's name or address." },
      },
      required: ["dictionary"],
    },
  },
  {
    name: "dictionary_find",
    description:
      "Find: look for dictionaries by name, description, or label (e.g. 'match', 'marketplace', 'seattle'). Also finds other sparks' Public Profiles.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A word to look for." },
      },
      required: ["query"],
    },
  },
  {
    name: "dictionary_label",
    description:
      "Label: add or remove a label on a dictionary this user owns, including their own Public Profile, Night DS, and other personal dictionaries. Labels help people find the dictionary.",
    input_schema: {
      type: "object",
      properties: {
        dictionary: {
          type: "string",
          description: "The dictionary's name or address, e.g. 'Public Profile' or 'Night DS'.",
        },
        label: { type: "string", description: "One short word or phrase." },
        action: { type: "string", enum: ["add", "remove"] },
      },
      required: ["dictionary", "label", "action"],
    },
  },
  {
    name: "profile_edit",
    description:
      "Edit: change a field on this user's Private or Public Profile, and optionally whether a Public Profile field is public. Never accepts card numbers.",
    input_schema: {
      type: "object",
      properties: {
        profile: { type: "string", enum: ["private", "public"] },
        field: { type: "string", description: "The field's name, e.g. 'Neighborhood' or 'City'." },
        value: { type: "string", description: "The new value. Leave out to only change visibility." },
        visibility: { type: "string", enum: ["public", "private"] },
      },
      required: ["profile", "field"],
    },
  },
];

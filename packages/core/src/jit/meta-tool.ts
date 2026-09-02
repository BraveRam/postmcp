import { JSONSchemaObject } from '../parser/types.js';

export const TOOL_SEARCH_NAME = 'tool_search';

export const TOOL_SEARCH_DESCRIPTION =
  'Search the API for relevant operations and dynamically load the tools needed to accomplish a task. Call this tool first with keywords describing your intent (e.g. "refund invoice", "create user", "list projects").';

export const TOOL_SEARCH_INPUT_SCHEMA: JSONSchemaObject = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query describing the action you want to perform (e.g. "create issue", "get balance")',
    },
    tag: {
      type: 'string',
      description: 'Optional API tag or domain filter (e.g. "billing", "users", "repos")',
    },
    limit: {
      type: 'number',
      description: 'Max number of tools to mount (default: 5)',
    },
  },
  required: ['query'],
  additionalProperties: false,
};

#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
    TextContent,
    ErrorCode,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';

const API_KEY = process.env.PERPLEXITY_API_KEY;

if (!API_KEY) {
  throw new Error('PERPLEXITY_API_KEY environment variable is required');
}

// Types for Perplexity API
interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: PerplexityMessage;
  }>;
}

// Input schema for the web search tool
const WebSearchSchema = z.object({
  query: z.string().min(1),
  model: z.string().optional().default('sonar'),
  temperature: z.number().min(0).max(1).optional().default(0.7),
  max_tokens: z.number().optional(),
});

class PerplexityServer {
  private server: Server;
  private readonly defaultModel = 'sonar';

  constructor() {
    this.server = new Server(
      {
        name: 'perplexity-ai',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [{
        name: 'web_search',
        description: 'Performs web searches using Perplexity AI. Returns AI-generated answers with citations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query'
            },
            model: {
              type: 'string',
              description: 'Model to use for the response. Defaults to "sonar".',
              enum: ['sonar-reasoning-pro', 'sonar', 'sonar-pro']
            }
          },
          required: ['query']
        }
      }]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'web_search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        // Validate and parse input
        const params = WebSearchSchema.parse(request.params.arguments);
        
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model: params.model,
            messages: [{
              role: 'system',
              content: 'Be precise and concise. Provide a clear, factual answer with relevant details. Return only the final answer.'
            }, {
              role: 'user',
              content: params.query
            }],
            temperature: params.temperature,
            max_tokens: params.max_tokens
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new McpError(
            ErrorCode.InternalError,
            `Perplexity API error: ${error}`
          );
        }

        const responseJson = await response.json() as PerplexityResponse;

        // Format the response with citations if available
        const content: TextContent[] = [{
          type: 'text',
          text: responseJson.choices[0].message.content
        }];

        if (responseJson.citations?.length > 0) {
          content.push({
            type: 'text',
            text: '\n\nSources:\n' + responseJson.citations.map((url, i) => `${i + 1}. ${url}`).join('\n')
          });
        }

        return { content };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid input: ${error.message}`
          );
        }
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error: ${error}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Perplexity AI MCP server running on stdio');
  }
}

const server = new PerplexityServer();
server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
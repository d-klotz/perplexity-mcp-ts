# Perplexity MCP Server Configuration

This project provides MCP (Machine Control Protocol) servers for integrating with Perplexity AI. There are two server configurations available:

## 1. Perplexity Local Server

This is the local development server configuration:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["path/to/build/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-api-key"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

## Setup Instructions

1. Replace `your-api-key` with your actual Perplexity API key
2. For the local server, update the path in `args` to point to your built index.js file
3. Add these configurations to your project's MCP configuration file

## Security Note

⚠️ Never commit your API keys to version control. Instead:
- Use environment variables
- Store sensitive information in a secure configuration management system
- Add `.env` files to your `.gitignore`
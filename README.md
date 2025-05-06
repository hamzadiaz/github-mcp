# github-mcp: Git Manager

This MCP server provides tools to manage Git repositories through Cursor or other MCP-compatible editors.

## Table of Contents
- [Installation](#installation)
- [How to Use](#how-to-use)
- [Available Tools](#available-tools)
- [Project Setup & Cursor Integration](#project-setup--cursor-integration)
- [Development](#development)
- [Debugging](#debugging)

## Installation

1. **Install Project Dependencies (for development or if cloned):**
   ```bash
   npm install
   ```

2. **Build and Install Globally:**
   ```bash
   npm run deploy
   ```
   This compiles TypeScript code and installs the package globally, making `github-mcp` accessible from any terminal.

## How to Use

### Quick Start
1. Configure your Cursor to use github-mcp (see [Project Setup & Cursor Integration](#project-setup--cursor-integration))
2. In Cursor's chat, tell the AI to set your working directory (e.g., "load config for my project at C:/Users/MyName/MyProject") 
3. Use natural language commands in chat to trigger Git operations (e.g., "push my changes to Git", "pull from Git", or "initialize a Git repository")

### Important Notes
- The `WORKING_DIR` must be set using the `load_config` tool before any Git operations
- Log files are stored in `github-mcp-server.log` within your configured `WORKING_DIR`

### Basic Workflow Example
Here's how you might interact with the AI in Cursor's chat:

1. **Set working directory**: "Load the Git configuration for my project at C:/Users/YourUser/YourProject"
2. **Initialize a repository**: "Initialize a Git repository with the remote URL git@github.com:user/repo.git and set the default branch to main"
3. **Push changes**: "Push my changes to the main branch with the commit message 'Update documentation'"
4. **Pull changes**: "Pull the latest changes from the main branch"

Cursor's AI will translate these natural language commands into the appropriate tool calls.

### Natural Language to Tool Mapping
You don't need to use exact syntax - the AI will understand your intent and call the appropriate tools:

| Natural Language Request | Tool Called |
|--------------------------|-------------|
| "Load Git config for path/to/dir" | `mcp_github-mcp_load_config` |
| "Initialize Git repo with URL..." | `mcp_github-mcp_get_init` |
| "Push changes with message..." | `mcp_github-mcp_get_push` |
| "Pull from Git/Pull latest changes" | `mcp_github-mcp_get_pull` |
| "Get current working directory" | `mcp_github-mcp_get_config` |

## Available Tools

### `load_config`
Sets the working directory where Git operations will be performed.

```typescript
mcp_github-mcp_load_config({
  working_dir: string      // The absolute or relative path to your project's root directory
                           // Example: "C:/Users/YourUser/Desktop/my-project" or "./my-project"
})
```

### `get_config`
Retrieves the current working directory used for Git operations.

```typescript
mcp_github-mcp_get_config({})
```

### `get_init`
Initializes a new Git repository in the configured `WORKING_DIR`. It can also set up a remote origin and a default branch name.

```typescript
mcp_github-mcp_get_init({
  remoteUrl: string,        // The URL for the remote repository (e.g., "git@github.com:user/repo.git")
  defaultBranch?: string    // Optional: The name for the default branch (e.g., "main", "master")
})
```

### `get_pull`
Pulls the latest changes from a remote Git repository into the `WORKING_DIR`.

```typescript
mcp_github-mcp_get_pull({
  branch?: string,          // Optional: The specific branch to pull. Defaults to the current branch.
  remote?: string           // Optional: The remote to pull from. Defaults to "origin".
})
```

### `get_push`
Adds all current changes in the `WORKING_DIR` to the Git staging area, commits them with a provided message, and pushes them to a remote repository.

```typescript
mcp_github-mcp_get_push({
  commitMessage: string,    // A descriptive message for your commit
  branch?: string,          // Optional: The specific branch to push to. Defaults to the current branch.
  remote?: string           // Optional: The remote to push to. Defaults to "origin".
})
```

## Project Setup & Cursor Integration

### Step 1: Installation
Install the package globally as described in the [Installation](#installation) section.

### Step 2: Add Interaction Guidelines File

Create a file named `cursor_rules.mdc` in your project's root directory. This file contains guidelines for AI assistants to properly use the `github-mcp` tools.

Instead of copying content manually, you can reference the example file included in the `github-mcp` repository:

```bash
# Copy the cursor_rules.mdc file from the github-mcp repository to your project
cp node_modules/github-mcp/cursor_rules.mdc ./
```

or download it directly from the repository.

### Step 3: Configure Cursor MCP Settings

Update your MCP server configuration file:

-   **For Cursor on Windows:** Located at `C:\Users\YourUser\.cursor\mcp.json`
-   **For other setups or OS:** Check your specific editor's documentation

Add or update the `mcpServers` section:

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": [
        "github-mcp"
      ],
      "env": {}
    }
  }
}
```

After saving, **restart Cursor** for the changes to take effect.

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

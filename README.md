# github-mcp: Git Manager

This MCP server provides tools to manage Git repositories.

## General Usage Notes:
- Ensure all tool parameters are provided according to their defined schemas.
- If running separate terminal commands alongside this MCP server, PowerShell syntax is recommended (e.g., use `;` to separate commands, not `&&`).

## Important Implementation Notes:
- Log files are stored in the `github-mcp-server.log` file within the configured `WORKING_DIR`.
- The `WORKING_DIR` is set using the `load_config` tool.

## Tools:

### `load_config`
Sets the working directory where Git operations will be performed.

```typescript
mcp_github_mcp_load_config({
  working_dir: string      // The absolute or relative path to your project's root directory
                           // Example: "C:/Users/YourUser/Desktop/my-project" or "./my-project"
})
```

### `get_config`
Retrieves the current working directory used for Git operations.

```typescript
mcp_github_mcp_get_config({})
```

### `get_init`
Initializes a new Git repository in the configured `WORKING_DIR`. It can also set up a remote origin and a default branch name.

```typescript
mcp_github_mcp_get_init({
  remoteUrl: string,        // The URL for the remote repository (e.g., "git@github.com:user/repo.git")
  defaultBranch?: string    // Optional: The name for the default branch (e.g., "main", "master")
})
```

### `get_pull`
Pulls the latest changes from a remote Git repository into the `WORKING_DIR`.

```typescript
mcp_github_mcp_get_pull({
  branch?: string,          // Optional: The specific branch to pull. Defaults to the current branch.
  remote?: string           // Optional: The remote to pull from. Defaults to "origin".
})
```

### `get_push`
Adds all current changes in the `WORKING_DIR` to the Git staging area, commits them with a provided message, and pushes them to a remote repository.

```typescript
mcp_github_mcp_get_push({
  commitMessage: string,    // A descriptive message for your commit
  branch?: string,          // Optional: The specific branch to push to. Defaults to the current branch.
  remote?: string           // Optional: The remote to push to. Defaults to "origin".
})
```

## Project Setup & Cursor Integration

Follow these steps to install, configure, and integrate `github-mcp` for use with Cursor or other MCP-compatible editors.

### Step 1: Installation

1.  **Install Project Dependencies (for development or if cloned):**
    If you have cloned the `github-mcp` repository and want to develop it or build it from source, first install its dependencies:
    ```bash
    npm install
    ```
    This command reads the `package.json` file and downloads the necessary libraries into the `node_modules` directory.

2.  **Build and Install Globally:**
    To make the `github-mcp` command available system-wide, run the custom deploy script:
    ```bash
    npm run deploy
    ```
    This script typically performs two actions:
    *   `npm run build`: Compiles the TypeScript source code into JavaScript (usually into a `dist` folder).
    *   `npm i -g .`: Installs the current package (from the current directory `.`) globally (`-g`). This makes the command defined in `package.json`'s `bin` field (i.e., `github-mcp`) accessible from any terminal.

### Step 2: Create Interaction Guidelines File (Recommended)

For optimal interaction with AI assistants like Cursor when using `github-mcp`, it's recommended to have a set of guidelines available. Create a file named `cursor_rules.mdc` (or a similar name like `github_mcp_rules.mdc`) in your project's root directory, or a central location you can easily reference.

Copy the following content into this file:

```markdown
# github-mcp Interaction Guidelines

## General AI Assistant Rules:
- Only modify files explicitly named in user prompts.
- Do not create new files unless explicitly requested by the user.
- Avoid modifying existing code outside the scope of the user's current request.
- When instructing the user to run terminal commands, always provide PowerShell commands. Do not use `&&`; use `;` for chaining if necessary, or provide commands on separate lines.

## github-mcp Specific Notes:
- Before using Git tools (`get_init`, `get_pull`, `get_push`), ensure the user has configured the `WORKING_DIR` using the `load_config` tool.
- For the `get_push` tool, commit messages should be descriptive of the changes made.
- The primary operational context for this Git Manager is the `WORKING_DIR`.
- All server activity and Git command outputs are logged to `github-mcp-server.log` within the configured `WORKING_DIR`.

## `github-mcp` Tool Call Examples:

### `load_config`
```typescript
mcp_github_mcp_load_config({
  working_dir: string      // e.g., "C:/Users/YourUser/Desktop/my-project"
})
```

### `get_config`
```typescript
mcp_github_mcp_get_config({})
```

### `get_init`
```typescript
mcp_github_mcp_get_init({
  remoteUrl: string,        // e.g., "git@github.com:user/repo.git"
  defaultBranch?: string    // e.g., "main"
})
```

### `get_pull`
```typescript
mcp_github_mcp_get_pull({
  branch?: string,
  remote?: string           // Defaults to "origin"
})
```

### `get_push`
```typescript
mcp_github_mcp_get_push({
  commitMessage: string,
  branch?: string,
  remote?: string           // Defaults to "origin"
})
```
```
This file helps ensure that AI assistants use the `github-mcp` tools correctly and understand their context.

### Step 3: Add to Cursor MCP Settings

To enable Cursor (or other MCP-compatible editors) to use the globally installed `github-mcp` tools, you need to update your MCP server configuration file.

-   **For Cursor on Windows:** The file is typically located at `C:\Users\YourUser\.cursor\mcp.json`. Replace `YourUser` with your actual Windows username.
-   **For other setups or OS (example using Claude Desktop paths):**
    -   **On MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
    -   **On Windows (Claude Desktop):** `%APPDATA%/Claude/claude_desktop_config.json` (typically `C:\Users\YourUser\AppData\Roaming\Claude\claude_desktop_config.json`)

Open your `mcp.json` (or equivalent) file and add or update the `mcpServers` section. If the file doesn't exist, you might need to create it with the following structure. Ensure `github-mcp` is included like this:

```json
{
  "mcpServers": {
    // ... any other existing servers ...

    "github-mcp": {
      "command": "npx",
      "args": [
        "github-mcp"
      ],
      "env": {}
    },

    // Example: if you also have gemini-mcp-task-manager
    "gemini-mcp-task-manager": {
      "command": "npx",
      "args": [
        "gemini-mcp-task-manager"
      ],
      "env": {}
    }

    // ... any other servers ...
  }
}
```
**Explanation:**
-   `"github-mcp"`: This is the key that identifies your server configuration. Your editor will use this name.
-   `"command": "npx"`: We use `npx` to execute package binaries. It finds globally installed commands or those in the local project.
-   `"args": ["github-mcp"]`: This tells `npx` to run the `github-mcp` package.
-   `"env": {}`: Use this to specify any necessary environment variables for the server (none are required for `github-mcp` currently).

After saving this configuration, **restart Cursor (or your editor)** for the changes to take effect. You should then be able to call `mcp_github-mcp_load_config` and other tools from within your editor.

## Development

Install dependencies (primarily for development of `github-mcp` itself):
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

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

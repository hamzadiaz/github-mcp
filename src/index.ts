#!/usr/bin/env node

/**
 * github-mcp: Git Manager
 * Provides tools to manage Git repositories.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

// Convert exec to Promise-based
const execAsync = promisify(exec);

// Configuration variables
let WORKING_DIR = process.cwd(); // Default to current directory, will be set by load-config

// File path for logging (updated by load-config)
let LOG_FILE = path.join(WORKING_DIR, `github-mcp-server.log`);

/**
 * Safe logging to a file and stderr
 * @param message The log message to write
 * @param level The log level (info, error, debug)
 */
function logToFile(message: string, level: 'info' | 'error' | 'debug' = 'info'): void {
  try {
    const logEntry = `${new Date().toISOString()} [${level.toUpperCase()}]: ${message}\n`;
    // Ensure log directory exists (useful if WORKING_DIR changes to a new location)
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logEntry);

    // Also log to stderr, which doesn't interfere with MCP protocol
    if (level === 'error' || level === 'info') {
      console.error(logEntry.trim());
    }
  } catch (error) {
    // Silent fail for logging errors
    console.error(`Logging error: ${error}`);
  }
}

/**
 * Schema for the load-config tool input
 */
const LoadConfigInputSchema = z.object({
  working_dir: z.string().describe("Working directory path (absolute or relative)")
});

/**
 * Schema for the get-config tool input
 */
const GetConfigInputSchema = z.object({});

/**
 * Schema for the get_init tool input
 */
const GetInitInputSchema = z.object({
  remoteUrl: z.string().describe("The URL of the remote repository (e.g., git@github.com:user/repo.git)"),
  defaultBranch: z.string().optional().describe("Optional name for the default branch (e.g., 'main')"),
});

/**
 * Schema for the get_pull tool input
 */
const GetPullInputSchema = z.object({
  branch: z.string().optional().describe("The branch to pull. Defaults to the current branch if not specified."),
  remote: z.string().optional().default('origin').describe("The remote to pull from. Defaults to 'origin'."),
});

/**
 * Schema for the get_push tool input
 */
const GetPushInputSchema = z.object({
  commitMessage: z.string().describe("Commit message for the changes."),
  branch: z.string().optional().describe("The branch to push to. Defaults to the current branch if not specified."),
  remote: z.string().optional().default('origin').describe("The remote to push to. Defaults to 'origin'."),
});

/**
 * Initialize a Git repository
 */
async function gitInit(remoteUrl: string, defaultBranch?: string): Promise<string> {
  try {
    logToFile(`Initializing Git repository in ${WORKING_DIR}...`, 'info');
    await execAsync('git init', { cwd: WORKING_DIR });

    logToFile(`Adding remote 'origin' with URL: ${remoteUrl}`, 'info');
    await execAsync(`git remote add origin "${remoteUrl}"`, { cwd: WORKING_DIR });

    let branchMessage = "";
    if (defaultBranch) {
      logToFile(`Setting default branch to '${defaultBranch}'`, 'info');
      await execAsync(`git branch -M "${defaultBranch}"`, { cwd: WORKING_DIR });
      branchMessage = ` Default branch set to '${defaultBranch}'.`;
    }

    return `Git repository initialized in ${WORKING_DIR}, remote 'origin' added.${branchMessage}`;
  } catch (error: any) {
    logToFile(`Error initializing Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`, 'error');
    throw new Error(`Failed to initialize Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`);
  }
}

/**
 * Pull changes from a remote repository
 */
async function gitPull(branch?: string, remote: string = 'origin'): Promise<string> {
  try {
    let pullCommand = `git pull ${remote}`;
    if (branch) {
      pullCommand += ` ${branch}`;
    }
    logToFile(`Pulling changes from remote '${remote}'${branch ? ` branch '${branch}'` : ' (current branch)'} into ${WORKING_DIR}...`, 'info');
    const { stdout, stderr } = await execAsync(pullCommand, { cwd: WORKING_DIR });

    if (stderr && !stderr.includes("Updating") && !stderr.includes("Fast-forward")) { // Git sometimes uses stderr for informational messages
      logToFile(`Git pull stderr: ${stderr}`, 'info'); // Log as info if it might not be a true error
    }
    const message = `Successfully pulled changes from remote '${remote}'${branch ? ` branch '${branch}'` : ''}. Output:\n${stdout || 'No output'}`;
    logToFile(message, 'info');
    logToFile(`DEBUG: gitPull is about to return success for ${pullCommand}`, 'debug');
    return message;
  } catch (error: any) {
    logToFile(`Error pulling from Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`, 'error');
    logToFile(`DEBUG: gitPull is about to throw an error for pull command`, 'debug');
    throw new Error(`Failed to pull from Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`);
  }
}

/**
 * Add, commit, and push changes to a remote repository
 */
async function gitPush(commitMessage: string, branch?: string, remote: string = 'origin'): Promise<string> {
  try {
    logToFile(`Adding all changes in ${WORKING_DIR}...`, 'info');
    await execAsync('git add .', { cwd: WORKING_DIR });

    logToFile(`Committing changes with message: "${commitMessage}"`, 'info');
    await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\"')}"`, { cwd: WORKING_DIR });

    let currentBranch = branch;
    if (!currentBranch) {
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: WORKING_DIR });
        currentBranch = stdout.trim();
        logToFile(`Detected current branch: ${currentBranch}`, 'info');
      } catch (branchError: any) {
        logToFile(`Could not detect current branch: ${branchError.message}. Pushing to remote HEAD.`, 'info');
        // If branch detection fails, git push origin HEAD might work, or user needs to specify.
      }
    }

    const pushCommand = `git push ${remote}${currentBranch ? ` ${currentBranch}` : ' HEAD'}`; // Push current branch if not specified
    logToFile(`Pushing changes to remote '${remote}'${currentBranch ? ` branch '${currentBranch}'` : ''}...`, 'info');
    const { stdout, stderr } = await execAsync(pushCommand, { cwd: WORKING_DIR });

    if (stderr && !stderr.includes("To github.com")) { // Git sometimes uses stderr for informational messages like "To github.com..."
      logToFile(`Git push stderr: ${stderr}`, 'info');
    }
    const message = `Successfully pushed changes to remote '${remote}'${currentBranch ? ` branch '${currentBranch}'` : ''} with message: "${commitMessage}". Output:\n${stdout || 'No output'}`;
    logToFile(message, 'info');
    logToFile(`DEBUG: gitPush is about to return success for ${pushCommand}`, 'debug');
    return message;
  } catch (error: any) {
    logToFile(`Error pushing to Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`, 'error');
    // Provide more specific error if commit failed due to no changes
    if (error.message && (error.message.includes("nothing to commit") || (error.stderr && error.stderr.includes("nothing to commit")))) {
      logToFile(`DEBUG: gitPush is about to return 'No changes to commit.'`, 'debug');
      return "No changes to commit.";
    }
    logToFile(`DEBUG: gitPush is about to throw an error for push command`, 'debug');
    throw new Error(`Failed to push to Git repository: ${error.message}${error.stderr ? '\nstderr: ' + error.stderr : ''}`);
  }
}

/**
 * Create an MCP server with Git and config tools
 */
const server = new Server(
  {
    name: "github-mcp",
    version: "0.2.0", // Incremented version
  },
  {
    capabilities: {
      tools: {
        "load_config": {},
        "get_config": {},
        "get_init": {},
        "get_pull": {},
        "get_push": {},
      }
    },
  }
);

/**
 * Handler that lists available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "load_config",
        description: "Sets the working directory for Git operations.",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory path (absolute or relative to where the server is run)"
            }
          },
          required: ["working_dir"]
        }
      },
      {
        name: "get_config",
        description: "Retrieves the current working directory used for Git operations.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_init",
        description: "Initializes a new Git repository, adds a remote origin, and optionally sets a default branch.",
        inputSchema: {
          type: "object",
          properties: {
            remoteUrl: {
              type: "string",
              description: "The URL of the remote repository (e.g., git@github.com:user/repo.git)"
            },
            defaultBranch: {
              type: "string",
              description: "Optional name for the default branch (e.g., 'main')"
            }
          },
          required: ["remoteUrl"]
        }
      },
      {
        name: "get_pull",
        description: "Pulls changes from a remote repository for the specified or current branch.",
        inputSchema: {
          type: "object",
          properties: {
            branch: {
              type: "string",
              description: "The branch to pull. Defaults to the current branch if not specified."
            },
            remote: {
              type: "string",
              description: "The remote to pull from. Defaults to 'origin'."
            }
          }
        }
      },
      {
        name: "get_push",
        description: "Adds all changes, commits, and pushes to a remote repository for the specified or current branch.",
        inputSchema: {
          type: "object",
          properties: {
            commitMessage: {
              type: "string",
              description: "Commit message for the changes."
            },
            branch: {
              type: "string",
              description: "The branch to push to. Defaults to the current branch if not specified."
            },
            remote: {
              type: "string",
              description: "The remote to push to. Defaults to 'origin'."
            }
          },
          required: ["commitMessage"]
        }
      }
    ]
  };
});

/**
 * Handler for tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "load_config": {
        const { working_dir } = LoadConfigInputSchema.parse(request.params.arguments);

        // Resolve working_dir to an absolute path if it's relative
        WORKING_DIR = path.resolve(working_dir);

        // Update LOG_FILE path based on the new WORKING_DIR
        LOG_FILE = path.join(WORKING_DIR, `github-mcp-server.log`);

        // Ensure the new working directory exists
        if (!fs.existsSync(WORKING_DIR)) {
          try {
            fs.mkdirSync(WORKING_DIR, { recursive: true });
            logToFile(`Created working directory: ${WORKING_DIR}`, 'info');
          } catch (error: any) {
            logToFile(`Error creating working directory ${WORKING_DIR}: ${error.message}`, 'error');
            throw new Error(`Failed to create working directory ${WORKING_DIR}: ${error.message}`);
          }
        }

        logToFile(`Configuration loaded: WORKING_DIR=${WORKING_DIR}, LOG_FILE=${LOG_FILE}`, 'info');

        return {
          content: [{
            type: "text",
            text: `Configuration updated: Working Directory set to '${WORKING_DIR}'. Log file is now at '${LOG_FILE}'.`
          }],
        };
      }

      case "get_config": {
        GetConfigInputSchema.parse(request.params.arguments || {});
        return {
          content: [{
            type: "text",
            text: `Current Configuration:\n- Working Directory: ${WORKING_DIR}\n- Log File: ${LOG_FILE}`
          }],
        };
      }

      case "get_init": {
        const { remoteUrl, defaultBranch } = GetInitInputSchema.parse(request.params.arguments);
        const result = await gitInit(remoteUrl, defaultBranch);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_pull": {
        const { branch, remote } = GetPullInputSchema.parse(request.params.arguments || {});
        const result = await gitPull(branch, remote);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get_push": {
        const { commitMessage, branch, remote } = GetPushInputSchema.parse(request.params.arguments);
        const result = await gitPush(commitMessage, branch, remote);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      default:
        logToFile(`Attempted to call unknown tool: ${request.params.name}`, 'error');
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    logToFile(`Error processing tool request '${request.params.name}': ${error.message}`, 'error');
    // Check for Zod validation errors and format them
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
      throw new Error(`Input validation failed for tool '${request.params.name}':\n${formattedErrors}`);
    }
    throw error; // Re-throw other errors to be handled by MCP
  }
});

/**
 * Start the server using stdio transport
 */
async function main() {
  try {
    // Initial log to the default log file path before load-config might change it
    logToFile(`Starting github-mcp Git Manager... Default WORKING_DIR: ${WORKING_DIR}`, 'info');

    // Ensure stdout is only used for JSON messages (MCP standard)
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
      if (typeof chunk === "string") {
        try {
          // Try to parse as JSON. If it's valid JSON, let it pass.
          JSON.parse(chunk);
          return originalStdoutWrite(chunk, encoding, callback);
        } catch (e) {
          // If not JSON, it might be a console.log or other output. Log it via our logger.
          // logToFile(`Suppressed stdout: ${chunk.trim()}`, 'debug'); // Optional: log suppressed output
          return true; // Suppress non-JSON string output
        }
      }
      // Pass through non-string chunks (e.g., buffers from child processes if not handled)
      return originalStdoutWrite(chunk, encoding, callback);
    };

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logToFile(`github-mcp Git Manager running on stdio. WORKING_DIR: ${WORKING_DIR}`, 'info');
  } catch (error: any) {
    logToFile(`Server connection error: ${error.message}`, 'error');
    console.error(`Server connection error: ${error.message}`); // Also to console for immediate visibility
    process.exit(1);
  }
}

// Start the server
main().catch((error: any) => {
  logToFile(`Unhandled error in main: ${error.message}`, 'error');
  console.error(`Unhandled error in main: ${error.message}`); // Also to console
  process.exit(1);
});

// SIGINT and SIGTERM handling for graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, () => {
    logToFile(`Received ${signal}. Shutting down server...`, 'info');
    // Perform any cleanup if necessary
    // server.dispose().then(() => { // Commented out as 'dispose' may not exist
    //     logToFile('Server disposed gracefully.', 'info');
    //     process.exit(0);
    // }).catch((e: Error) => { // Explicitly typed 'e'
    //     logToFile(`Error during server disposal: ${e.message}`, 'error');
    //     process.exit(1);
    // });
    logToFile('Server shutting down.', 'info'); // Simplified shutdown message
    process.exit(0); // Exit directly after logging
  });
});
import fs from "fs";
import path from "path";
import { getSecureSetting } from "@/lib/secure-settings";

export interface VercelEnvWriteResult {
  success: boolean;
  method: "vercel-api" | "local-file" | "none";
  warning?: string;
}

async function writeViaVercelApi(
  key: string,
  value: string,
  token: string,
  projectId: string
): Promise<VercelEnvWriteResult> {
  const baseUrl = "https://api.vercel.com/v10/projects";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // Check if env var already exists
    const listRes = await fetch(`${baseUrl}/${projectId}/env`, { headers });
    if (!listRes.ok) {
      return {
        success: false,
        method: "none",
        warning: `Vercel API error listing env vars: ${listRes.status}`,
      };
    }

    const listData = await listRes.json();
    const existing = listData.envs?.find(
      (env: { key: string }) => env.key === key
    );

    if (existing) {
      // PATCH to update
      const patchRes = await fetch(
        `${baseUrl}/${projectId}/env/${existing.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            value,
            type: "encrypted",
            target: ["production", "preview"],
          }),
        }
      );
      if (!patchRes.ok) {
        return {
          success: false,
          method: "none",
          warning: `Vercel API error updating env var: ${patchRes.status}`,
        };
      }
    } else {
      // POST to create
      const postRes = await fetch(`${baseUrl}/${projectId}/env`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          key,
          value,
          type: "encrypted",
          target: ["production", "preview"],
        }),
      });
      if (!postRes.ok) {
        return {
          success: false,
          method: "none",
          warning: `Vercel API error creating env var: ${postRes.status}`,
        };
      }
    }

    return { success: true, method: "vercel-api" };
  } catch (error) {
    return {
      success: false,
      method: "none",
      warning: `Vercel API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

function writeViaLocalFile(key: string, value: string): VercelEnvWriteResult {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    let content = "";

    try {
      content = fs.readFileSync(envPath, "utf-8");
    } catch {
      // File doesn't exist yet — will create it
    }

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escapedKey}=.*$`, "m");

    if (regex.test(content)) {
      content = content.replace(regex, `${key}="${value}"`);
    } else {
      content = content.trimEnd() + `\n${key}="${value}"\n`;
    }

    fs.writeFileSync(envPath, content, "utf-8");

    return {
      success: true,
      method: "local-file",
      warning:
        "Environment variable written to .env.local. Restart the dev server for changes to take effect.",
    };
  } catch (error) {
    return {
      success: false,
      method: "none",
      warning: `Failed to write .env.local: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function writeVercelEnvVar(
  key: string,
  value: string
): Promise<VercelEnvWriteResult> {
  const token = await getSecureSetting("VERCEL_API_TOKEN");
  const projectId = await getSecureSetting("VERCEL_PROJECT_ID");

  if (token && projectId) {
    return writeViaVercelApi(key, value, token, projectId);
  }

  return writeViaLocalFile(key, value);
}

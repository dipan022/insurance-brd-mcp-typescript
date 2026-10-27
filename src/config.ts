import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}; set it in .env`);
  return value;
};
export const config = {
  openRouterApiKey: required("OPENROUTER_API_KEY"),
  model: process.env.OPENROUTER_MODEL || "openrouter/free",
  jiraUrl: required("JIRA_URL").replace(/\/+$/, ""),
  jiraEmail: required("JIRA_EMAIL"),
  jiraToken: required("JIRA_API_TOKEN"),
  sourceProject: process.env.JIRA_SOURCE_PROJECT_KEY || "KAN",
  outputProject: process.env.JIRA_OUTPUT_PROJECT_KEY || "IBRD",
  domain: process.env.BUSINESS_DOMAIN || "insurance",
};
export type Rule = { required_sections?: string[]; required_patterns?: string[]; minimum_length?: number };
export type PromptConfig = {
  brd_system_prompt: string; brd_revision_prompt: string; frd_system_prompt: string;
  erd_system_prompt: string; backlog_system_prompt: string; backlog_repair_prompt: string;
  validation: Record<string, Rule>;
};
const promptPath = path.resolve("prompts.yaml");
if (!fs.existsSync(promptPath)) throw new Error(`prompts.yaml not found: ${promptPath}`);
export const prompts = YAML.parse(fs.readFileSync(promptPath, "utf8")) as PromptConfig;
for (const key of ["brd_system_prompt","brd_revision_prompt","frd_system_prompt","erd_system_prompt","backlog_system_prompt","backlog_repair_prompt","validation"] as const) {
  if (!(key in prompts)) throw new Error(`Missing top-level prompts.yaml key: ${key}`);
}

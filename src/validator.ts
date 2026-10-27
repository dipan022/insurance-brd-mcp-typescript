import type { PromptConfig } from "./config.js";
export function validateDocument(type: string, content: string, prompts: PromptConfig) {
  const rules = prompts.validation[type.toLowerCase()];
  if (!rules) return { valid: false, document_type: type, problems: [`No rules configured for ${type}`] };
  const problems: string[] = [];
  for (const section of rules.required_sections ?? []) {
    if (!content.toLowerCase().includes(section.toLowerCase())) problems.push(`Missing section: ${section}`);
  }
  for (const pattern of rules.required_patterns ?? []) {
    if (!new RegExp(pattern, "i").test(content)) problems.push(`Missing required pattern: ${pattern}`);
  }
  const min = rules.minimum_length ?? 500;
  if (content.trim().length < min) problems.push(`Document is too short. Minimum: ${min} characters.`);
  return { valid: problems.length === 0, document_type: type, problems };
}

# Insurance BRD MCP — TypeScript

TypeScript migration baseline for the Insurance BRD workflow.

## Workflow
1. Read a source Jira issue (e.g. `KAN-1`) using an MCP tool.
2. Generate and validate BRD, FRD, and ERD.
3. Generate a JSON backlog with **Epic → Feature → Subtask**.
4. Save Markdown files in `brd_output/`.
5. Create Jira issues in the output project, attach the documents to the Epic, and comment on the source issue.

All business prompts and validation rules live in `prompts.yaml`.

## Requirements
- Node.js 20+
- Jira Cloud permissions to read the source issue and create issues/attachments/comments in the output project
- OpenRouter API key; `openrouter/free` is the default model, subject to OpenRouter availability and limits

## Windows setup
```powershell
npm install
Copy-Item .env.example .env
notepad .env
npm run typecheck
npm run dev
```
Enter: `Create a BRD from Jira issue KAN-1`

## Environment
Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_SOURCE_PROJECT_KEY`, `JIRA_OUTPUT_PROJECT_KEY`, and `BUSINESS_DOMAIN` in `.env`. Never commit `.env`.

## Structure
- `src/client.ts`: LLM pipeline and MCP client
- `src/server.ts`: MCP tools
- `src/jira-service.ts`: Jira REST API, issue creation, attachments, comments
- `src/validator.ts`: document validation
- `src/documents.ts`: local Markdown output
- `src/config.ts`: environment and YAML loading
- `prompts.yaml`: all generation prompts and validation rules

## Notes
- Target Jira project needs issue types `Epic`, `Feature`, and `Sub-task`/`Subtask`.
- This version writes Markdown, not PDF.
- Re-running creates new Jira issues; it does not deduplicate prior runs.
- This baseline uses MCP SDK v1 APIs for a straightforward migration; the newer SDK v2 has a different API surface.

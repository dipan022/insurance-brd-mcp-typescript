# Runbook

```powershell
npm install
Copy-Item .env.example .env
# Fill in .env, then:
npm run typecheck
npm run dev
```

The client should connect to MCP, read Jira, generate and validate documents, save Markdown, publish Epic → Feature → Subtask, upload attachments, and comment on the source issue.

Common errors:
- Missing environment variable: fill in `.env`.
- Missing prompt key: check the top-level YAML key and indentation.
- Validation error: inspect the listed missing section/ID; do not disable validation.
- Jira 401/403: check API token/email/permissions.
- Missing issue type: verify Epic, Feature, Sub-task are available in the output project.

Safety: never commit `.env`; rotate credentials if exposed. Each successful run creates new Jira issues.

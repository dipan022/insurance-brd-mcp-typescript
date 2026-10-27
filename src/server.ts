import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { prompts } from "./config.js";
import { saveDocuments } from "./documents.js";
import { JiraService, type Backlog } from "./jira-service.js";
import { validateDocument } from "./validator.js";

const mcp = new McpServer({ name:"insurance-brd-mcp", version:"1.0.0" });
const jira = new JiraService();

mcp.tool("get_jira_issue","Read a source Jira issue.",{issue_key:z.string().min(1)},async ({issue_key}) => {
  const issue=await jira.getIssue(issue_key);
  return {content:[{type:"text",text:JSON.stringify(issue,null,2)}]};
});
mcp.tool("create_brd","Prepare the source requirement for BRD generation.",{business_requirement:z.string().min(1)},async ({business_requirement}) => ({
  content:[{type:"text",text:business_requirement.trim()}],
}));
mcp.tool("validate_document","Validate a BRD, FRD, or ERD using prompts.yaml rules.",{
  document_type:z.enum(["BRD","FRD","ERD"]), content:z.string()
},async ({document_type,content}) => ({
  content:[{type:"text",text:JSON.stringify(validateDocument(document_type,content,prompts),null,2)}],
}));
mcp.tool("publish_documents","Save documents and publish Epic → Feature → Subtask to Jira.",{
  source_issue_key:z.string().min(1), brd:z.string().min(1), frd:z.string().min(1), erd:z.string().min(1), backlog_json:z.string().min(1)
},async ({source_issue_key,brd,frd,erd,backlog_json}) => {
  const backlog=JSON.parse(backlog_json) as Backlog;
  if(!backlog.epic?.summary || !Array.isArray(backlog.features) || !backlog.features.length) throw new Error("Backlog must contain an Epic and at least one Feature.");
  for(const f of backlog.features) if(!f.summary || !Array.isArray(f.subtasks) || !f.subtasks.length) throw new Error("Each Feature needs a non-empty subtasks array.");
  const files=saveDocuments(source_issue_key,brd,frd,erd);
  const jiraResult=await jira.publish(backlog);
  for(const file of files) await jira.attach(jiraResult.epic,file);
  await jira.comment(source_issue_key,`BRD/FRD/ERD generation completed. Generated Epic: ${jiraResult.epic}`);
  return {content:[{type:"text",text:JSON.stringify({success:true,source_issue_key,jira:jiraResult,files:files.map(f=>f.split(/[\\/]/).pop())},null,2)}]};
});
await mcp.connect(new StdioServerTransport());

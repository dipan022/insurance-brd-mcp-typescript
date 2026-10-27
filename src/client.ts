import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config, prompts } from "./config.js";
import type { Backlog } from "./jira-service.js";

const ai=new OpenAI({apiKey:config.openRouterApiKey,baseURL:"https://openrouter.ai/api/v1"});
function textOf(result:any):string { return (result.content??[]).filter((x:any)=>x.type==="text").map((x:any)=>x.text).join("\n").trim(); }
async function model(system:string,user:string,max_tokens=7000):Promise<string> {
  const r=await ai.chat.completions.create({model:config.model,messages:[{role:"system",content:system},{role:"user",content:user}],max_tokens});
  const text=r.choices[0]?.message?.content;
  if(typeof text!=="string"||!text.trim()) throw new Error(`Empty OpenRouter response (${config.model})`);
  return text.trim();
}
async function validate(client:Client,type:"BRD"|"FRD"|"ERD",content:string) {
  return JSON.parse(textOf(await client.callTool({name:"validate_document",arguments:{document_type:type,content}}))) as {valid:boolean;problems:string[]};
}
async function generate(client:Client,type:"BRD"|"FRD"|"ERD",prompt:string,input:string):Promise<string> {
  let doc=await model(prompt,input);
  for(let attempt=0;attempt<3;attempt++) {
    const check=await validate(client,type,doc);
    if(check.valid){console.log(`${type} validation passed.`);return doc;}
    console.log(`${type} validation attempt ${attempt+1}: ${check.problems.join("; ")}`);
    if(attempt===2) throw new Error(`${type} validation failed: ${JSON.stringify(check)}`);
    doc=await model(type==="BRD"?prompts.brd_revision_prompt:prompt,
      `Correct this ${type} according to the validation errors. Preserve supported information. Return the complete document only.\nErrors: ${JSON.stringify(check)}\nDocument:\n${doc}`);
  }
  throw new Error(`${type} generation failed`);
}
function parseJson(text:string):string {
  const t=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  const start=t.indexOf("{"), end=t.lastIndexOf("}");
  if(start<0||end<start) throw new Error("Model did not return a JSON object");
  return t.slice(start,end+1);
}
function checkBacklog(x:any): asserts x is Backlog {
  if(!x?.epic?.summary||!Array.isArray(x.features)||!x.features.length) throw new Error("Expected epic and at least one feature");
  for(const f of x.features) {
    if(!f.summary||!f.description||!Array.isArray(f.subtasks)||!f.subtasks.length) throw new Error("Each Feature must have summary, description, and subtasks");
    for(const s of f.subtasks) if(!s.summary||!s.description||!Array.isArray(s.brd_requirement_ids)) throw new Error("Each Subtask must have summary, description, brd_requirement_ids");
  }
}
async function backlogFrom(brd:string):Promise<Backlog> {
  let previous="";
  for(let i=0;i<2;i++) {
    const answer=await model(i===0?prompts.backlog_system_prompt:prompts.backlog_repair_prompt,
      i===0?`Create the Jira backlog from this BRD:\n${brd}`:`Repair this backlog JSON. Error: ${previous}\nBRD:\n${brd}\nBacklog JSON:\n${previous}`,6000);
    try { const b=JSON.parse(parseJson(answer)); checkBacklog(b); return b; }
    catch(e) { previous=`${e instanceof Error?e.message:String(e)}\n${answer}`; }
  }
  throw new Error(`Backlog generation failed: ${previous}`);
}
async function main() {
  const rl=readline.createInterface({input:stdin,output:stdout});
  const request=(await rl.question("Enter request (example: Create a BRD from Jira issue KAN-1): ")).trim();
  rl.close();
  const issueKey=request.match(/\b[A-Z][A-Z0-9]+-\d+\b/i)?.[0]?.toUpperCase();
  if(!issueKey) throw new Error("Please include a Jira issue key, e.g. KAN-1");

  const serverFile=path.resolve("src/server.ts");
  const transport=new StdioClientTransport({command:process.execPath,args:["--import","tsx",serverFile],cwd:process.cwd(),stderr:"inherit"});
  const client=new Client({name:"insurance-brd-client",version:"1.0.0"});
  try {
    await client.connect(transport);
    const toolList=await client.listTools();
    console.log("Connected to MCP. Tools:",toolList.tools.map(t=>t.name).join(", "));
    const sourceTools = toolList.tools
      .filter((tool) => ["get_jira_issue", "create_brd"].includes(tool.name))
      .map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description ?? tool.name,
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));
    const messages: any[] = [
      { role: "system", content: "Use MCP tools to read the Jira issue mentioned by the user, then pass the returned requirement to create_brd. Do not invent facts. After the tools return, provide a concise source-requirement summary only." },
      { role: "user", content: request },
    ];
    let requirement = "";
    for (let turn = 0; turn < 6; turn++) {
      const response = await ai.chat.completions.create({
        model: config.model,
        messages,
        tools: sourceTools,
        tool_choice: "auto",
        max_tokens: 2500,
      });
      const assistant = response.choices[0]?.message;
      if (!assistant) throw new Error("OpenRouter returned no tool-selection response.");
      messages.push(assistant as any);
      const calls = assistant.tool_calls ?? [];
      if (!calls.length) {
        requirement = typeof assistant.content === "string" ? assistant.content.trim() : "";
        break;
      }
      for (const call of calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        const result = await client.callTool({ name: call.function.name, arguments: args });
        messages.push({ role: "tool", tool_call_id: call.id, content: textOf(result) });
        if (call.function.name === "get_jira_issue") console.log(`Read ${issueKey} from Jira using the model-selected MCP tool.`);
      }
    }
    if (!requirement) throw new Error("The model did not complete the MCP tool-selection flow.");
    const brd=await generate(client,"BRD",prompts.brd_system_prompt,`User request: ${request}\\nJira source requirement:\\n${requirement}`);
    const frd=await generate(client,"FRD",prompts.frd_system_prompt,`Approved BRD:\n${brd}`);
    const erd=await generate(client,"ERD",prompts.erd_system_prompt,`Approved FRD:\n${frd}`);
    const backlog=await backlogFrom(brd);
    console.log("Publishing Epic → Feature → Subtask to Jira...");
    const result=await client.callTool({name:"publish_documents",arguments:{source_issue_key:issueKey,brd,frd,erd,backlog_json:JSON.stringify(backlog)}});
    console.log(textOf(result));
  } finally { await client.close(); }
}
main().catch((e:unknown)=>{console.error("\nProject failed:",e instanceof Error?e.message:e);process.exitCode=1;});

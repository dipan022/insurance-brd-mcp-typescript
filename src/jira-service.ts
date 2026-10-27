import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type Backlog = { epic: {summary:string;description:string}; features: Array<{
  summary:string; description:string; brd_requirement_ids:string[];
  subtasks:Array<{summary:string;description:string;brd_requirement_ids:string[]}>;
}> };

export class JiraService {
  private auth = "Basic " + Buffer.from(`${config.jiraEmail}:${config.jiraToken}`).toString("base64");
  private async request(method:string, endpoint:string, init:RequestInit = {}) {
    const form = init.body instanceof FormData;
    const headers = new Headers(init.headers);
    headers.set("Authorization", this.auth);
    headers.set("Accept", "application/json");
    if (!form && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(config.jiraUrl + endpoint, { ...init, method, headers });
    if (!response.ok) throw new Error(`Jira ${method} ${endpoint} (${response.status}): ${await response.text()}`);
    return response;
  }
  private adfText(x: any): string {
    if (!x) return "";
    if (typeof x === "string") return x;
    if (Array.isArray(x)) return x.map(v=>this.adfText(v)).filter(Boolean).join("\n");
    if (typeof x === "object") return x.type==="text" ? (x.text ?? "") : (x.content ?? []).map((v:any)=>this.adfText(v)).filter(Boolean).join("\n");
    return "";
  }
  async getIssue(key:string) {
    const issue = await (await this.request("GET", `/rest/api/3/issue/${encodeURIComponent(key)}`)).json() as any;
    return { issue_key:key, summary:issue.fields?.summary ?? "", description:this.adfText(issue.fields?.description), business_domain:config.domain };
  }
  private async issueTypes(): Promise<Record<string,string>> {
    const p = await (await this.request("GET", `/rest/api/3/project/${encodeURIComponent(config.outputProject)}`)).json() as any;
    const types = await (await this.request("GET", `/rest/api/3/issuetype/project?projectId=${encodeURIComponent(p.id)}`)).json() as Array<{id:string;name:string}>;
    return Object.fromEntries(types.map(t=>[t.name.toLowerCase(),t.id]));
  }
  private adf(markdown:string): object {
    const content: object[] = [];
    for (const raw of markdown.split(/\r?\n/)) {
      const line=raw.trim(); if (!line) continue;
      const h=/^(#{1,6})\s+(.*)$/.exec(line);
      if (h) content.push({type:"heading",attrs:{level:Math.min(6,h[1].length)},content:[{type:"text",text:h[2]}]});
      else content.push({type:"paragraph",content:[{type:"text",text:line.replace(/^- /,"")} ]});
    }
    return {type:"doc",version:1,content:content.length?content:[{type:"paragraph",content:[{type:"text",text:"No description."}]}]};
  }
  private async create(typeId:string, summary:string, description:string, parent?:string, labels:string[]=[]):Promise<string> {
    const fields:any={project:{key:config.outputProject},issuetype:{id:typeId},summary:summary.slice(0,255),description:this.adf(description),labels};
    if(parent) fields.parent={key:parent};
    const issue=await (await this.request("POST","/rest/api/3/issue",{body:JSON.stringify({fields})})).json() as any;
    return issue.key;
  }
  async publish(backlog:Backlog) {
    const t=await this.issueTypes();
    const epicType=t.epic, featureType=t.feature, subType=t["sub-task"] ?? t.subtask;
    if(!epicType||!featureType||!subType) throw new Error("Destination Jira project must contain Epic, Feature, and Sub-task issue types.");
    const epic=await this.create(epicType,backlog.epic.summary,backlog.epic.description,undefined,["insurance-brd","brd-epic"]);
    const features=[];
    for(const f of backlog.features) {
      const fk=await this.create(featureType,f.summary,`${f.description}\n\nBRD requirements: ${f.brd_requirement_ids.join(", ")}`,epic,["insurance-brd","brd-feature"]);
      const subtasks=[];
      for(const s of f.subtasks) subtasks.push(await this.create(subType,s.summary,`${s.description}\n\nBRD requirements: ${s.brd_requirement_ids.join(", ")}`,fk,["insurance-brd","brd-subtask"]));
      features.push({key:fk,subtasks});
    }
    return {epic,features};
  }
  async attach(issueKey:string,filePath:string) {
    const form=new FormData(); form.append("file",new Blob([fs.readFileSync(filePath)]),path.basename(filePath));
    await this.request("POST",`/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`,{headers:{"X-Atlassian-Token":"no-check"},body:form});
  }
  async comment(issueKey:string,message:string) {
    await this.request("POST",`/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,{body:JSON.stringify({body:{type:"doc",version:1,content:[{type:"paragraph",content:[{type:"text",text:message}]}]}})});
  }
}

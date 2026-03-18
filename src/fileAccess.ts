// src/fileAccess.ts
export type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

export async function discoverAclUri(containerUri: string, fetch: FetchFn): Promise<string> {
  const response = await fetch(containerUri, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`HEAD ${containerUri} returned ${response.status} ${response.statusText}`);
  }
  const linkHeader = response.headers.get("Link") ?? "";
  const aclLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="acl"/);
  if (!aclLinkMatch) {
    throw new Error(`No ACL link header found for ${containerUri}`);
  }
  const aclUri = aclLinkMatch[1];
  if (aclUri.startsWith("http://") || aclUri.startsWith("https://")) return aclUri;
  return new URL(aclUri, containerUri).href;
}

export async function readAclAgents(aclUri: string, fetch: FetchFn): Promise<string[]> {
  const response = await fetch(aclUri);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`GET ${aclUri} returned ${response.status} ${response.statusText}`);
  }
  const turtle = await response.text();
  const agents: string[] = [];
  const blocks = turtle.split(/\n(?=<#)/).filter((b) => b.includes("acl:Authorization"));
  for (const block of blocks) {
    const hasRead = /acl:mode\s+acl:Read\s*\./.test(block);
    const hasWrite = /acl:Write/.test(block);
    if (!hasRead || hasWrite) continue;
    for (const agentMatch of block.matchAll(/acl:agent\s+<([^>]+)>/g)) {
      agents.push(agentMatch[1]);
    }
  }
  return agents;
}

export function buildAclTurtle(containerUri: string, ownerWebId: string, agentWebIds: string[]): string {
  const ownerBlock = [
    `@prefix acl: <http://www.w3.org/ns/auth/acl#> .`,
    ``,
    `<#owner>`,
    `  a acl:Authorization ;`,
    `  acl:agent <${ownerWebId}> ;`,
    `  acl:accessTo <${containerUri}> ;`,
    `  acl:default <${containerUri}> ;`,
    `  acl:mode acl:Read, acl:Write, acl:Control .`,
  ];
  const agentBlocks = agentWebIds.flatMap((webId, index) => [
    ``,
    `<#read-${index}>`,
    `  a acl:Authorization ;`,
    `  acl:agent <${webId}> ;`,
    `  acl:accessTo <${containerUri}> ;`,
    `  acl:default <${containerUri}> ;`,
    `  acl:mode acl:Read .`,
  ]);
  return [...ownerBlock, ...agentBlocks].join("\n");
}

export async function writeAcl(
  aclUri: string,
  containerUri: string,
  ownerWebId: string,
  agentWebIds: string[],
  fetch: FetchFn
): Promise<void> {
  const turtle = buildAclTurtle(containerUri, ownerWebId, agentWebIds);
  const response = await fetch(aclUri, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle" },
    body: turtle,
  });
  if (!response.ok) {
    throw new Error(`PUT ${aclUri} returned ${response.status} ${response.statusText}`);
  }
}

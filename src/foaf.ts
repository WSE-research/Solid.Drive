type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export type ProfileFields = { name: string; imgUrl: string };

function assertSafeIri(iri: string, label: string): void {
  if (!/^https?:\/\/[^\s<>"{}|\\^`[\]]*$/.test(iri)) {
    throw new Error(`Invalid ${label}: must be a valid http(s):// URL without special characters`);
  }
}

function escapeN3String(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export async function saveProfileFields(
  webId: string,
  original: ProfileFields,
  fields: ProfileFields,
  fetchFn: FetchFn
): Promise<void> {
  assertSafeIri(webId, "webId");
  const profileDocUri = webId.split("#")[0];

  const deleteTriples: string[] = [];
  if (original.name.trim())
    deleteTriples.push(`<#me> foaf:name "${escapeN3String(original.name.trim())}" .`);
  if (original.imgUrl.trim()) {
    assertSafeIri(original.imgUrl.trim(), "original image URL");
    deleteTriples.push(`<#me> foaf:img <${original.imgUrl.trim()}> .`);
  }

  const insertTriples: string[] = [];
  if (fields.name.trim())
    insertTriples.push(`<#me> foaf:name "${escapeN3String(fields.name.trim())}" .`);
  if (fields.imgUrl.trim()) {
    assertSafeIri(fields.imgUrl.trim(), "image URL");
    insertTriples.push(`<#me> foaf:img <${fields.imgUrl.trim()}> .`);
  }

  if (deleteTriples.length === 0 && insertTriples.length === 0) return;

  const parts: string[] = [];
  if (deleteTriples.length > 0)
    parts.push(`solid:deletes { ${deleteTriples.join(" ")} }`);
  if (insertTriples.length > 0)
    parts.push(`solid:inserts { ${insertTriples.join(" ")} }`);

  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  ${parts.join(";\n  ")} .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "text/n3" },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

export async function ensureProfileDocType(webId: string, fetchFn: FetchFn): Promise<void> {
  assertSafeIri(webId, "webId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  solid:inserts {
    <> a foaf:PersonalProfileDocument .
    <> foaf:primaryTopic <#me> .
    <#me> a foaf:Person .
  } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "text/n3" },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

export async function addContact(webId: string, contactWebId: string, fetchFn: FetchFn): Promise<void> {
  assertSafeIri(webId, "webId");
  assertSafeIri(contactWebId, "contactWebId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  solid:inserts { <#me> foaf:knows <${contactWebId}> . } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "text/n3" },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

export async function removeContact(webId: string, contactWebId: string, fetchFn: FetchFn): Promise<void> {
  assertSafeIri(webId, "webId");
  assertSafeIri(contactWebId, "contactWebId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  solid:deletes { <#me> foaf:knows <${contactWebId}> . } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "text/n3" },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

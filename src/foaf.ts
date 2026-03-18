type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export type ProfileFields = { name: string; imgUrl: string };

export async function saveProfileFields(
  webId: string,
  original: ProfileFields,
  fields: ProfileFields,
  fetchFn: FetchFn
): Promise<void> {
  const profileDocUri = webId.split("#")[0];

  const deleteTriples: string[] = [];
  if (original.name.trim())
    deleteTriples.push(`<#me> foaf:name "${original.name.trim()}" .`);
  if (original.imgUrl.trim())
    deleteTriples.push(`<#me> foaf:img <${original.imgUrl.trim()}> .`);

  const insertTriples: string[] = [];
  if (fields.name.trim())
    insertTriples.push(`<#me> foaf:name "${fields.name.trim()}" .`);
  if (fields.imgUrl.trim())
    insertTriples.push(`<#me> foaf:img <${fields.imgUrl.trim()}> .`);

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

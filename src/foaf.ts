type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export type ProfileFields = { name: string; imgUrl: string };

/** Throw if the IRI is not a valid http(s) URL without special characters. */
function assertSafeIri(iri: string, label: string): void {
  if (!/^https?:\/\/[^\s<>"{}|\\^`[\]]*$/.test(iri)) {
    throw new Error(`Invalid ${label}: must be a valid http(s):// URL without special characters`);
  }
}

/**
 * Update foaf:name and foaf:img on the user's profile via a Solid InsertDeletePatch.
 * Only changed fields are touched — old values are deleted and new ones inserted.
 */
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
  if (original.imgUrl.trim()) {
    assertSafeIri(original.imgUrl.trim(), "original image URL");
    deleteTriples.push(`<#me> foaf:img <${original.imgUrl.trim()}> .`);
  }

  const insertTriples: string[] = [];
  if (fields.name.trim())
    insertTriples.push(`<#me> foaf:name "${fields.name.trim()}" .`);
  if (fields.imgUrl.trim()) {
    assertSafeIri(fields.imgUrl.trim(), "image URL");
    insertTriples.push(`<#me> foaf:img <${fields.imgUrl.trim()}> .`);
  }

  if (deleteTriples.length === 0 && insertTriples.length === 0) return;

  const patchParts: string[] = [];
  if (deleteTriples.length > 0)
    patchParts.push(`solid:deletes { ${deleteTriples.join(" ")} }`);
  if (insertTriples.length > 0)
    patchParts.push(`solid:inserts { ${insertTriples.join(" ")} }`);

  const body = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<> a solid:InsertDeletePatch;
  ${patchParts.join(";\n  ")} .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": "text/n3" },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

/**
 * Make sure the profile document has basic FOAF type triples:
 * foaf:PersonalProfileDocument pointing to a foaf:Person.
 * Safe to call repeatedly — existing triples are just re-inserted.
 */
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

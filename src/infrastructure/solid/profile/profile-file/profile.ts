/**
 * @packageDocumentation
 * Updates Solid profile fields via SPARQL patches.
 */

import type { FetchFn, ProfileFields } from "@/types";
import { RDF_NAMESPACES, CONTENT_TYPES } from "@/config";

export type { ProfileFields };

type FetchFnLocal = FetchFn;

function assertSafeIri(iri: string, label: string): void {
  if (!/^https?:\/\/[^\s<>"{}|\\^`[\]]*$/.test(iri)) {
    throw new Error(`Invalid ${label}: must be a valid http(s):// URL without special characters`);
  }
}

function escapeN3String(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/**
 * Patches foaf:name and foaf:img on a profile document.
 *
 * @param webId - User's WebID
 * @param original - Previous field values to delete
 * @param fields - New field values to insert
 * @param fetchFn - Authenticated fetch function
 *
 * @public
 */
export async function saveProfileFields(
  webId: string,
  original: ProfileFields,
  fields: ProfileFields,
  fetchFn: FetchFnLocal
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

  const patchParts: string[] = [];
  if (deleteTriples.length > 0)
    patchParts.push(`solid:deletes { ${deleteTriples.join(" ")} }`);
  if (insertTriples.length > 0)
    patchParts.push(`solid:inserts { ${insertTriples.join(" ")} }`);

  const body = `@prefix foaf: <${RDF_NAMESPACES.FOAF}> .
@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .

<> a solid:InsertDeletePatch;
  ${patchParts.join(";\n  ")} .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

/**
 * Ensures the profile has basic FOAF type triples.
 *
 * @param webId - User's WebID
 * @param fetchFn - Authenticated fetch function
 *
 * @public
 */
export async function ensureProfileDocType(webId: string, fetchFn: FetchFnLocal): Promise<void> {
  assertSafeIri(webId, "webId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <${RDF_NAMESPACES.FOAF}> .
@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .

<> a solid:InsertDeletePatch;
  solid:inserts {
    <> a foaf:PersonalProfileDocument .
    <> foaf:primaryTopic <#me> .
    <#me> a foaf:Person .
  } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

/**
 * Adds a foaf:knows triple to the profile.
 *
 * @public
 */
export async function addContact(webId: string, contactWebId: string, fetchFn: FetchFnLocal): Promise<void> {
  assertSafeIri(webId, "webId");
  assertSafeIri(contactWebId, "contactWebId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <${RDF_NAMESPACES.FOAF}> .
@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .

<> a solid:InsertDeletePatch;
  solid:inserts { <#me> foaf:knows <${contactWebId}> . } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

/**
 * Removes a foaf:knows triple from the profile.
 *
 * @public
 */
export async function removeContact(webId: string, contactWebId: string, fetchFn: FetchFnLocal): Promise<void> {
  assertSafeIri(webId, "webId");
  assertSafeIri(contactWebId, "contactWebId");
  const profileDocUri = webId.split("#")[0];
  const body = `@prefix foaf: <${RDF_NAMESPACES.FOAF}> .
@prefix solid: <${RDF_NAMESPACES.SOLID_TERMS}> .

<> a solid:InsertDeletePatch;
  solid:deletes { <#me> foaf:knows <${contactWebId}> . } .`;

  const response = await fetchFn(profileDocUri, {
    method: "PATCH",
    headers: { "Content-Type": CONTENT_TYPES.N3 },
    body,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

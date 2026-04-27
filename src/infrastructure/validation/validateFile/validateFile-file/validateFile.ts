/**
 * Validate a File's metadata against the project TBox + SHACL shapes.
 *
 * @packageDocumentation
 */

import { loadTBox, validateMetadata, type ValidationResult } from "@/infrastructure/validation/tboxValidator";
import { resolveClass } from "@/infrastructure/validation/fileTypeRegistry";

/**
 * Validates a `File` against the metadata shape resolved from its MIME type.
 *
 * @remarks
 * Mirrors the snapshot the existing upload form derives, so the form path and
 * the bulk-drop path agree on what counts as valid. Loads the TBox lazily and
 * caches via `loadTBox` (its own module-level cache).
 *
 * @param file - File to validate
 * @param title - User-provided title; falls back to `file.name` when empty
 * @param description - Optional user-provided description
 * @param webId - Publisher's WebID (passed through to the snapshot)
 * @returns The same ValidationResult shape useFileValidation already produces
 *
 * @public
 */
export async function validateFile(
  file: File,
  title: string,
  description: string,
  webId: string
): Promise<ValidationResult> {
  const { shapes, parents } = await loadTBox();
  const classUri = resolveClass(file.type);
  const typeLocalName = classUri.split(/[#/]/).pop() ?? "DigitalDocument";

  const snapshot: Record<string, unknown> = {
    name: title.trim() || file.name,
    description: description.trim() || undefined,
    encodingFormat: file.type || undefined,
    contentSize: file.size.toString(),
    uploadDate: new Date().toISOString(),
    publisher: { "@id": webId },
    type: [{ "@id": typeLocalName }],
  };

  return validateMetadata(snapshot, classUri, shapes, parents);
}

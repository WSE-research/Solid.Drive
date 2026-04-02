# ShEx Shapes

Each `.shex` file defines the data contract for one type of resource stored on the Pod. LDO reads these files and generates TypeScript interfaces and validators in `src/.ldo/`. Those generated files are what the React components import to read and write Pod data in a type-safe way.

**Edit `.shex` files here. Never edit `src/.ldo/` directly.**

```bash
npm run build:ldo   # regenerate after any change
```

---

## `catalogEntry.shex`

Defines the structure of `index.ttl` — the metadata document written inside each uploaded file's container.

### Vocabulary note

`index.ttl` uses two vocabularies for file type:

- **`rdf:type`** uses the `sd:` namespace (`https://w3id.org/solid-drive#`) — these are the ShEx-validated types that LDO reads and writes.
- **`dcterms:conformsTo`** (optional) holds the corresponding `schema.org` class URI — written by `resolveClass()` in `podCatalog.ts` and used in `catalog.ttl` for interoperability with other Solid apps.

| `rdf:type` (sd:) | `dcterms:conformsTo` (schema:) | When applied |
|---|---|---|
| `schema:DigitalDocument` | `schema:DigitalDocument` | Fallback for unknown types |
| `sd:ImageFile` | `schema:ImageObject` | `image/*` MIME types |
| `sd:VideoFile` | `schema:VideoObject` | `video/*` MIME types |
| `sd:AudioFile` | `schema:AudioObject` | `audio/*` MIME types |
| `sd:TextDocument` | `schema:TextDigitalDocument` | PDFs, text, Word documents |
| `sd:SpreadsheetDocument` | `schema:SpreadsheetDigitalDocument` | CSV, Excel |

### Required fields

| Field | Type | Why required |
|---|---|---|
| `rdf:type` | one of the `sd:` types above | every file must be classified |
| `schema:uploadDate` | `xsd:dateTime` | creation timestamp for sorting and auditing |
| `schema:publisher` | IRI (WebID) | every file must be traceable to its uploader |

### Optional fields

| Field | Type | Purpose |
|---|---|---|
| `schema:name` | `xsd:string` | display title |
| `schema:description` | `xsd:string` | user-entered description |
| `schema:encodingFormat` | `xsd:string` | MIME type |
| `schema:contentSize` | `xsd:string` | byte size as string |
| `dcterms:conformsTo` | IRI | schema.org class URI for catalog interop |
| `schema:dateModified` | `xsd:dateTime` | last edit timestamp |
| `schema:isPartOf` | IRI | link to a parent dataset or collection |
| `schema:sharedWith` | IRI (zero or more) | WebIDs this file has been shared with |

---

## `solidProfile.shex`

Defines the minimum fields the app reads from a user's WebID profile document.

| Field | Purpose |
|---|---|
| `vcard:fn` | Display name (preferred) |
| `foaf:name` | Display name (fallback) |
| `sp:storage` | Root URI of the user's Pod — used to construct the path for `catalog.ttl` and `my-solid-app/` |
| `ldp:inbox` | Linked Data Platform inbox |
| `solid:publicTypeIndex` | Public type index |
| `solid:privateTypeIndex` | Private type index |
| `dcat:catalog` | (Optional) Pointer to the user's catalog. Read by `resolveCatalogUri` to enable catalog portability across Solid apps |

`EXTRA a` is set so the shape accepts any profile `rdf:type`. Different Solid servers use different type URIs for profile documents; the app only needs the storage location and optional catalog pointer.

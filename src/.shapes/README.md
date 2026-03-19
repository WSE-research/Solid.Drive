# ShEx Shapes

Each `.shex` file in this folder defines a data contract for one type of resource stored on the Pod. The contract specifies which RDF properties a resource must have (`rdf:type`, required fields) and which are optional, along with the exact datatype for each.

LDO reads these files and generates TypeScript interfaces, validators, and shape type objects in `src/.ldo/`. Those generated files are what the React components import to read and write Pod data in a type-safe way.

**Edit `.shex` files here. Never edit `src/.ldo/` directly.** Run `npm run build:ldo` to regenerate after any change.

### `catalogEntry.shex`

Defines the structure of the metadata document (`index.ttl`) written inside each uploaded file's container.

**Required fields**: the upload is rejected if any is missing:

| Field | Type | Reason required |
|---|---|---|
| `rdf:type` | schema.org class IRI | Every file must be classified for discoverability by external apps |
| `schema:uploadDate` | `xsd:dateTime` | Every file must have a creation timestamp so the catalog can be sorted and audited |
| `schema:publisher` | IRI (WebID) | Every file must be traceable to the Pod owner who uploaded it |

**`rdf:type`** must be exactly one of:

| Value | Meaning |
|---|---|
| `schema:DigitalDocument` | Base class — used when no more specific class matches |
| `schema:ImageObject` | MIME type starts with `image/` |
| `schema:VideoObject` | MIME type starts with `video/` |
| `schema:AudioObject` | MIME type starts with `audio/` |
| `schema:TextDigitalDocument` | `text/*`, `application/pdf`, Word documents |
| `schema:SpreadsheetDigitalDocument` | Excel, CSV |

These are standard schema.org classes, no custom vocabulary file is needed on the Pod.

**Optional fields:**

| Field | Type |
|---|---|
| `schema:name` | `xsd:string` |
| `schema:description` | `xsd:string` |
| `schema:encodingFormat` | `xsd:string` |
| `schema:contentSize` | `xsd:string` |
| `schema:dateModified` | `xsd:dateTime` |
| `schema:isPartOf` | IRI |
| `schema:sharedWith` | IRI |
| `dcterms:conformsTo` | IRI |

---

### `solidProfile.shex`

Defines the minimum fields the app reads from a user's WebID profile document.

| Field | Purpose |
|---|---|
| `sp:storage` | The root URI of the user's Pod — used to construct the path for `catalog.ttl` and `my-solid-app/` |
| `dcat:catalog` | (Optional) If present, points to the user's custom catalog from another app. Used by `resolveCatalogUri` to enable catalog portability across Solid applications |

`EXTRA a` is set so the shape accepts any profile `rdf:type`, not just a specific one. This is necessary because different Solid servers use different type URIs for profile documents, and the app only cares about the storage location and optional catalog pointer, not the profile type.

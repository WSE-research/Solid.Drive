import type { Schema } from "shexj";

/**
 * =============================================================================
 * catalogEntrySchema: ShexJ Schema for catalogEntry
 * =============================================================================
 */
export const catalogEntrySchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "https://example.com/CatalogEntrySh",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: [
                  "http://schema.org/DigitalDocument",
                  "https://example.com/app#ImageFile",
                  "https://example.com/app#VideoFile",
                  "https://example.com/app#AudioFile",
                  "https://example.com/app#TextDocument",
                ],
              },
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/name",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/description",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/encodingFormat",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/contentSize",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/uploadDate",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#dateTime",
              },
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/dateModified",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#dateTime",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/isPartOf",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/sharedWith",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: -1,
            },
            {
              type: "TripleConstraint",
              predicate: "http://schema.org/publisher",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
            },
            {
              type: "TripleConstraint",
              predicate: "http://purl.org/dc/terms/conformsTo",
              valueExpr: {
                type: "NodeConstraint",
                nodeKind: "iri",
              },
              min: 0,
              max: 1,
            },
          ],
        },
      },
    },
  ],
};

import type { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * catalogEntryContext: JSONLD Context for catalogEntry
 * =============================================================================
 */
export const catalogEntryContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  DigitalDocument: {
    "@id": "http://schema.org/DigitalDocument",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  ImageObject: {
    "@id": "http://schema.org/ImageObject",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  VideoObject: {
    "@id": "http://schema.org/VideoObject",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  AudioObject: {
    "@id": "http://schema.org/AudioObject",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  TextDigitalDocument: {
    "@id": "http://schema.org/TextDigitalDocument",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  SpreadsheetDigitalDocument: {
    "@id": "http://schema.org/SpreadsheetDigitalDocument",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "http://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      description: {
        "@id": "http://schema.org/description",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      encodingFormat: {
        "@id": "http://schema.org/encodingFormat",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      contentSize: {
        "@id": "http://schema.org/contentSize",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      uploadDate: {
        "@id": "http://schema.org/uploadDate",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
      dateModified: {
        "@id": "http://schema.org/dateModified",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
      },
      isPartOf: {
        "@id": "http://schema.org/isPartOf",
        "@type": "@id",
      },
      sharedWith: {
        "@id": "http://schema.org/sharedWith",
        "@type": "@id",
        "@isCollection": true,
      },
    },
  },
  name: {
    "@id": "http://schema.org/name",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  description: {
    "@id": "http://schema.org/description",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  encodingFormat: {
    "@id": "http://schema.org/encodingFormat",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  contentSize: {
    "@id": "http://schema.org/contentSize",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  uploadDate: {
    "@id": "http://schema.org/uploadDate",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  publisher: {
    "@id": "http://schema.org/publisher",
    "@type": "@id",
  },
  conformsTo: {
    "@id": "http://purl.org/dc/terms/conformsTo",
    "@type": "@id",
  },
  dateModified: {
    "@id": "http://schema.org/dateModified",
    "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
  },
  isPartOf: {
    "@id": "http://schema.org/isPartOf",
    "@type": "@id",
  },
  sharedWith: {
    "@id": "http://schema.org/sharedWith",
    "@type": "@id",
    "@isCollection": true,
  },
};

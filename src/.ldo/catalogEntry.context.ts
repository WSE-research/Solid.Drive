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
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
    },
  },
  ImageFile: {
    "@id": "https://example.com/app#ImageFile",
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
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
    },
  },
  VideoFile: {
    "@id": "https://example.com/app#VideoFile",
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
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
    },
  },
  AudioFile: {
    "@id": "https://example.com/app#AudioFile",
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
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
      },
    },
  },
  TextDocument: {
    "@id": "https://example.com/app#TextDocument",
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
      publisher: {
        "@id": "http://schema.org/publisher",
        "@type": "@id",
      },
      conformsTo: {
        "@id": "http://purl.org/dc/terms/conformsTo",
        "@type": "@id",
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
  publisher: {
    "@id": "http://schema.org/publisher",
    "@type": "@id",
  },
  conformsTo: {
    "@id": "http://purl.org/dc/terms/conformsTo",
    "@type": "@id",
  },
};

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
  ImageFile: {
    "@id": "https://w3id.org/solid-drive#ImageFile",
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
  VideoFile: {
    "@id": "https://w3id.org/solid-drive#VideoFile",
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
  AudioFile: {
    "@id": "https://w3id.org/solid-drive#AudioFile",
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
  TextDocument: {
    "@id": "https://w3id.org/solid-drive#TextDocument",
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
  SpreadsheetDocument: {
    "@id": "https://w3id.org/solid-drive#SpreadsheetDocument",
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

import type { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * postContext: JSONLD Context for post
 * =============================================================================
 */
export const postContext: LdoJsonldContext = {
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
    },
  },
  CreativeWork: {
    "@id": "http://schema.org/CreativeWork",
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
    },
  },
  Thing: {
    "@id": "http://schema.org/Thing",
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
};

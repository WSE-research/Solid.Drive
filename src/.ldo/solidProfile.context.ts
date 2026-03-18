import type { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * solidProfileContext: JSONLD Context for solidProfile
 * =============================================================================
 */
export const solidProfileContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Person: {
    "@id": "http://schema.org/Person",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      fn: {
        "@id": "http://www.w3.org/2006/vcard/ns#fn",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      name: {
        "@id": "http://xmlns.com/foaf/0.1/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      img: {
        "@id": "http://xmlns.com/foaf/0.1/img",
        "@type": "@id",
      },
      knows: {
        "@id": "http://xmlns.com/foaf/0.1/knows",
        "@type": "@id",
        "@isCollection": true,
      },
      inbox: {
        "@id": "http://www.w3.org/ns/ldp#inbox",
        "@type": "@id",
      },
      storage: {
        "@id": "http://www.w3.org/ns/pim/space#storage",
        "@type": "@id",
        "@isCollection": true,
      },
      publicTypeIndex: {
        "@id": "http://www.w3.org/ns/solid/terms#publicTypeIndex",
        "@type": "@id",
      },
      privateTypeIndex: {
        "@id": "http://www.w3.org/ns/solid/terms#privateTypeIndex",
        "@type": "@id",
      },
    },
  },
  Person2: {
    "@id": "http://xmlns.com/foaf/0.1/Person",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      fn: {
        "@id": "http://www.w3.org/2006/vcard/ns#fn",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      name: {
        "@id": "http://xmlns.com/foaf/0.1/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      img: {
        "@id": "http://xmlns.com/foaf/0.1/img",
        "@type": "@id",
      },
      knows: {
        "@id": "http://xmlns.com/foaf/0.1/knows",
        "@type": "@id",
        "@isCollection": true,
      },
      inbox: {
        "@id": "http://www.w3.org/ns/ldp#inbox",
        "@type": "@id",
      },
      storage: {
        "@id": "http://www.w3.org/ns/pim/space#storage",
        "@type": "@id",
        "@isCollection": true,
      },
      publicTypeIndex: {
        "@id": "http://www.w3.org/ns/solid/terms#publicTypeIndex",
        "@type": "@id",
      },
      privateTypeIndex: {
        "@id": "http://www.w3.org/ns/solid/terms#privateTypeIndex",
        "@type": "@id",
      },
    },
  },
  fn: {
    "@id": "http://www.w3.org/2006/vcard/ns#fn",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  name: {
    "@id": "http://xmlns.com/foaf/0.1/name",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  img: {
    "@id": "http://xmlns.com/foaf/0.1/img",
    "@type": "@id",
  },
  knows: {
    "@id": "http://xmlns.com/foaf/0.1/knows",
    "@type": "@id",
    "@isCollection": true,
  },
  inbox: {
    "@id": "http://www.w3.org/ns/ldp#inbox",
    "@type": "@id",
  },
  storage: {
    "@id": "http://www.w3.org/ns/pim/space#storage",
    "@type": "@id",
    "@isCollection": true,
  },
  publicTypeIndex: {
    "@id": "http://www.w3.org/ns/solid/terms#publicTypeIndex",
    "@type": "@id",
  },
  privateTypeIndex: {
    "@id": "http://www.w3.org/ns/solid/terms#privateTypeIndex",
    "@type": "@id",
  },
};

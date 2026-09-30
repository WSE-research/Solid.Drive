import { describe, it, expect } from 'vitest';
import { Parser as N3Parser, Store as N3Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { RDF_NAMESPACES } from '@/config';
import { FOLDER_CLASS_URI } from '@/infrastructure/solid/catalog/catalog-file/catalog';
import { buildTombstoneTurtle, type Tombstone } from '../tombstone-file/tombstone';

const SHAPES_NAMESPACE = 'https://purl.org/solid-drive/shapes#';

// The tombstone shape from the thesis appendix. Another application can
// validate a trash entry against it without knowing this app's own terms.
const TOMBSTONE_SHAPE = `
@prefix sh:      <${RDF_NAMESPACES.SHACL}> .
@prefix rdf:     <${RDF_NAMESPACES.RDF}> .
@prefix as:      <${RDF_NAMESPACES.ACTIVITY_STREAMS}> .
@prefix prov:    <${RDF_NAMESPACES.PROV}> .
@prefix dcterms: <${RDF_NAMESPACES.DCTERMS}> .
@prefix xsd:     <${RDF_NAMESPACES.XSD}> .
@prefix sdsh:    <${SHAPES_NAMESPACE}> .

sdsh:TombstoneShape a sh:NodeShape ;
  sh:targetClass as:Tombstone ;
  sh:property [ sh:path rdf:type ; sh:hasValue prov:Entity ] ;
  sh:property [ sh:path prov:invalidatedAtTime ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path dcterms:valid ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path dcterms:source ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path as:formerType ; sh:nodeKind sh:IRI ; sh:maxCount 1 ] ;
  sh:property [ sh:path dcterms:title ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
  sh:property [ sh:path dcterms:format ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
  sh:closed false .
`;

const tombstoneUri = 'https://pod.example/trash/abc/tombstone.ttl';

const fileTombstone: Tombstone = {
  kind: 'file',
  originalContainerUri: 'https://pod.example/data/report-txt/',
  originalParentUri: 'https://pod.example/data/',
  originalCatalogUri: 'https://pod.example/catalog.ttl',
  originalInstanceUri: 'https://pod.example/data/report-txt/index.ttl',
  originalBinaryName: 'report.txt',
  originalClassUri: `${RDF_NAMESPACES.SCHEMA}TextDigitalDocument`,
  hasAclSnapshot: true,
  deletedAt: '2026-07-22T18:30:00.000Z',
  expiresAt: '2026-08-21T18:30:00.000Z',
};

const folderTombstone: Tombstone = {
  ...fileTombstone,
  kind: 'folder',
  originalClassUri: FOLDER_CLASS_URI,
  originalContainerUri: 'https://pod.example/data/photos/',
  originalInstanceUri: 'https://pod.example/data/photos/',
  originalBinaryName: '',
  hasAclSnapshot: false,
};

async function validate(tombstone: Tombstone) {
  const shapes = new N3Store(new N3Parser().parse(TOMBSTONE_SHAPE));
  const data = new N3Store(new N3Parser({ baseIRI: tombstoneUri }).parse(buildTombstoneTurtle(tombstoneUri, tombstone)));
  return new SHACLValidator(shapes).validate(data);
}

describe('tombstone against the standard-vocabulary shape', () => {
  it('a file tombstone conforms to the shape', async () => {
    const report = await validate(fileTombstone);
    expect(report.results.map((result) => result.message.map((message) => message.value))).toEqual([]);
    expect(report.conforms).toBe(true);
  });

  it('a folder tombstone conforms to the shape', async () => {
    const report = await validate(folderTombstone);
    expect(report.results.map((result) => result.message.map((message) => message.value))).toEqual([]);
    expect(report.conforms).toBe(true);
  });
});

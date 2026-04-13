import { describe, it, expect } from "vitest";
import { DataFactory } from "n3";
import { serializeTurtle } from '../rdfUtils-file/rdfUtils';

const { quad, namedNode, literal } = DataFactory;

describe("rdfUtils", () => {
  describe("serializeTurtle", () => {
    it("serializes an empty array to an empty turtle string", () => {
      const result = serializeTurtle([]);
      expect(result).toBe("");
    });

    it("serializes a single quad to turtle format", () => {
      const quads = [
        quad(
          namedNode("http://example.org/subject"),
          namedNode("http://example.org/predicate"),
          literal("object")
        ),
      ];
      const result = serializeTurtle(quads);
      expect(result).toContain("<http://example.org/subject>");
      expect(result).toContain("<http://example.org/predicate>");
      expect(result).toContain('"object"');
    });

    it("serializes multiple quads to turtle format", () => {
      const quads = [
        quad(
          namedNode("http://example.org/alice"),
          namedNode("http://xmlns.com/foaf/0.1/name"),
          literal("Alice")
        ),
        quad(
          namedNode("http://example.org/alice"),
          namedNode("http://xmlns.com/foaf/0.1/knows"),
          namedNode("http://example.org/bob")
        ),
      ];
      const result = serializeTurtle(quads);
      expect(result).toContain("<http://example.org/alice>");
      expect(result).toContain('"Alice"');
      expect(result).toContain("<http://example.org/bob>");
    });

    it("uses custom prefixes when provided", () => {
      const quads = [
        quad(
          namedNode("http://xmlns.com/foaf/0.1/Person"),
          namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
          namedNode("http://www.w3.org/2000/01/rdf-schema#Class")
        ),
      ];
      const prefixes = {
        foaf: "http://xmlns.com/foaf/0.1/",
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      };
      const result = serializeTurtle(quads, prefixes);
      expect(result).toContain("@prefix foaf:");
      expect(result).toContain("@prefix rdf:");
      expect(result).toContain("@prefix rdfs:");
      expect(result).toContain("foaf:Person");
      // N3 writer uses 'a' as shorthand for rdf:type
      expect(result).toMatch(/foaf:Person\s+a\s+rdfs:Class/);
      expect(result).toContain("rdfs:Class");
    });

    it("serializes blank node subjects using _: notation", () => {
      const { blankNode } = DataFactory;
      const quads = [
        quad(
          blankNode("b1"),
          namedNode("http://xmlns.com/foaf/0.1/name"),
          literal("Anonymous")
        ),
      ];
      const result = serializeTurtle(quads);
      expect(result).toContain("_:");
      expect(result).toContain('"Anonymous"');
    });

    it("serializes language-tagged literals with @lang notation", () => {
      const quads = [
        quad(
          namedNode("http://example.org/doc"),
          namedNode("http://purl.org/dc/terms/title"),
          literal("Hello", "en")
        ),
      ];
      const result = serializeTurtle(quads);
      expect(result).toContain('"Hello"@en');
    });

    it("serializes typed literals preserving their subject, predicate, and value", () => {
      const quads = [
        quad(
          namedNode("http://example.org/person"),
          namedNode("http://example.org/age"),
          literal("30", namedNode("http://www.w3.org/2001/XMLSchema#integer"))
        ),
      ];
      const result = serializeTurtle(quads);
      // N3 writer may simplify xsd:integer literals to just the number
      expect(result).toContain("30");
      expect(result).toContain("http://example.org/person");
      expect(result).toContain("http://example.org/age");
    });
  });
});

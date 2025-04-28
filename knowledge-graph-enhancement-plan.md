# Knowledge Graph Enhancement Plan

## Overview

This document outlines a plan to incrementally enhance the Memento MCP knowledge graph system to support:

1. ✅ Multiple node labels beyond the base `Entity` label
2. ✅ Metadata for entities, similar to what's available for relations
3. Native Neo4j relationship types instead of a single `RELATES_TO` type
4. Updated ontology tools to visualize and manage these enhancements

The goal is to create a more flexible and expressive knowledge graph system while maintaining backward compatibility and performance.

## Phase 1: Entity Enhancement (Weeks 1-2) - ✅ COMPLETED

### 1.1 Multiple Node Labels - ✅ COMPLETED

**Implementation Details:**
- Added `sanitizeLabel` method to ensure entity type is a valid Neo4j label
- Modified `createEntities` to automatically apply the entity type as a label: `CREATE (e:Entity:${sanitizedLabel} {...})`
- Updated `saveGraph` to include the entity type as a label for imported entities
- Updated `addObservations` to include the entity type as a label when creating new entity versions
- Implemented `addLabelToEntity` method to manually add additional custom labels to entities
- Added tool endpoint `add_label` for programmatic label addition

### 1.2 Entity Metadata - ✅ COMPLETED

**Implementation Details:**
- Metadata is now supported for entities via the `metadata` property
- Entity creation and updates handle metadata properly
- Search operations include metadata
- Embeddings include metadata in generated text for improved semantic search

## Phase 2: Native Relationship Types (Weeks 3-4)

### 2.1 Supporting Native Neo4j Relationship Types

**Current State**: Single `RELATES_TO` relationship type with a `relationType` property.

**Enhancement**:
- Use native Neo4j relationship types instead of/alongside `RELATES_TO`
- Support creating any relationship type dynamically
- Maintain backward compatibility with existing `RELATES_TO` + `relationType` pattern

**Implementation Steps**:

1. **Update `Relation` interface to support native relationship types**:
```typescript
interface Relation {
  from: string;
  to: string;
  // Make relationType optional when a native type is provided
  relationType?: string;
  // Add explicit relationship type
  relationshipType?: string;
  strength?: number;
  confidence?: number;
  metadata?: RelationMetadata;
}
```

2. **Update `Neo4jStorageProvider.createRelations` method**:
```typescript
async createRelations(relations: Relation[]): Promise<Relation[]> {
  // ...existing validation...
  
  // Separate traditional RELATES_TO relations from native type relations
  const relatesTo = relations.filter(r => !r.relationshipType || r.relationshipType === 'RELATES_TO');
  const nativeTypes = relations.filter(r => r.relationshipType && r.relationshipType !== 'RELATES_TO');
  
  // Process RELATES_TO relations with the existing method
  const createdRelatesTo = relatesTo.length > 0 ? 
    await this._createRelatesTo(relatesTo) : [];
  
  // Process native relationship types with a dynamic query
  const createdNative = nativeTypes.length > 0 ?
    await this._createNativeRelations(nativeTypes) : [];
  
  return [...createdRelatesTo, ...createdNative];
}

// New method to create native relationship types
private async _createNativeRelations(relations: Relation[]): Promise<Relation[]> {
  const session = this.connectionManager.getDriver().session();
  const timestamp = Date.now();
  
  try {
    // Prepare parameters
    const relationParams = relations.map(rel => ({
      id: rel.id || uuidv4(),
      from: rel.from,
      to: rel.to,
      relationshipType: rel.relationshipType,
      // For backward compatibility, use the relationship type as the relationType if not provided
      relationType: rel.relationType || rel.relationshipType,
      strength: rel.strength !== undefined ? rel.strength : null,
      confidence: rel.confidence !== undefined ? rel.confidence : null,
      metadata: rel.metadata ? JSON.stringify(rel.metadata) : null,
      validFrom: rel.validFrom || timestamp,
      validTo: rel.validTo || null,
      createdAt: rel.createdAt || timestamp,
      updatedAt: rel.updatedAt || timestamp,
      version: 1
    }));
    
    // Create dynamic relationship creation query
    const result = await session.run(`
      UNWIND $relations AS rel
      MATCH (from:Entity {name: rel.from})
      MATCH (to:Entity {name: rel.to})
      WHERE (from.validTo IS NULL OR from.validTo > $timestamp)
        AND (to.validTo IS NULL OR to.validTo > $timestamp)
      
      // Dynamically create the relationship with the specified type
      // We use apoc.create.relationship for dynamic relationship creation
      CALL apoc.create.relationship(from, rel.relationshipType, {
        id: rel.id,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
        metadata: rel.metadata,
        version: rel.version,
        createdAt: rel.createdAt,
        updatedAt: rel.updatedAt,
        validFrom: rel.validFrom,
        validTo: rel.validTo
      }, to) YIELD rel as relationship
      
      RETURN relationship, from, to
    `, { relations: relationParams, timestamp });
    
    // Process results
    const created = result.records.map(record => {
      const relationship = record.get('relationship');
      const fromNode = record.get('from');
      const toNode = record.get('to');
      
      return this.relationshipToRelation(relationship, fromNode.properties.name, toNode.properties.name);
    });
    
    return created;
  } finally {
    await session.close();
  }
}
```

3. **Update relationship search and query capabilities**:
```typescript
async getRelation(from: string, to: string, type: string, isNativeType = false): Promise<Relation | null> {
  const session = this.connectionManager.getDriver().session();
  
  try {
    let query;
    if (isNativeType) {
      // Query using native relationship type
      query = `
        MATCH (from:Entity {name: $from})-[r:${type}]->(to:Entity {name: $to})
        WHERE (r.validTo IS NULL OR r.validTo > $timestamp)
        RETURN r, from, to
      `;
    } else {
      // Query using traditional RELATES_TO + relationType property
      query = `
        MATCH (from:Entity {name: $from})-[r:RELATES_TO {relationType: $type}]->(to:Entity {name: $to})
        WHERE (r.validTo IS NULL OR r.validTo > $timestamp)
        RETURN r, from, to
      `;
    }
    
    const result = await session.run(query, {
      from,
      to,
      type,
      timestamp: Date.now()
    });
    
    // ...rest of method...
  }
}
```

4. **Update API to support relationship type detection**:
```typescript
// Helper method to determine if a string is a valid Neo4j relationship type
private isValidRelationshipType(type: string): boolean {
  // Neo4j relationship types must be alphanumeric or underscore characters
  // and cannot start with numbers
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(type);
}

// Update createRelations to support auto-detection
async createRelations(relations: Relation[]): Promise<Relation[]> {
  // Transform relations to include relationship type information
  const processedRelations = relations.map(rel => {
    // If relationshipType is not specified but relationType is valid as a Neo4j relationship type
    if (!rel.relationshipType && this.isValidRelationshipType(rel.relationType)) {
      return {
        ...rel,
        relationshipType: rel.relationType.toUpperCase()
      };
    }
    return rel;
  });
  
  return this._createRelations(processedRelations);
}
```

**Migration Strategy**:
- Create a migration tool to convert existing RELATES_TO relationships to native types
- Implement a compatibility layer that supports both patterns
- Add a configuration option to control the default relationship creation behavior

**Testing**:
- Test creation, retrieval, and deletion of various relationship types
- Benchmark query performance with native vs. property-based relationship types
- Verify that traversals with specific relationship types work correctly

### 2.2 Relationship Type Schema Management

**Current State**: No schema management for relationship types.

**Enhancement**:
- Create a registry of known relationship types
- Support defining expected properties for each relationship type
- Create utilities to help maintain consistency across relationship types

**Implementation Steps**:

1. **Create a relationship type registry**:
```typescript
interface RelationshipTypeSchema {
  name: string;
  description?: string;
  expectedProperties?: string[];
  defaultValues?: Record<string, any>;
  inverseOf?: string;
}

class RelationshipTypeRegistry {
  private types: Map<string, RelationshipTypeSchema> = new Map();
  
  registerType(schema: RelationshipTypeSchema): void {
    this.types.set(schema.name, schema);
  }
  
  getType(name: string): RelationshipTypeSchema | undefined {
    return this.types.get(name);
  }
  
  getAllTypes(): RelationshipTypeSchema[] {
    return Array.from(this.types.values());
  }
  
  // Helper to suggest a relationship type based on entity types
  suggestRelationshipTypes(fromType: string, toType: string): RelationshipTypeSchema[] {
    // Implementation to suggest appropriate relationship types
    // based on the entity types involved
  }
}
```

2. **Add schema validation to relationship creation**:
```typescript
private validateRelationship(rel: Relation): string[] {
  const warnings: string[] = [];
  
  if (rel.relationshipType) {
    const schema = this.relationshipRegistry.getType(rel.relationshipType);
    
    if (schema?.expectedProperties) {
      // Check that all expected properties exist
      for (const prop of schema.expectedProperties) {
        if (!rel.metadata || rel.metadata[prop] === undefined) {
          warnings.push(`Missing expected property: ${prop} for relationship type ${rel.relationshipType}`);
        }
      }
    }
  }
  
  return warnings;
}
```

**Migration Strategy**:
- Analyze existing relationships to identify common patterns
- Create default schemas for identified relationship types
- Incrementally add schemas as new relationship types are created

## Phase 3: Ontology Management (Weeks 5-6)

### 3.1 Enhanced Ontology Tools

**Current State**: Basic ontology representation of entity types and relationship types.

**Enhancement**:
- Create a comprehensive ontology visualization tool
- Support analyzing relationships between entity types
- Add support for suggesting relationship improvements

**Implementation Steps**:

1. **Update the ontology data structure**:
```typescript
interface OntologyEntityType {
  name: string;
  count: number;
  labels: string[];
  commonProperties: string[];
  commonMetadataFields: string[];
}

interface OntologyRelationship {
  type: string;
  count: number;
  sourceTypes: string[];
  targetTypes: string[];
  properties: string[];
  commonMetadataFields: string[];
}

interface Ontology {
  entityTypes: OntologyEntityType[];
  relationshipTypes: OntologyRelationship[];
  statistics: {
    totalEntities: number;
    totalRelationships: number;
    orphanedEntities: number;
  };
}
```

2. **Implement enhanced ontology retrieval**:
```typescript
async getOntology(): Promise<Ontology> {
  const session = this.connectionManager.getDriver().session();
  
  try {
    // Get entity type counts with labels
    const entityTypesResult = await session.run(`
      MATCH (e:Entity)
      WHERE (e.validTo IS NULL OR e.validTo > $timestamp)
      RETURN e.entityType as type, count(e) as count, 
             collect(distinct labels(e)) as allLabels,
             collect(distinct keys(e)) as allProperties,
             collect(distinct case when e.metadata is not null 
                           then keys(e.metadata) else [] end) as metadataFields
    `, { timestamp: Date.now() });
    
    // Get relationship type counts
    const relationshipTypesResult = await session.run(`
      // For RELATES_TO relationships with relationType property
      MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
      WHERE (r.validTo IS NULL OR r.validTo > $timestamp)
      RETURN r.relationType as type, count(r) as count,
             collect(distinct from.entityType) as sourceTypes,
             collect(distinct to.entityType) as targetTypes,
             collect(distinct keys(r)) as allProperties,
             collect(distinct case when r.metadata is not null 
                           then keys(r.metadata) else [] end) as metadataFields
      
      UNION
      
      // For native relationship types
      CALL {
        MATCH (from:Entity)-[r]->(to:Entity)
        WHERE type(r) <> 'RELATES_TO'
          AND (r.validTo IS NULL OR r.validTo > $timestamp)
        RETURN type(r) as type, count(r) as count,
               collect(distinct from.entityType) as sourceTypes,
               collect(distinct to.entityType) as targetTypes,
               collect(distinct keys(r)) as allProperties,
               collect(distinct case when r.metadata is not null 
                             then keys(r.metadata) else [] end) as metadataFields
      }
      
      RETURN type, count, sourceTypes, targetTypes, allProperties, metadataFields
    `, { timestamp: Date.now() });
    
    // Get orphaned entities count
    const orphanedResult = await session.run(`
      MATCH (e:Entity) 
      WHERE NOT (e)-[]-() 
        AND (e.validTo IS NULL OR e.validTo > $timestamp)
      RETURN count(e) as orphanedCount
    `, { timestamp: Date.now() });
    
    // Process entity types
    const entityTypes = entityTypesResult.records.map(record => {
      // Process entity type information
      const allLabels = record.get('allLabels');
      const flatLabels = new Set<string>();
      allLabels.forEach(labels => labels.forEach(label => flatLabels.add(label)));
      
      // Get common properties (appearing in >50% of entities)
      const allProperties = record.get('allProperties');
      const propertyCount = new Map<string, number>();
      allProperties.forEach(props => {
        props.forEach(prop => {
          propertyCount.set(prop, (propertyCount.get(prop) || 0) + 1);
        });
      });
      
      const commonProperties = Array.from(propertyCount.entries())
        .filter(([_, count]) => count > allProperties.length / 2)
        .map(([prop, _]) => prop);
      
      // Same for metadata fields
      const metadataFields = record.get('metadataFields');
      const metadataCount = new Map<string, number>();
      metadataFields.forEach(fields => {
        fields.forEach(field => {
          metadataCount.set(field, (metadataCount.get(field) || 0) + 1);
        });
      });
      
      const commonMetadataFields = Array.from(metadataCount.entries())
        .filter(([_, count]) => count > metadataFields.length / 2)
        .map(([field, _]) => field);
      
      return {
        name: record.get('type'),
        count: record.get('count').toNumber(),
        labels: Array.from(flatLabels),
        commonProperties,
        commonMetadataFields
      };
    });
    
    // Process relationship types
    const relationshipTypes = relationshipTypesResult.records.map(record => {
      // Similar processing for relationship properties and metadata
      // ...
      
      return {
        type: record.get('type'),
        count: record.get('count').toNumber(),
        sourceTypes: record.get('sourceTypes'),
        targetTypes: record.get('targetTypes'),
        properties: commonProperties,
        commonMetadataFields
      };
    });
    
    // Build final ontology
    return {
      entityTypes,
      relationshipTypes,
      statistics: {
        totalEntities: entityTypes.reduce((sum, type) => sum + type.count, 0),
        totalRelationships: relationshipTypes.reduce((sum, type) => sum + type.count, 0),
        orphanedEntities: orphanedResult.records[0].get('orphanedCount').toNumber()
      }
    };
  } finally {
    await session.close();
  }
}
```

3. **Add ontology visualization capabilities**:
```typescript
// Example D3.js or Cytoscape.js visualization code
// This would be part of a frontend component
function visualizeOntology(ontology) {
  // Create a graph visualization of the ontology
  // Nodes are entity types, edges are relationship types
  // Size represents count, etc.
}
```

**Migration Strategy**:
- Implement the enhanced ontology retrieval without changing the existing API
- Create a separate endpoint for advanced ontology visualization
- Add documentation on how to interpret the ontology results

## Phase 4: Integration and Optimization (Weeks 7-8)

### 4.1 API and Documentation Updates

**Current State**: API supports only basic operations with limited flexibility.

**Enhancement**:
- Update API to support all new features
- Create comprehensive documentation
- Provide migration guides for existing users

**Implementation Steps**:

1. **Update the API interfaces**:
```typescript
// Updated KnowledgeGraphManager API
interface KnowledgeGraphManagerAPI {
  // Entity operations with enhanced features
  createEntities(entities: Entity[]): Promise<Entity[]>;
  addLabels(entityName: string, labels: string[]): Promise<Entity>;
  updateEntityMetadata(entityName: string, metadata: Record<string, any>): Promise<Entity>;
  
  // Relationship operations with native types
  createRelationships(relations: Relation[]): Promise<Relation[]>;
  getRelationshipsByType(type: string, isNative?: boolean): Promise<Relation[]>;
  
  // Ontology operations
  getOntology(options?: OntologyOptions): Promise<Ontology>;
  visualizeOntology(): Promise<string>; // Returns URL or HTML
}
```

2. **Create comprehensive documentation**:
```markdown
# MCP Knowledge Graph API

## Entity Operations

### Creating Entities with Labels and Metadata

```typescript
// Example: Create an entity with multiple labels and metadata
await knowledgeGraph.createEntities([{
  name: "Albert Einstein",
  entityType: "Person",
  labels: ["Scientist", "Physicist", "Nobel_Laureate"],
  observations: ["Developed the theory of relativity"],
  metadata: {
    birthDate: "1879-03-14",
    deathDate: "1955-04-18",
    nationality: ["German", "Swiss", "American"],
    fieldOfStudy: "Physics"
  }
}]);
```

## Relationship Operations

### Creating Native Relationships

```typescript
// Example: Create a WORKED_AT relationship
await knowledgeGraph.createRelations([{
  from: "Albert Einstein",
  to: "Institute for Advanced Study",
  relationshipType: "WORKED_AT",
  metadata: {
    startYear: 1933,
    endYear: 1955,
    position: "Professor"
  }
}]);
```
```

3. **Create migration utilities**:
```typescript
// Example of a migration utility
async function migrateToNativeRelationships(
  knowledgeGraph: KnowledgeGraphManager,
  batchSize = 100
): Promise<{ processed: number, converted: number }> {
  let processed = 0;
  let converted = 0;
  let hasMore = true;
  let lastId = null;
  
  while (hasMore) {
    // Fetch a batch of RELATES_TO relationships
    const query = `
      MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
      WHERE (r.validTo IS NULL OR r.validTo > $timestamp)
        ${lastId ? 'AND r.id > $lastId' : ''}
      RETURN r, from, to
      ORDER BY r.id
      LIMIT $batchSize
    `;
    
    const session = knowledgeGraph.storageProvider.connectionManager.getDriver().session();
    const result = await session.run(query, {
      timestamp: Date.now(),
      lastId,
      batchSize
    });
    
    if (result.records.length === 0) {
      hasMore = false;
      break;
    }
    
    // Process each relationship
    for (const record of result.records) {
      const rel = record.get('r');
      const from = record.get('from');
      const to = record.get('to');
      
      processed++;
      lastId = rel.properties.id;
      
      const relationType = rel.properties.relationType;
      if (relationType && /^[A-Z][A-Z0-9_]*$/.test(relationType)) {
        // Valid as a Neo4j relationship type, convert it
        try {
          await knowledgeGraph.createRelations([{
            from: from.properties.name,
            to: to.properties.name,
            relationshipType: relationType,
            relationType,
            strength: rel.properties.strength,
            confidence: rel.properties.confidence,
            metadata: rel.properties.metadata ? JSON.parse(rel.properties.metadata) : undefined
          }]);
          
          // If successful, deprecate the old relationship
          await knowledgeGraph.deleteRelations([{
            from: from.properties.name,
            to: to.properties.name,
            relationType
          }]);
          
          converted++;
        } catch (error) {
          console.error(`Error converting relationship ${rel.properties.id}:`, error);
        }
      }
    }
    
    await session.close();
  }
  
  return { processed, converted };
}
```

### 4.2 Performance Optimization

**Current State**: Basic performance optimization.

**Enhancement**:
- Optimize queries for new features
- Create indexes for common patterns
- Add caching for ontology and metadata

**Implementation Steps**:

1. **Create appropriate indexes**:
```typescript
async createOptimalIndexes(): Promise<void> {
  // Create indexes for common metadata properties
  await this.connectionManager.executeQuery(`
    CREATE INDEX entity_metadata_index IF NOT EXISTS
    FOR (e:Entity)
    ON (e.metadata)
  `);
  
  // Create indexes for common relationship types
  const commonTypes = await this.getCommonRelationshipTypes();
  for (const type of commonTypes) {
    try {
      await this.connectionManager.executeQuery(`
        CREATE INDEX ${type.toLowerCase()}_rel_index IF NOT EXISTS
        FOR ()-[r:${type}]->()
        ON (r.validFrom, r.validTo)
      `);
    } catch (error) {
      console.warn(`Failed to create index for relationship type ${type}:`, error);
    }
  }
}

private async getCommonRelationshipTypes(): Promise<string[]> {
  const session = this.connectionManager.getDriver().session();
  try {
    // Get relationship types with at least 100 instances
    const result = await session.run(`
      CALL db.relationshipTypes() YIELD relationshipType
      OPTIONAL MATCH ()-[r]-()
      WHERE type(r) = relationshipType
      RETURN relationshipType, count(r) as count
      ORDER BY count DESC
      LIMIT 10
    `);
    
    return result.records
      .filter(record => record.get('count').toNumber() >= 100)
      .map(record => record.get('relationshipType'));
  } finally {
    await session.close();
  }
}
```

2. **Implement caching for ontology**:
```typescript
// Add LRU cache for ontology
private ontologyCache: LRUCache<string, Ontology>;

constructor(options) {
  // ...existing code...
  
  this.ontologyCache = new LRUCache({
    max: 1,  // Just one entry is enough
    ttl: 1000 * 60 * 60,  // 1 hour TTL
    updateAgeOnGet: true
  });
}

async getOntology(options?: OntologyOptions): Promise<Ontology> {
  const cacheKey = options ? JSON.stringify(options) : 'default';
  
  // Check cache first
  const cached = this.ontologyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Generate ontology
  const ontology = await this._generateOntology(options);
  
  // Store in cache
  this.ontologyCache.set(cacheKey, ontology);
  
  return ontology;
}
```

3. **Add query optimization for common patterns**:
```typescript
// Helper method to determine the most efficient query approach
private selectQueryStrategy(from?: string, to?: string, type?: string): QueryStrategy {
  if (from && to && type) {
    return 'direct';
  } else if (type) {
    return 'type_scan';
  } else if (from || to) {
    return 'node_scan';
  } else {
    return 'full_scan';
  }
}

// Use different query strategies based on inputs
async findRelations(
  options: { from?: string, to?: string, type?: string, isNative?: boolean }
): Promise<Relation[]> {
  const strategy = this.selectQueryStrategy(options.from, options.to, options.type);
  
  // Select the appropriate query based on the strategy
  let query;
  switch (strategy) {
    case 'direct':
      // Direct lookup with all parameters - most efficient
      query = options.isNative ? 
        `MATCH (from:Entity {name: $from})-[r:${options.type}]->(to:Entity {name: $to})` :
        `MATCH (from:Entity {name: $from})-[r:RELATES_TO {relationType: $type}]->(to:Entity {name: $to})`;
      break;
    
    case 'type_scan':
      // Scan by relationship type - use proper indexes
      query = options.isNative ?
        `MATCH (from:Entity)-[r:${options.type}]->(to:Entity)` :
        `MATCH (from:Entity)-[r:RELATES_TO {relationType: $type}]->(to:Entity)`;
      break;
    
    // ... other strategies
  }
  
  // Execute the query
  // ...
}
```

**Testing and Benchmarking**:
- Create performance test suite for all major operations
- Compare performance before and after optimizations
- Create benchmark reports for various graph sizes and query patterns

## Implementation Timeline

### Week 1-2: Entity Enhancement
- Add multiple labels support
- Implement entity metadata
- Create migration utilities
- Update entity-related API methods

### Week 3-4: Native Relationship Types
- Implement native relationship type support
- Create relationship type registry
- Update relationship-related API methods
- Create migration tools for existing relationships

### Week 5-6: Ontology Management
- Enhance ontology data structures
- Implement comprehensive ontology retrieval
- Create visualization capabilities
- Update ontology API

### Week 7-8: Integration and Optimization
- Update public API interfaces
- Create comprehensive documentation
- Implement performance optimizations
- Conduct final testing and benchmarking

## Success Metrics

- **Flexibility**: Measure how many different types of knowledge can be represented
- **Performance**: Query time for common operations compared to baseline
- **Usability**: Developer feedback on API clarity and expressiveness
- **Migration**: Percentage of existing data successfully migrated to new structures
- **Adoption**: Usage patterns of new features in applications

## Risk Management

### Potential Risks

1. **Backward Compatibility**: Changes might break existing integrations
   - **Mitigation**: Create compatibility layers and thorough testing

2. **Performance Degradation**: More complex structures could impact performance
   - **Mitigation**: Benchmark early and often, optimize critical paths

3. **Complexity**: Increased flexibility might lead to inconsistent usage
   - **Mitigation**: Create clear guidelines and validation utilities

4. **Migration Challenges**: Existing data might be difficult to migrate
   - **Mitigation**: Create robust migration tools with rollback capabilities

## Conclusion

This enhancement plan provides a roadmap for transforming the MCP knowledge graph into a more flexible, powerful system while maintaining compatibility with existing applications. By implementing these changes incrementally, we can minimize disruption while maximizing the benefits of Neo4j's native capabilities.

The end result will be a knowledge graph system that can represent diverse types of knowledge more expressively and perform complex queries more efficiently, enabling richer applications and insights. 
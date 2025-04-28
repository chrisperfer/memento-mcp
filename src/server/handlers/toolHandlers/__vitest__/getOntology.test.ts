import { describe, expect, it, vi } from 'vitest';
import { handleGetOntology } from '../getOntology';

describe('handleGetOntology', () => {
  it('should extract ontology from a graph', async () => {
    // Mock a knowledge graph with entities and relations
    const mockGraph = {
      entities: [
        { name: 'Person1', entityType: 'Person', observations: ['Observation 1'] },
        { name: 'Person2', entityType: 'Person', observations: ['Observation 2'] },
        { name: 'Team1', entityType: 'Team', observations: ['Observation 3'] },
        { name: 'Project1', entityType: 'Project', observations: ['Observation 4'] }
      ],
      relations: [
        { from: 'Person1', to: 'Team1', relationType: 'isMemberOf' },
        { from: 'Person2', to: 'Team1', relationType: 'isMemberOf' },
        { from: 'Project1', to: 'Team1', relationType: 'createdBy' }
      ]
    };

    // Mock KnowledgeGraphManager
    const mockManager = {
      readGraph: vi.fn().mockResolvedValue(mockGraph)
    };

    // Call the handler
    const result = await handleGetOntology({}, mockManager);

    // Verify the response structure
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    
    // Check that the first content item is text and contains the expected entity types
    expect(result.content[0].type).toBe('text');
    expect(typeof result.content[0].text).toBe('string');
    
    const textContent = result.content[0].text;
    expect(textContent).toContain('EntityType: Person (2)');
    expect(textContent).toContain('EntityType: Team (1)');
    expect(textContent).toContain('EntityType: Project (1)');
    
    // Check for relation types
    expect(textContent).toContain('RelationType: isMemberOf (EntityType: Person → EntityType: Team)');
    expect(textContent).toContain('RelationType: createdBy (EntityType: Project → EntityType: Team)');
    
    // Check raw data
    expect(result.content[1].type).toBe('raw_ontology_data');
    expect(result.content[1].data).toBeDefined();
    expect(result.content[1].data!.entityTypes).toHaveProperty('Person', 2);
    expect(result.content[1].data!.entityTypes).toHaveProperty('Team', 1);
    expect(result.content[1].data!.entityTypes).toHaveProperty('Project', 1);
    
    // Verify that readGraph was called
    expect(mockManager.readGraph).toHaveBeenCalledTimes(1);
  });
  
  it('should handle empty graph', async () => {
    // Mock an empty knowledge graph
    const mockGraph = {
      entities: [],
      relations: []
    };

    // Mock KnowledgeGraphManager
    const mockManager = {
      readGraph: vi.fn().mockResolvedValue(mockGraph)
    };

    // Call the handler
    const result = await handleGetOntology({}, mockManager);

    // Verify the response structure
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    
    // The text content should contain a message about empty graph
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('No entities or relations found in the knowledge graph.');
    
    // The raw data should have empty objects
    expect(result.content[1].type).toBe('raw_ontology_data');
    expect(result.content[1].data!.entityTypes).toEqual({});
    expect(result.content[1].data!.relationTypes).toEqual({});
    
    // Verify that readGraph was called
    expect(mockManager.readGraph).toHaveBeenCalledTimes(1);
  });
}); 
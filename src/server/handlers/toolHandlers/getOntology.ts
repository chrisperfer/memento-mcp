import neo4j from 'neo4j-driver';
import { handleReadGraph } from './readGraph.js';

function convertNeo4jIntegers(obj: any): any {
  if (neo4j.isInt(obj)) {
    return obj.toNumber();
  } else if (Array.isArray(obj)) {
    return obj.map(convertNeo4jIntegers);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertNeo4jIntegers(v)])
    );
  }
  return obj;
}

/**
 * Extracts and formats the ontology from the knowledge graph
 * @param graph The knowledge graph
 * @returns An object containing entity types and relation types with counts and connections
 */
function extractOntology(graph: any) {
  // Map to store entity types and their counts
  const entityTypes: Record<string, number> = {};
  
  // Map to store relation types with source and target entity types and counts
  const relationTypes: Record<string, Array<{ from: string, to: string, count: number }>> = {};
  
  // Count entity types
  if (graph && graph.entities) {
    for (const entity of graph.entities) {
      if (entity.entityType) {
        entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
      }
    }
  }
  
  // Process relations to identify their connections and counts
  if (graph && graph.relations) {
    for (const relation of graph.relations) {
      if (!relation.relationType) continue;
      
      // Find the entity types for the from and to entities
      const fromEntity = graph.entities.find((e: any) => e.name === relation.from);
      const toEntity = graph.entities.find((e: any) => e.name === relation.to);
      
      if (!fromEntity || !toEntity) continue;
      
      const fromType = fromEntity.entityType;
      const toType = toEntity.entityType;
      
      // Initialize the relation type array if it doesn't exist
      if (!relationTypes[relation.relationType]) {
        relationTypes[relation.relationType] = [];
      }
      
      // Check if this specific connection already exists
      const existingConnection = relationTypes[relation.relationType].find(
        conn => conn.from === fromType && conn.to === toType
      );
      
      if (existingConnection) {
        // Increment count for existing connection
        existingConnection.count++;
      } else {
        // Add new connection
        relationTypes[relation.relationType].push({
          from: fromType,
          to: toType,
          count: 1
        });
      }
    }
  }
  
  return { entityTypes, relationTypes };
}

/**
 * Formats the ontology into a human-readable string
 * @param ontology The extracted ontology object
 * @returns A formatted string representation of the ontology
 */
function formatOntology(ontology: { entityTypes: Record<string, number>, relationTypes: Record<string, Array<{ from: string, to: string, count: number }>> }): string {
  let output = '';
  
  const entityTypeEntries = Object.entries(ontology.entityTypes);
  const relationTypeEntries = Object.entries(ontology.relationTypes);
  
  // Check if there's anything to display
  if (entityTypeEntries.length === 0 && relationTypeEntries.length === 0) {
    return "No entities or relations found in the knowledge graph.";
  }
  
  // Format entity types
  if (entityTypeEntries.length > 0) {
    entityTypeEntries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([type, count]) => {
        output += `EntityType: ${type} (${count})\n`;
      });
    
    output += '\n';
  } else {
    output += "No entity types found in the knowledge graph.\n\n";
  }
  
  // Format relation types
  if (relationTypeEntries.length > 0) {
    relationTypeEntries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([type, connections]) => {
        // Group connections by from-to pairs to consolidate counts
        const groupedConnections: Record<string, { from: string, to: string, count: number }> = {};
        
        connections.forEach(conn => {
          const key = `${conn.from}→${conn.to}`;
          if (!groupedConnections[key]) {
            groupedConnections[key] = { ...conn };
          } else {
            groupedConnections[key].count += conn.count;
          }
        });
        
        // Output each unique connection
        Object.values(groupedConnections)
          .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
          .forEach(({ from, to, count }) => {
            output += `RelationType: ${type} (EntityType: ${from} → EntityType: ${to}) (${count})\n`;
          });
      });
  } else {
    output += "No relation types found in the knowledge graph.";
  }
  
  return output;
}

/**
 * Handles the get_ontology tool request
 * @param args The arguments for the tool request
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @returns A response object with the ontology content
 */
export async function handleGetOntology(args: any, knowledgeGraphManager: any) {
  // Use the handleReadGraph function to get the graph data
  const readGraphResponse = await handleReadGraph(args, knowledgeGraphManager);
  
  // Parse the graph data from the response
  const graph = JSON.parse(readGraphResponse.content[0].text);
  
  // Extract and format the ontology
  const ontology = extractOntology(graph);
  const formattedOntology = formatOntology(ontology);
  
  return { 
    content: [
      { 
        type: 'text', 
        text: formattedOntology 
      }
    ]
  };
} 
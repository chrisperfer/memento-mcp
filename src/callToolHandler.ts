// Note: This file connects Claude's tool calls to the appropriate internal function
// Each tool function is separate and should have the same name signature as the tools Claude uses

import { KnowledgeGraphManager } from './KnowledgeGraphManager.js';

export async function handleToolCall(
  manager: KnowledgeGraphManager, 
  toolCall: { name: string, args: Record<string, any> }
) {
  
  if (!toolCall || !toolCall.name) {
    console.error
    return { error: 'Invalid tool call' };
  }
  
  console.log

  // Handle the various tool calls
  try {
    switch(toolCall.name) {
      // ... existing code ...
      
      case 'get_ontology': {
        // Get the full graph
        const graph = await manager.readGraph();
        
        // Extract entity types with counts
        const entityTypes: Record<string, number> = {};
        graph.entities.forEach(entity => {
          if (entity.entityType) {
            entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
          }
        });
        
        // Extract relation types with from/to entity type connections and counts
        const relationTypes: Record<string, Array<{ from: string, to: string, count: number }>> = {};
        
        for (const relation of graph.relations) {
          if (!relation.relationType) continue;
          
          // Find the entity types for the from and to entities
          const fromEntity = graph.entities.find(e => e.name === relation.from);
          const toEntity = graph.entities.find(e => e.name === relation.to);
          
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
        
        // Format the output
        let output = '';
        
        // Format entity types
        const entityTypeEntries = Object.entries(entityTypes);
        const relationTypeEntries = Object.entries(relationTypes);
        
        // Check if there's anything to display
        if (entityTypeEntries.length === 0 && relationTypeEntries.length === 0) {
          return { 
            entities: [],
            relations: [],
            ontology: "No entities or relations found in the knowledge graph." 
          };
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
        
        return { 
          entities: graph.entities,
          relations: graph.relations,
          ontology: output,
          _entityTypes: entityTypes,
          _relationTypes: relationTypes
        };
      }
      
      case 'get_decayed_graph': {
        // Note: The getDecayedGraph method no longer takes options
        // The decay settings now must be configured at the StorageProvider level
        const result = await manager.getDecayedGraph();
        return result;
      }
      
      case 'add_label': {
        if (!toolCall.args.entityName || !toolCall.args.label) {
          return { error: 'Both entityName and label are required' };
        }
        try {
          await manager.addLabelToEntity(toolCall.args.entityName, toolCall.args.label);
          return { result: `Label '${toolCall.args.label}' added to entity '${toolCall.args.entityName}'.` };
        } catch (error: any) {
          return { error: error.message };
        }
      }
      
      // ... existing code ...
    }
  } catch (error) {
    // ... existing code ...
  }
} 
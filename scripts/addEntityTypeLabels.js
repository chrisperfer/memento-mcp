/**
 * Migration script to add entityType as a label to all existing entities
 * 
 * Run with: node scripts/addEntityTypeLabels.js
 */

import { Neo4jConnectionManager } from '../src/storage/neo4j/Neo4jConnectionManager.js';

// Function to sanitize entity type for use as a Neo4j label
function sanitizeLabel(entityType) {
  if (!entityType) return 'Unknown';
  
  // Remove invalid characters (Neo4j labels must start with a letter and contain only alphanumeric and _)
  const sanitized = entityType.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(sanitized)) {
    return 'T_' + sanitized;
  }
  
  return sanitized;
}

async function main() {
  console.log('Starting migration to add entityType labels to existing entities...');
  
  // Initialize the Neo4j connection manager
  const connectionManager = new Neo4jConnectionManager();
  
  try {
    // Get a Neo4j session
    await connectionManager.initialize();
    
    console.log('Connected to Neo4j database');
    
    // Get all entities that are current (not expired)
    const getAllEntitiesQuery = `
      MATCH (e:Entity)
      WHERE (e.validTo IS NULL OR e.validTo > timestamp())
      RETURN e.name as name, e.entityType as entityType
    `;
    
    console.log('Fetching all current entities...');
    const entitiesResult = await connectionManager.executeQuery(getAllEntitiesQuery);
    
    const entities = entitiesResult.records.map(record => ({
      name: record.get('name'),
      entityType: record.get('entityType')
    }));
    
    console.log(`Found ${entities.length} entities to process`);
    
    // Process each entity
    let updated = 0;
    let skipped = 0;
    
    for (const entity of entities) {
      if (!entity.entityType) {
        console.log(`Skipping entity '${entity.name}' - no entityType defined`);
        skipped++;
        continue;
      }
      
      // Sanitize the entity type to ensure it's a valid Neo4j label
      const sanitizedLabel = sanitizeLabel(entity.entityType);
      
      // Add the entity type as a label
      const addLabelQuery = `
        MATCH (e:Entity {name: $name})
        WHERE (e.validTo IS NULL OR e.validTo > timestamp())
        SET e:${sanitizedLabel}
        RETURN e
      `;
      
      try {
        const result = await connectionManager.executeQuery(addLabelQuery, { name: entity.name });
        if (result.records.length > 0) {
          console.log(`Added label '${sanitizedLabel}' to entity '${entity.name}'`);
          updated++;
        } else {
          console.log(`Failed to add label to entity '${entity.name}' - entity not found`);
          skipped++;
        }
      } catch (error) {
        console.error(`Error adding label to entity '${entity.name}':`, error.message);
        skipped++;
      }
    }
    
    console.log('\nMigration complete:');
    console.log(`- Total entities processed: ${entities.length}`);
    console.log(`- Entities updated: ${updated}`);
    console.log(`- Entities skipped: ${skipped}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the Neo4j connection
    await connectionManager.close();
    console.log('Neo4j connection closed');
  }
}

// Run the migration
main().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 
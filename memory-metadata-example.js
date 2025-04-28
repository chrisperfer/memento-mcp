// This script demonstrates how to work with entity metadata using in-memory storage
// To run: node memory-metadata-example.js

import { KnowledgeGraphManager } from './dist/KnowledgeGraphManager.js';

async function main() {
  try {
    console.log('Initializing Knowledge Graph with in-memory storage...');
    
    // Create a knowledge graph manager with in-memory storage (no provider)
    const memoryFilePath = './temp-memory.json';
    const knowledgeGraph = new KnowledgeGraphManager({
      memoryFilePath
    });
    
    // Create an entity with metadata
    const entity = {
      name: 'Test Entity with Metadata',
      entityType: 'Test',
      observations: [
        'This is an observation about the test entity',
        'This is another observation'
      ],
      metadata: {
        testField: 'test value',
        numberField: 42,
        dateField: new Date().toISOString(),
        nestedData: {
          property1: 'value1',
          property2: 'value2'
        },
        arrayField: ['item1', 'item2', 'item3']
      }
    };
    
    console.log(`Creating entity "${entity.name}" with metadata...`);
    await knowledgeGraph.createEntities([entity]);
    
    // Retrieve the entity to confirm metadata was stored
    console.log(`Retrieving entity "${entity.name}"...`);
    const result = await knowledgeGraph.openNodes([entity.name]);
    
    console.log('\nRetrieved entity with metadata:');
    console.log(JSON.stringify(result.entities[0], null, 2));
    
    // Update entity metadata
    console.log('\nUpdating entity metadata...');
    await knowledgeGraph.updateEntity(entity.name, {
      metadata: {
        updatedField: 'This is a new field',
        lastUpdated: new Date().toISOString()
        // Note: existing metadata fields are preserved
      }
    });
    
    // Retrieve the entity again to confirm the updated metadata
    console.log(`\nRetrieving entity "${entity.name}" after metadata update...`);
    const updatedResult = await knowledgeGraph.openNodes([entity.name]);
    
    console.log('\nRetrieved entity with updated metadata:');
    console.log(JSON.stringify(updatedResult.entities[0], null, 2));
    
    // Clean up
    console.log('\nCleaning up...');
    await knowledgeGraph.deleteEntities([entity.name]);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 
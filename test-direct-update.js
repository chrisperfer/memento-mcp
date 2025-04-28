// Direct metadata update test
import { KnowledgeGraphManager } from './dist/KnowledgeGraphManager.js';

async function main() {
  try {
    // Create a memory-based knowledge graph manager (no DB needed)
    const memoryFilePath = './temp-memory.json';
    const knowledgeGraph = new KnowledgeGraphManager({
      memoryFilePath
    });
    
    // Step 1: Create a test entity
    console.log('Creating test entity...');
    const entity = {
      name: 'Metadata Direct Test',
      entityType: 'Test',
      observations: ['Initial observation'],
      metadata: {
        initialField: 'initial value'
      }
    };
    
    await knowledgeGraph.createEntities([entity]);
    
    // Step 2: Update only the metadata
    console.log('Updating metadata...');
    await knowledgeGraph.updateEntity('Metadata Direct Test', {
      metadata: {
        uniqueSearchPhrase: 'b3ac2d8e7f15a923a61c9428',
        updatedAt: new Date().toISOString() 
      }
    });
    
    // Step 3: Check the updated entity
    console.log('Reading updated entity...');
    const graph = await knowledgeGraph.openNodes(['Metadata Direct Test']);
    
    console.log('Updated entity:');
    console.log(JSON.stringify(graph.entities[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 
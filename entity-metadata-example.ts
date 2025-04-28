import { KnowledgeGraphManager } from './src/KnowledgeGraphManager.js';
import { StorageProviderFactory } from './src/storage/StorageProviderFactory.js';
import { Neo4jStorageProvider } from './src/storage/neo4j/Neo4jStorageProvider.js';

/**
 * Example script demonstrating how to use entity metadata
 */
async function main() {
  try {
    console.log('Initializing Knowledge Graph with Neo4j...');
    
    // Create a storage provider
    const factory = new StorageProviderFactory();
    const storageProvider = new Neo4jStorageProvider();
    
    // Create a knowledge graph manager
    const knowledgeGraph = new KnowledgeGraphManager({
      storageProvider
    });
    
    // Create an entity with metadata
    const entityWithMetadata = {
      name: 'Albert Einstein',
      entityType: 'Person',
      observations: [
        'Developed the theory of relativity',
        'Won the Nobel Prize in Physics in 1921'
      ],
      metadata: {
        birthDate: '1879-03-14',
        deathDate: '1955-04-18',
        nationality: ['German', 'Swiss', 'American'],
        field: 'Physics',
        awards: [
          {
            name: 'Nobel Prize in Physics',
            year: 1921,
            reason: 'For his services to Theoretical Physics, and especially for his discovery of the law of the photoelectric effect'
          }
        ]
      }
    };
    
    console.log(`Creating entity "${entityWithMetadata.name}" with metadata...`);
    await knowledgeGraph.createEntities([entityWithMetadata]);
    
    // Retrieve the entity to confirm metadata was stored
    console.log(`Retrieving entity "${entityWithMetadata.name}"...`);
    const result = await knowledgeGraph.openNodes([entityWithMetadata.name]);
    
    console.log('\nRetrieved entity with metadata:');
    console.log(JSON.stringify(result.entities[0], null, 2));
    
    // Update entity metadata
    console.log('\nUpdating entity metadata...');
    await knowledgeGraph.updateEntity(entityWithMetadata.name, {
      metadata: {
        knownFor: [
          'Theory of Relativity',
          'Mass-energy equivalence (E=mc²)',
          'Photoelectric effect'
        ],
        // The existing metadata will be preserved
      }
    });
    
    // Retrieve the entity again to confirm the updated metadata
    console.log(`\nRetrieving entity "${entityWithMetadata.name}" after metadata update...`);
    const updatedResult = await knowledgeGraph.openNodes([entityWithMetadata.name]);
    
    console.log('\nRetrieved entity with updated metadata:');
    console.log(JSON.stringify(updatedResult.entities[0], null, 2));
    
    // Clean up (optional)
    console.log('\nCleaning up...');
    await knowledgeGraph.deleteEntities([entityWithMetadata.name]);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Ensure proper shutdown
    process.exit(0);
  }
}

// Run the example
main(); 
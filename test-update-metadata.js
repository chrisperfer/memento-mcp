// Script to test updating entity metadata
import { KnowledgeGraphManager } from './dist/KnowledgeGraphManager.js';
import { Neo4jStorageProvider } from './dist/storage/neo4j/Neo4jStorageProvider.js';

async function main() {
  try {
    // Create a Neo4j storage provider
    const storageProvider = new Neo4jStorageProvider();
    
    // Create a knowledge graph manager
    const knowledgeGraph = new KnowledgeGraphManager({
      storageProvider
    });
    
    console.log('Updating metadata for "Metadata Update Test" entity');
    
    // Update only the entity's metadata
    const updatedEntity = await knowledgeGraph.updateEntity('Metadata Update Test', {
      metadata: {
        uniqueSearchPhrase: "xyzMetadataUpdateTriggerTest123", 
        updatedAt: new Date().toISOString()
      }
    });
    
    console.log('Update complete. Updated entity:');
    console.log(JSON.stringify(updatedEntity, null, 2));
    
    await storageProvider.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 
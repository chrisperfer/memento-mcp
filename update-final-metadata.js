// Direct update of metadata with reloaded code
import { KnowledgeGraphManager } from './dist/KnowledgeGraphManager.js';
import { Neo4jStorageProvider } from './dist/storage/neo4j/Neo4jStorageProvider.js';

async function main() {
  try {
    // Use Neo4j provider to match MCP tools
    const storageProvider = new Neo4jStorageProvider();
    
    const knowledgeGraph = new KnowledgeGraphManager({
      storageProvider
    });
    
    console.log('Updating metadata for Final Metadata Test...');
    
    // Update only the metadata
    await knowledgeGraph.updateEntity('Final Metadata Test', {
      metadata: {
        uniqueField: 'z3x7y9q8',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('Metadata update complete.');
    
    // Clean up
    await storageProvider.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 
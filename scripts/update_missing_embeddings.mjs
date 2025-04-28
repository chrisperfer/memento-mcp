import 'dotenv/config.js';
import { KnowledgeGraphManager } from '../dist/KnowledgeGraphManager.js';
import { initializeStorageProvider } from '../dist/config/storage.js';
import { EmbeddingServiceFactory } from '../dist/embeddings/EmbeddingServiceFactory.js';
import { logger } from '../dist/utils/logger.js';

async function main() {
  // Initialize storage and embedding service
  const storageProvider = initializeStorageProvider();
  const embeddingService = EmbeddingServiceFactory.createFromEnvironment();

  // Create the knowledge graph manager
  const knowledgeGraphManager = new KnowledgeGraphManager({
    storageProvider,
    // No need for EmbeddingJobManager here
    vectorStoreOptions: storageProvider.vectorStoreOptions
  });

  // Load all entities
  const graph = await knowledgeGraphManager.readGraph();

  let updated = 0;
  for (const entity of graph.entities) {
    if (!entity.embedding) {
      // Prepare text for embedding (similar to EmbeddingJobManager)
      const lines = [
        `Name: ${entity.name}`,
        `Type: ${entity.entityType}`,
        'Observations:'
      ];
      let observationsArray = entity.observations;
      if (typeof observationsArray === 'string') {
        try {
          observationsArray = JSON.parse(observationsArray);
        } catch {
          observationsArray = [observationsArray];
        }
      }
      if (!Array.isArray(observationsArray)) {
        observationsArray = [String(observationsArray)];
      }
      if (observationsArray.length > 0) {
        lines.push(...observationsArray.map(obs => `- ${obs}`));
      } else {
        lines.push('  (No observations)');
      }
      const text = lines.join('\n');

      // Generate embedding
      const embedding = await embeddingService.generateEmbedding(text);
      const modelInfo = embeddingService.getModelInfo();

      // Update entity in Neo4j
      if (typeof storageProvider.updateEntityEmbedding === 'function') {
        await storageProvider.updateEntityEmbedding(entity.name, {
          vector: embedding,
          model: modelInfo.name,
          lastUpdated: Date.now()
        });
        logger.info(`Updated embedding for entity: ${entity.name}`);
        updated++;
      } else {
        logger.error('Your storage provider does not implement updateEntityEmbedding!');
        process.exit(1);
      }
    }
  }

  logger.info(`Updated embeddings for ${updated} entities.`);
}

main().catch((err) => {
  logger.error('Error updating embeddings:', err);
  process.exit(1);
});
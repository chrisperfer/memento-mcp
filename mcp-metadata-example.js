// Example of how the mcp_synapster-chris_create_entities tool should be updated to support metadata

/*
The mcp_synapster-chris_create_entities function should be updated to accept a metadata field
in each entity object. Here's how the function signature would look:

mcp_synapster-chris_create_entities({
  entities: [
    {
      name: string;
      entityType: string;
      observations: string[];
      id?: string;
      createdAt?: number;
      updatedAt?: number; 
      validFrom?: number;
      validTo?: number;
      version?: number;
      changedBy?: string;
      metadata?: Record<string, any>; // New metadata field
    }
  ]
})

Example usage:
*/

// This code is for demonstration purposes only
async function createMcpEntityWithMetadata() {
  const result = await mcp_synapster_chris_create_entities({
    entities: [
      {
        name: "Project Alpha",
        entityType: "Project",
        observations: [
          "Started in January 2023",
          "Focused on AI integration"
        ],
        metadata: {
          startDate: "2023-01-15",
          status: "active",
          priority: "high",
          team: ["Alice", "Bob", "Charlie"],
          budget: {
            allocated: 500000,
            spent: 125000,
            currency: "USD"
          },
          milestones: [
            {
              name: "Planning Phase",
              completed: true,
              date: "2023-02-28"
            },
            {
              name: "Development Phase",
              completed: false,
              date: "2023-07-31"
            }
          ],
          tags: ["ai", "machine-learning", "enterprise"]
        }
      }
    ]
  });
  
  return result;
}

// The metadata would be stored in the Neo4j database as a JSON string
// and could be updated using the KnowledgeGraphManager.updateEntity method:

async function updateMcpEntityMetadata() {
  // Adding new fields to existing metadata
  await updateEntity("Project Alpha", {
    metadata: {
      lastUpdated: new Date().toISOString(),
      status: "in-progress",  // This would override the existing "active" status
      riskLevel: "medium"     // This would be added as a new field
    }
  });
  
  // The resulting metadata would merge with existing metadata:
  /*
  {
    startDate: "2023-01-15",
    status: "in-progress",    // Updated
    priority: "high",
    team: ["Alice", "Bob", "Charlie"],
    budget: {
      allocated: 500000,
      spent: 125000,
      currency: "USD"
    },
    milestones: [...],
    tags: ["ai", "machine-learning", "enterprise"],
    lastUpdated: "2023-04-28T12:34:56.789Z",  // Added
    riskLevel: "medium"       // Added
  }
  */
}

// This is just an example of how the metadata could be used in searches
function searchByMetadata() {
  // The metadata would be included in embeddings and searchable via semantic search
  const searchTerm = "high priority enterprise projects with budget over 300k";
  
  // The search would be able to match based on metadata content
  // because EmbeddingJobManager._prepareEntityText() now includes metadata in the embedding text
}

// Note: This is a demonstration file only and not intended to be executed directly. 
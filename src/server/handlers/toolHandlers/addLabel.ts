/**
 * Handles the add_label tool request
 * @param args The arguments for the tool request
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @returns A response object with the result content
 */
export async function handleAddLabel(args: any, knowledgeGraphManager: any) {
  try {
    if (!args.entityName || !args.label) {
      throw new Error('Both entityName and label are required');
    }
    await knowledgeGraphManager.addLabelToEntity(args.entityName, args.label);
    return {
      content: [{
        type: 'text',
        text: `Label '${args.label}' added to entity '${args.entityName}'.`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error adding label: ${error.message}`
      }]
    };
  }
} 
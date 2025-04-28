import neo4j from 'neo4j-driver';

function convertNeo4jIntegers(obj: any): any {
  if (neo4j.isInt(obj)) {
    return obj.toNumber();
  } else if (Array.isArray(obj)) {
    return obj.map(convertNeo4jIntegers);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertNeo4jIntegers(v)])
    );
  }
  return obj;
}

/**
 * Handles the read_graph tool request
 * @param args The arguments for the tool request
 * @param knowledgeGraphManager The KnowledgeGraphManager instance
 * @returns A response object with the result content
 */
export async function handleReadGraph(args: any, knowledgeGraphManager: any) {
  let result = await knowledgeGraphManager.readGraph();
  result = convertNeo4jIntegers(result);
  return { 
    content: [{ 
      type: 'text', 
      text: JSON.stringify(result, null, 2) 
    }] 
  };
} 
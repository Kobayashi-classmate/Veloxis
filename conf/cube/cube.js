module.exports = {
  /**
   * Refined queryRewrite for multi-tenant data isolation.
   * Extracts all referenced cubes from the query and injects
   * a filter on \`<CubeName>.project_id\` to match the tenantId.
   */
  queryRewrite: (query, context) => {
    const { req } = context;
    // Attempt to get tenant id from headers, or fallback to security context if implemented
    const tenantId = req ? req.headers['x-tenant-id'] : null;
    
    if (tenantId) {
      console.log(`[Cube.js] Applying row-level security for tenant: ${tenantId}`);
      if (!query.filters) query.filters = [];
      
      // Identify all unique cubes used in this query
      const referencedCubes = new Set();
      
      if (query.measures) {
        query.measures.forEach(m => referencedCubes.add(m.split('.')[0]));
      }
      if (query.dimensions) {
        query.dimensions.forEach(d => referencedCubes.add(d.split('.')[0]));
      }
      
      // Inject a project_id filter for every referenced cube
      referencedCubes.forEach(cube => {
        query.filters.push({
          member: `${cube}.project_id`,
          operator: 'equals',
          values: [tenantId],
        });
      });
    }

    return query;
  },
};

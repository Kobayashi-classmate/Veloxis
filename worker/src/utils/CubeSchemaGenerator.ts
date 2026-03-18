import fs from 'fs';
import path from 'path';

export class CubeSchemaGenerator {
    static generateSchema(tableName: string, headers: string[], datasetId: string) {
        const cubeName = `Dataset_${datasetId.replace(/-/g, '_')}`;
        
        const dimensions = headers.map(h => {
            return `
    '${h}': {
      sql: \`${h}\`,
      type: \`string\`,
      title: '${h}'
    }`;
        }).join(',');

        const schema = `cube('${cubeName}', {
  sql: \`SELECT * FROM veloxis_data.${tableName}\`,

  measures: {
    count: {
      type: \`count\`,
      title: 'Total Records'
    }
  },

  dimensions: {
${dimensions},
    // Multi-tenant isolation key
    project_id: {
      sql: \`project_id\`,
      type: \`string\`,
      title: 'Project ID',
      shown: false // Hide from external tools since it's just for row-level security
    }
  }
});
`;
        
        // Output inside the mapped volume
        const dir = path.join('/cube', 'conf', 'model');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, `${cubeName}.js`);
        fs.writeFileSync(filePath, schema);
        console.log(`[Cube.js] Generated dynamic schema for ${cubeName} at ${filePath}`);
    }
}

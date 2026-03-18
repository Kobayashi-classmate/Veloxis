// data/cube_conf/model/ExcelData.js

cube('ExcelData', {
  sql: `SELECT *, 'default_project' as project_id FROM veloxis_data.excel_test_final`,

  measures: {
    count: {
      type: `count`,
      description: `Total number of records`
    }
  },

  dimensions: {
    id: {
      sql: `c1`,
      type: `string`,
      primaryKey: true,
      title: 'Record ID'
    },
    
    col2: {
      sql: `c2`,
      type: `string`,
      title: 'Column 2'
    },

    col3: {
      sql: `c3`,
      type: `string`,
      title: 'Column 3'
    },

    col4: {
        sql: `c4`,
        type: `string`,
        title: 'Column 4'
    },

    // This dimension is crucial for our multi-tenancy to work.
    // We are mocking it here since the excel file doesn't have it.
    projectId: {
        sql: `project_id`,
        type: `string`
    }
  }
});

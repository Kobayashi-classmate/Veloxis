cube('TestIngestion', {
  sql: `SELECT * FROM veloxis_data.test_ingestion_1773798826514`,

  preAggregations: {
    // Basic pre-aggregation for total amount by day
    DailyAmountSum: {
      type: `rollup`,
      measureReferences: [totalAmount, count],
      timeDimensionReference: createdAt,
      granularity: `day`,
      partitionGranularity: `month`,
      refreshKey: {
        every: `1 hour`
      }
    }
  },

  measures: {
    count: {
      type: `count`,
      title: 'Total Records',
      description: `Total number of records`
    },
    
    totalAmount: {
      sql: `amount`,
      type: `sum`,
      title: 'Total Amount',
      description: `Sum of the amount column`
    },

    averageAmount: {
      sql: `amount`,
      type: `avg`,
      title: 'Average Amount'
    }
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `number`,
      primaryKey: true,
      title: 'Record ID'
    },
    
    name: {
      sql: `name`,
      type: `string`,
      title: 'Name'
    },

    createdAt: {
      sql: `created_at`,
      type: `time`,
      title: 'Created At'
    }
  }
});

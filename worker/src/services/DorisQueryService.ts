import mysql from 'mysql2/promise';
import { config } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface DorisColumn {
    name: string;
    type: string;
    nullable: boolean;
}

export interface QueryRequest {
    /** Column name to use as the X-axis / grouping dimension. */
    xColumn: string;
    /** Column name to aggregate on the Y-axis. Optional for count aggregation. */
    yColumn?: string;
    /** Optional column to break data into series (multi-line / stacked bar). */
    seriesColumn?: string;
    /**
     * Aggregation function applied to yColumn.
     * Defaults to 'count' when yColumn is omitted.
     */
    aggregation?: 'sum' | 'count' | 'avg' | 'max' | 'min';
    /** Row limit for the result set. Defaults to 1000, capped at 10 000. */
    limit?: number;
    /** Simple equality filters: { columnName: value }. */
    filters?: Record<string, string>;
    /**
     * REQUIRED – enforces row-level security.
     * Only rows where project_id = projectId are returned.
     */
    projectId: string;
}

export interface QueryResult {
    rows: Record<string, unknown>[];
    total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist helper – prevents SQL injection on column identifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when a string is a safe Doris/MySQL identifier:
 * letters, digits, underscores only, non-empty, max 64 chars.
 * Called on every user-supplied column name before interpolating into SQL.
 */
function isSafeIdentifier(name: string): boolean {
    return /^[A-Za-z0-9_]{1,64}$/.test(name);
}

/** Wraps an identifier in backticks for safe interpolation. */
function quoteIdent(name: string): string {
    if (!isSafeIdentifier(name)) {
        throw new Error(`Unsafe column identifier: "${name}"`);
    }
    return `\`${name}\``;
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// DorisQueryService
// ─────────────────────────────────────────────────────────────────────────────

export class DorisQueryService {
    /**
     * Opens a short-lived mysql2 connection to Doris FE MySQL interface (port 9030).
     * Each method creates and closes its own connection to avoid pool state leakage.
     */
    private async createConnection(): Promise<mysql.Connection> {
        return mysql.createConnection({
            host: config.doris.host,
            port: 9030,
            user: config.doris.user,
            password: config.doris.password,
            database: config.doris.database,
        });
    }

    /**
     * Returns the Doris table name for a given datasetId.
     * Mirrors the convention used in WebhookServer / IngestionWorker.
     */
    private tableNameForDataset(datasetId: string): string {
        if (!isUuid(datasetId)) {
            throw Object.assign(
                new Error(`Invalid datasetId format: "${datasetId}"`),
                { code: 'INVALID_DATASET_ID' }
            );
        }
        return `ds_${datasetId.replace(/-/g, '_')}`;
    }

    // ─── TASK 2: Column Metadata ───────────────────────────────────────────────

    /**
     * Runs `DESCRIBE <table>` and returns the column list.
     * Excludes the internal `project_id` column (row-level-security column).
     *
     * @throws Error with code TABLE_NOT_FOUND when the table does not exist.
     */
    async describeTable(datasetId: string): Promise<DorisColumn[]> {
        const tableName = this.tableNameForDataset(datasetId);
        const db = await this.createConnection();

        try {
            console.log(`[DorisQueryService] DESCRIBE ${config.doris.database}.\`${tableName}\``);

            // mysql2 typings return [rows, fields]; rows is RowDataPacket[]
            const [rows] = await db.query<mysql.RowDataPacket[]>(
                `DESCRIBE \`${config.doris.database}\`.\`${tableName}\``
            );

            if (!rows || rows.length === 0) {
                throw Object.assign(
                    new Error(`Table for dataset ${datasetId} not found in Doris`),
                    { code: 'TABLE_NOT_FOUND' }
                );
            }

            // Filter out the internal RLS column
            const columns: DorisColumn[] = rows
                .filter((row) => row['Field'] !== 'project_id')
                .map((row) => ({
                    name: String(row['Field']),
                    type: String(row['Type']),
                    nullable: String(row['Null']).toUpperCase() === 'YES',
                }));

            console.log(`[DorisQueryService] Found ${columns.length} columns for dataset ${datasetId}`);
            return columns;
        } finally {
            await db.end();
        }
    }

    // ─── TASK 3: Query API ─────────────────────────────────────────────────────

    /**
     * Executes a parameterized aggregation query against a dataset table.
     *
     * Security:
     * - Column names validated against isSafeIdentifier() allowlist.
     * - projectId enforced as a WHERE clause (row-level security).
     * - Filter values passed as prepared statement parameters (no interpolation).
     * - Result limit capped at MAX_LIMIT to prevent runaway queries.
     */
    async queryDataset(datasetId: string, req: QueryRequest): Promise<QueryResult> {
        const MAX_LIMIT = 10_000;
        const effectiveLimit = Math.min(req.limit ?? 1000, MAX_LIMIT);
        const tableName = this.tableNameForDataset(datasetId);

        // Validate column identifiers before building SQL
        const xCol = quoteIdent(req.xColumn);
        const aggregation = req.aggregation ?? (req.yColumn ? 'sum' : 'count');
        const validAggs = ['sum', 'count', 'avg', 'max', 'min'] as const;
        if (!validAggs.includes(aggregation as typeof validAggs[number])) {
            throw new Error(`Invalid aggregation function: ${aggregation}`);
        }

        let yExpr: string;
        if (aggregation === 'count') {
            yExpr = 'COUNT(*) AS `y`';
        } else {
            if (!req.yColumn) {
                throw new Error(`yColumn is required for aggregation="${aggregation}"`);
            }
            const yCol = quoteIdent(req.yColumn);
            yExpr = `${aggregation.toUpperCase()}(${yCol}) AS \`y\``;
        }

        // Optional series column
        let seriesSelect = '';
        let seriesGroup = '';
        if (req.seriesColumn) {
            const sCol = quoteIdent(req.seriesColumn);
            seriesSelect = `, ${sCol} AS \`series\``;
            seriesGroup = `, ${sCol}`;
        }

        // Build WHERE clauses — project_id is always enforced
        const whereClauses: string[] = ['`project_id` = ?'];
        const params: unknown[] = [req.projectId];

        if (req.filters) {
            for (const [col, val] of Object.entries(req.filters)) {
                whereClauses.push(`${quoteIdent(col)} = ?`);
                params.push(val);
            }
        }

        const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;
        const groupBySQL = `GROUP BY ${xCol}${seriesGroup}`;

        const sql = `
            SELECT
                ${xCol} AS \`x\`,
                ${yExpr}
                ${seriesSelect}
            FROM \`${config.doris.database}\`.\`${tableName}\`
            ${whereSQL}
            ${groupBySQL}
            ORDER BY ${xCol}
            LIMIT ${effectiveLimit}
        `;

        console.log(`[DorisQueryService] Executing query for dataset ${datasetId} (project: ${req.projectId}, limit: ${effectiveLimit})`);

        const db = await this.createConnection();
        try {
            const [rows] = await db.query<mysql.RowDataPacket[]>(sql, params);
            const result: QueryResult = {
                rows: rows as Record<string, unknown>[],
                total: rows.length,
            };
            console.log(`[DorisQueryService] Query returned ${result.total} rows for dataset ${datasetId}`);
            return result;
        } finally {
            await db.end();
        }
    }
}

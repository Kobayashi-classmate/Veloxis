import axios from 'axios';
import { config } from '../config';
import { DorisQueryService, QueryResult } from './DorisQueryService';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persisted in wb_charts.binding_json.
 * Describes which dataset + columns drive this chart's data.
 */
export interface ChartBinding {
    /** UUID of the source dataset (maps to Doris table ds_{id}). */
    dataset_id: string;
    /** Column used as the X-axis / category dimension. */
    x_column: string;
    /** Column to aggregate for the Y-axis value. Optional for count-only charts. */
    y_column?: string;
    /** Column used to split data into multiple series. Optional. */
    series_column?: string;
    /** Aggregation function. Defaults to 'count'. */
    aggregation?: 'sum' | 'count' | 'avg' | 'max' | 'min';
}

export interface BindingDataResponse {
    binding: ChartBinding;
    data: QueryResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartBindingService
// ─────────────────────────────────────────────────────────────────────────────

export class ChartBindingService {
    private dorisQuery: DorisQueryService;

    constructor() {
        this.dorisQuery = new DorisQueryService();
    }

    private extractId(value: any): string | null {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && typeof value.id === 'string') return value.id;
        return null;
    }

    // ─── Save / upsert binding ───────────────────────────────────────────────

    /**
     * Persists a ChartBinding to wb_charts.binding_json via Directus PATCH.
     * The binding is JSON-stringified before storage so it fits the existing
     * TEXT/JSON field without schema migration risk.
     *
     * @returns The saved binding (round-tripped through Directus).
     */
    async saveBinding(chartId: string, binding: ChartBinding, accessToken: string): Promise<ChartBinding> {
        // Basic validation
        if (!binding.dataset_id) throw new Error('binding.dataset_id is required');
        if (!binding.x_column) throw new Error('binding.x_column is required');

        const validAggs = ['sum', 'count', 'avg', 'max', 'min'] as const;
        if (binding.aggregation && !validAggs.includes(binding.aggregation)) {
            throw new Error(`Invalid aggregation: ${binding.aggregation}`);
        }

        console.log(`[ChartBindingService] Saving binding for chart ${chartId} → dataset ${binding.dataset_id}`);

        const headers = { Authorization: `Bearer ${accessToken}` };

        await axios.patch(
            `${config.directus.url}/items/wb_charts/${chartId}`,
            { binding_json: JSON.stringify(binding) },
            { headers }
        );

        console.log(`[ChartBindingService] Binding saved for chart ${chartId}`);
        return binding;
    }

    // ─── Read binding ────────────────────────────────────────────────────────

    /**
     * Fetches the current binding_json for a chart from Directus.
     *
     * @throws Error with code BINDING_NOT_FOUND when no binding is set.
     */
    async getBinding(chartId: string, accessToken: string): Promise<ChartBinding> {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const res = await axios.get(
            `${config.directus.url}/items/wb_charts/${chartId}`,
            { headers }
        );

        const rawBinding: string | null = res.data?.data?.binding_json ?? null;
        if (!rawBinding) {
            throw Object.assign(
                new Error(`Chart ${chartId} has no data binding configured`),
                { code: 'BINDING_NOT_FOUND' }
            );
        }

        return JSON.parse(rawBinding) as ChartBinding;
    }

    /**
     * Resolves chart -> canvas -> category -> workbook -> project_id.
     * This prevents clients from forging a project context in query params.
     */
    async resolveProjectIdForChart(chartId: string, accessToken: string): Promise<string> {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const chartRes = await axios.get(`${config.directus.url}/items/wb_charts/${chartId}`, {
            headers,
            params: { fields: 'id,canvas_id' },
        });
        const canvasId = this.extractId(chartRes.data?.data?.canvas_id);
        if (!canvasId) {
            throw Object.assign(new Error(`Chart ${chartId} not found`), { code: 'CHART_NOT_FOUND' });
        }

        const canvasRes = await axios.get(`${config.directus.url}/items/wb_canvases/${canvasId}`, {
            headers,
            params: { fields: 'id,category_id' },
        });
        const categoryId = this.extractId(canvasRes.data?.data?.category_id);
        if (!categoryId) {
            throw Object.assign(new Error(`Canvas ${canvasId} has no category`), { code: 'CATEGORY_NOT_FOUND' });
        }

        const categoryRes = await axios.get(`${config.directus.url}/items/wb_categories/${categoryId}`, {
            headers,
            params: { fields: 'id,workbook_id' },
        });
        const workbookId = this.extractId(categoryRes.data?.data?.workbook_id);
        if (!workbookId) {
            throw Object.assign(new Error(`Category ${categoryId} has no workbook`), { code: 'WORKBOOK_NOT_FOUND' });
        }

        const workbookRes = await axios.get(`${config.directus.url}/items/workbooks/${workbookId}`, {
            headers,
            params: { fields: 'id,project_id' },
        });
        const projectId = this.extractId(workbookRes.data?.data?.project_id);
        if (!projectId) {
            throw Object.assign(new Error(`Workbook ${workbookId} has no project`), { code: 'PROJECT_NOT_FOUND' });
        }

        return projectId;
    }

    // ─── Resolve binding to data ─────────────────────────────────────────────

    /**
     * Reads the chart's binding then executes the corresponding Doris query.
     * The projectId is fetched from Directus (canvas → canvas_id → project) to
     * ensure row-level security is always enforced server-side, never trusted
     * from the client.
     *
     * @param chartId UUID of the wb_charts record.
     */
    async resolveBindingData(chartId: string, accessToken: string): Promise<BindingDataResponse> {
        const binding = await this.getBinding(chartId, accessToken);
        const projectId = await this.resolveProjectIdForChart(chartId, accessToken);

        console.log(`[ChartBindingService] Resolving data for chart ${chartId} (dataset: ${binding.dataset_id}, project: ${projectId})`);

        const data = await this.dorisQuery.queryDataset(binding.dataset_id, {
            xColumn: binding.x_column,
            yColumn: binding.y_column,
            seriesColumn: binding.series_column,
            aggregation: binding.aggregation,
            projectId,
        });

        return { binding, data };
    }
}

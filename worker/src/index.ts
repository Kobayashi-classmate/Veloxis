import { initIngestionWorker } from './jobs/IngestionWorker';
import { startWebhookServer } from './services/WebhookServer';

const bootstrap = async () => {
    console.log('[App] Starting Veloxis Data Worker Node (Industrial v1)...');

    try {
        // 1. Start BullMQ Worker (Internal processing)
        await initIngestionWorker();
        console.log('[App] Ingestion Worker initialized.');

        // 2. Start Webhook Server (External trigger from Directus)
        startWebhookServer(3000);
        console.log('[App] Webhook Server started.');
    } catch (error) {
        console.error('[App] Failed to initialize worker:', error);
        process.exit(1);
    }

    process.on('SIGINT', () => {
        console.log('[App] Shutting down elegantly...');
        process.exit(0);
    });
};

bootstrap();

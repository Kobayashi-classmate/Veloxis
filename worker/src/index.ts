import { initIngestionWorker } from './jobs/IngestionWorker';

const bootstrap = async () => {
    console.log('[App] Starting Veloxis Data Worker Node...');

    try {
        await initIngestionWorker();
        console.log('[App] Ingestion Worker initialized.');
    } catch (error) {
        console.error('[App] Failed to initialize worker:', error);
        process.exit(1);
    }

    // Keep the process alive
    process.on('SIGINT', () => {
        console.log('[App] Shutting down elegantly...');
        process.exit(0);
    });
};

bootstrap();

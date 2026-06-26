import { createApp } from './app.js';
import { startDeliveryWorker } from './queue/deliveryProcessor.js';

const port = Number(process.env.PORT ?? process.env.FLIP_API_PORT ?? 8788);
const worker = startDeliveryWorker();

const app = await createApp();
const server = app.listen(port, () => {
    console.log(`Flip multiverse API listening on :${port}`);
});

process.on('SIGTERM', () => {
    clearInterval(worker);
    server.close();
});

export { app };

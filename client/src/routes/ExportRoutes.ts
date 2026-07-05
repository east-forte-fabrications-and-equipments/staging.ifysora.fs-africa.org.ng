import express from 'express';
import { ExportController } from '../controllers/exportController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const controller = new ExportController();

// Export endpoints
router.get('/:id', authenticate, controller.exportMeasurement.bind(controller));
router.get('/download/:sessionId/:filename', controller.downloadExport.bind(controller));

// WhatsApp sharing
router.post('/:id/whatsapp', authenticate, controller.whatsappShare.bind(controller));

// Cloud backup
router.post('/:id/backup', authenticate, controller.backupMeasurement.bind(controller));
router.get('/cloud-providers', authenticate, controller.getCloudProviders.bind(controller));
router.post('/cloud-providers/connect', authenticate, controller.connectCloudProvider.bind(controller));

export default router;

import express from 'express';
import { MeasurementController } from '../controllers/measurementController.js';
import { authenticate } from '../middleware/auth.js';
import { validateMeasurement } from '../middleware/validation.js';

const router = express.Router();
const controller = new MeasurementController();

// All measurement routes require authentication
router.use(authenticate);

// Analysis
router.post('/analyze', validateMeasurement, controller.analyze.bind(controller));

// CRUD operations
router.get('/', controller.getMeasurements.bind(controller));
router.get('/:id', controller.getMeasurement.bind(controller));
router.delete('/:id', controller.deleteMeasurement.bind(controller));

// Sharing
router.post('/:id/share', controller.shareMeasurement.bind(controller));
router.delete('/:id/share/:shareId', controller.revokeShare.bind(controller));

// Export (handled by export routes)
// router.get('/:id/export', ...) // moved to exportRoutes.ts

export default router;

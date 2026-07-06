import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Reusable validators
export const validators = {
  // ID validator
  id: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  // Pagination validators
  pagination: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a positive integer')
      .toInt(),
  ],
  
  // Date validators
  dateRange: [
    query('from')
      .optional()
      .isISO8601()
      .withMessage('Invalid from date format')
      .toDate(),
    query('to')
      .optional()
      .isISO8601()
      .withMessage('Invalid to date format')
      .toDate(),
  ],
};

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Measurement specific validators
export const measurementValidators = {
  range: (field: string, min: number, max: number) => 
    body(field)
      .isFloat({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} cm`),
  
  positive: (field: string) =>
    body(field)
      .isFloat({ min: 0 })
      .withMessage(`${field} must be a positive number`),
  
  optionalString: (field: string, maxLength: number = 255) =>
    body(field)
      .optional()
      .isString()
      .isLength({ max: maxLength })
      .withMessage(`${field} must be a string of at most ${maxLength} characters`),
};

// Organization validators
export const organizationValidators = {
  name: body('name')
    .notEmpty()
    .withMessage('Organization name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  type: body('type')
    .isIn(['TAILOR', 'DESIGNER', 'BOUTIQUE', 'BRAND', 'OTHER'])
    .withMessage('Invalid organization type'),
  
  registrationNumber: body('registrationNumber')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Registration number must be between 2 and 50 characters'),
};

// User validators
export const userValidators = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  
  phone: body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Password must contain at least one uppercase, lowercase, number, and special character'),
  
  displayName: body('displayName')
    .notEmpty()
    .withMessage('Display name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters'),
};

// Sync validators
export const syncValidators = {
  provider: body('provider')
    .isIn(['google_drive', 'dropbox', 'onedrive'])
    .withMessage('Invalid cloud provider'),
  
  accessToken: body('accessToken')
    .notEmpty()
    .withMessage('Access token is required'),
};

// Export all validators
export default {
  validators,
  handleValidationErrors,
  measurementValidators,
  organizationValidators,
  userValidators,
  syncValidators,
};

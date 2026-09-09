import express from 'express';
import { bankController } from './bank.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', bankController.getTransactions);
router.post('/', bankController.createTransaction);
router.put('/:id', bankController.updateTransaction);
router.delete('/:id', bankController.deleteTransaction);

export default router;
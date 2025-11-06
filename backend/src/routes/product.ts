import { Router } from 'express';
import { getAllProducts, purchaseProduct } from '../controllers/productController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All product routes require authentication
router.use(authenticateToken);

router.get('/', getAllProducts);
router.post('/purchase/:id', purchaseProduct);

export default router;

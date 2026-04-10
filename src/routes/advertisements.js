import express from 'express';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get active ads
router.get('/active', async (req, res, next) => {
  try {
    const { neighborhood } = req.query;

    let whereClause = 'WHERE is_active = TRUE AND (start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP)';
    const params = [];
    let paramIndex = 1;

    if (neighborhood) {
      whereClause += ` AND $${paramIndex} = ANY(target_neighborhoods)`;
      params.push(neighborhood);
      paramIndex++;
    }

    const result = await query(
      `SELECT a.*, b.name as business_name, b.logo_url
       FROM advertisements a
       JOIN businesses b ON a.business_id = b.id
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Create ad (Premium feature for businesses)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { business_id, title, description, image_url, cta_text, cta_url, 
            target_neighborhoods, start_date, end_date, budget } = req.body;
    
    // In a real app, we'd verify the user owns the business_id
    const user = await query('SELECT 1 FROM businesses WHERE id = $1 AND owner_id = $2', [business_id, req.user.userId]);
    if (user.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'You do not own this business' },
      });
    }

    const result = await query(
      `INSERT INTO advertisements (business_id, title, description, image_url, cta_text, cta_url, 
       target_neighborhoods, start_date, end_date, budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [business_id, title, description, image_url, cta_text, cta_url, target_neighborhoods, start_date, end_date, budget]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;

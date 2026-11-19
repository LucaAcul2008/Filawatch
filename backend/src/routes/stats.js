import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const totalFilaments = db.prepare('SELECT COUNT(*) AS c FROM filaments WHERE is_archived=0').get().c;
  const totalGramsLeft = db.prepare('SELECT COALESCE(SUM(current_weight_g),0) AS s FROM filaments WHERE is_archived=0').get().s;
  const totalPrints = db.prepare('SELECT COUNT(*) AS c FROM prints').get().c;
  const totalGramsUsed = db.prepare('SELECT COALESCE(SUM(weight_used_g),0) AS s FROM prints').get().s;
  const totalMinutes = db.prepare('SELECT COALESCE(SUM(duration_minutes),0) AS s FROM prints').get().s;
  const totalSpent = db.prepare('SELECT COALESCE(SUM(price),0) AS s FROM filaments').get().s;
  const costMaterial = db.prepare('SELECT COALESCE(SUM(cost_material),0) AS s FROM prints').get().s;
  const costPower = db.prepare('SELECT COALESCE(SUM(cost_power),0) AS s FROM prints').get().s;

  const lowStock = db.prepare(`
    SELECT id, brand, color_name, color_hex, material, current_weight_g
    FROM filaments WHERE is_archived=0 AND current_weight_g < 150
    ORDER BY current_weight_g ASC
  `).all();

  const byMaterial = db.prepare(`
    SELECT material, COUNT(*) AS count, SUM(current_weight_g) AS grams
    FROM filaments WHERE is_archived=0
    GROUP BY material
  `).all();

  const recentPrints = db.prepare(`
    SELECT p.*, f.color_hex AS filament_hex, f.brand AS filament_brand, f.color_name AS filament_color,
           u.display_name AS user_display_name, u.avatar_color AS user_avatar_color
    FROM prints p
    LEFT JOIN filaments f ON f.id = p.filament_id
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.started_at DESC LIMIT 5
  `).all();

  const byUser = db.prepare(`
    SELECT u.display_name AS name, u.avatar_color AS color,
           COUNT(p.id) AS prints, COALESCE(SUM(p.weight_used_g),0) AS grams,
           COALESCE(SUM(p.cost_material + p.cost_power),0) AS total_cost
    FROM users u LEFT JOIN prints p ON p.user_id = u.id
    GROUP BY u.id ORDER BY grams DESC
  `).all();

  res.json({
    totalFilaments,
    totalGramsLeft,
    totalPrints,
    totalGramsUsed,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    totalSpent,
    costMaterial: Math.round(costMaterial * 100) / 100,
    costPower: Math.round(costPower * 100) / 100,
    lowStock,
    byMaterial,
    recentPrints,
    byUser,
  });
});

export default router;

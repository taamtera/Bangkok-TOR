import { Router } from 'express';
import { getDashboardStats } from '../repositories/dashboard.repository.mjs';

export const dashboardRouter = Router();

// Public aggregate stats for the dashboard. Figures are averages/totals across
// all records — no per-company data is exposed.
dashboardRouter.get('/stats', async (request, response, next) => {
  try {
    response.json(await getDashboardStats());
  } catch (error) {
    next(error);
  }
});

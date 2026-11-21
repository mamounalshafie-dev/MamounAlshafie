import { dashboardRouter } from './dashboard.js';
import { projectsRouter } from './projects.js';
import { salesRouter } from './sales.js';
import { purchasesRouter } from './purchases.js';
import { inventoryRouter } from './inventory.js';
import { accountingRouter } from './accounting.js';
import { hrRouter } from './hr.js';
import { adminRouter } from './admin.js';

export function registerRoutes(app) {
  app.use('/api', dashboardRouter);
  app.use('/api', projectsRouter);
  app.use('/api', salesRouter);
  app.use('/api', purchasesRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', accountingRouter);
  app.use('/api', hrRouter);
  app.use('/api', adminRouter);
}

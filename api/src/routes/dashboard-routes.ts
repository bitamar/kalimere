import { FastifyInstance } from 'fastify';
import { getDashboardStats, getUpcomingVisits } from '../services/dashboard-service.js';

export async function dashboardRoutes(app: FastifyInstance) {
    app.get('/stats', async (request) => {
        const userId = request.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return getDashboardStats(userId);
    });

    app.get('/upcoming', async (request) => {
        const userId = request.user?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return getUpcomingVisits(userId);
    });
}

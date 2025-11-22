import { countActiveCustomersByUserId } from '../repositories/customer-repository.js';
import { countActivePetsByUserId } from '../repositories/pet-repository.js';
import {
  countVisitsByUserId,
  findUpcomingVisitsByUserId,
} from '../repositories/visit-repository.js';

export async function getDashboardStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [activeCustomers, activePets, visitsData] = await Promise.all([
    countActiveCustomersByUserId(userId),
    countActivePetsByUserId(userId),
    countVisitsByUserId(userId, { start: startOfMonth, end: endOfMonth }),
  ]);

  const { count: visitsThisMonth, revenue: totalRevenue } = visitsData;

  return {
    activeCustomers,
    activePets,
    visitsThisMonth,
    totalRevenue,
  };
}

export async function getUpcomingVisits(userId: string) {
  const visits = await findUpcomingVisitsByUserId(userId, 5);
  return visits.map((visit) => ({
    id: visit.id,
    petName: visit.pet?.name ?? 'Unknown Pet',
    customerName: visit.customer?.name ?? 'Unknown Customer',
    serviceType: visit.title ?? 'Visit',
    date: visit.scheduledStartAt.toISOString(),
    status: visit.status,
  }));
}

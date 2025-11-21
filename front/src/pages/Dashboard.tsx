import { Badge, Card, Container, Divider, Group, rem, SimpleGrid, Title, Text, Loader, Center } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '../components/PageTitle';
import { fetchJson } from '../lib/http';
import { queryKeys } from '../lib/queryKeys';

interface DashboardStats {
  activeCustomers: number;
  activePets: number;
  visitsThisMonth: number;
}

interface UpcomingVisit {
  id: string;
  petName: string;
  customerName: string;
  serviceType: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: () => fetchJson<DashboardStats>('/api/dashboard/stats'),
  });

  const { data: upcomingVisits, isLoading: isLoadingVisits } = useQuery({
    queryKey: queryKeys.upcomingVisits(),
    queryFn: () => fetchJson<UpcomingVisit[]>('/api/dashboard/upcoming'),
  });

  if (isLoadingStats || isLoadingVisits) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Container size="lg" mt="xl">
      <Group justify="space-between" mb="md">
        <PageTitle order={3}>דאשבורד</PageTitle>
        <Group>
          <Badge variant="dot" size="lg">
            היום
          </Badge>
          <Badge variant="light" size="lg" color="teal">
            פעיל
          </Badge>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <StatCard title="ביקורים החודש" value={stats?.visitsThisMonth.toString() ?? '0'} />
        <StatCard title="לקוחות פעילים" value={stats?.activeCustomers.toString() ?? '0'} />
        <StatCard title="חיות מחמד פעילות" value={stats?.activePets.toString() ?? '0'} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mt="md">
        <Card withBorder radius="lg" p="lg">
          <Title order={5} mb="xs">
            ביקורים קרובים
          </Title>
          <Divider mb="sm" />
          {upcomingVisits && upcomingVisits.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {upcomingVisits.map((visit) => (
                <li key={visit.id} style={{ paddingBlock: rem(6) }}>
                  <Group justify="space-between">
                    <Text size="sm">
                      🗓️ {new Date(visit.date).toLocaleDateString('he-IL')} {new Date(visit.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text size="sm" fw={500}>
                      {visit.petName} - {visit.serviceType}
                    </Text>
                  </Group>
                </li>
              ))}
            </ul>
          ) : (
            <Text c="dimmed" size="sm">אין ביקורים קרובים</Text>
          )}
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Title order={5} mb="xs">
            סיכום היום
          </Title>
          <Divider mb="sm" />
          <p style={{ margin: 0, opacity: 0.8 }}>
            אין נתונים לסיכום היום כרגע.
          </p>
        </Card>
      </SimpleGrid>
    </Container>
  );
}

function StatCard({
  title,
  value,
  delta,
  negative,
}: {
  title: string;
  value: string;
  delta?: string;
  negative?: boolean;
}) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="xs">
        <Title order={6} style={{ opacity: 0.8 }}>
          {title}
        </Title>
        {delta && (
          <Badge color={negative ? 'red' : 'teal'} variant="light">
            {delta}
          </Badge>
        )}
      </Group>
      <Title order={2}>{value}</Title>
    </Card>
  );
}

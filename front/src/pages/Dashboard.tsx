import {
  Card,
  Container,
  Divider,
  Group,
  rem,
  SimpleGrid,
  Title,
  Text,
  Loader,
  Center,
  ThemeIcon,
  ActionIcon,
  Button,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PageTitle } from '../components/PageTitle';
import { fetchJson } from '../lib/http';
import { IconCalendarStats, IconPaw, IconUsers, IconSearch } from '@tabler/icons-react';
import type { IconProps } from '@tabler/icons-react';
import { queryKeys } from '../lib/queryKeys';
import type { ComponentType } from 'react';

interface DashboardStats {
  activeCustomers: number;
  activePets: number;
  visitsThisMonth: number;
  totalRevenue: number;
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
  const navigate = useNavigate();
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <Container size="lg" mt="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <PageTitle order={2}>ברוך הבא 👋</PageTitle>
          <Text c="dimmed">הנה מה שקורה במרפאה היום</Text>
        </div>
        <Button
          leftSection={<IconCalendarStats size={20} />}
          variant="light"
          onClick={() => navigate('/visits')}
        >
          יומן ביקורים
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <StatCard
          title="ביקורים החודש"
          value={stats?.visitsThisMonth.toString() ?? '0'}
          {...(stats?.totalRevenue ? { secondaryValue: formatCurrency(stats.totalRevenue) } : {})}
          icon={IconCalendarStats}
          color="blue"
        />
        <StatCard
          title="לקוחות פעילים"
          value={stats?.activeCustomers.toString() ?? '0'}
          icon={IconUsers}
          color="cyan"
          action={() => navigate('/customers')}
        />
        <StatCard
          title="חיות מחמד פעילות"
          value={stats?.activePets.toString() ?? '0'}
          icon={IconPaw}
          color="teal"
          action={() => navigate('/customers')} // Pets are usually accessed via customers, or we could add a pets route
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mt="md">
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="xs">
            <Title order={5}>ביקורים קרובים</Title>
            <Button variant="subtle" size="xs" onClick={() => navigate('/visits')}>
              לכל הביקורים
            </Button>
          </Group>
          <Divider mb="sm" />
          {upcomingVisits && upcomingVisits.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {upcomingVisits.map((visit) => (
                <li key={visit.id} style={{ paddingBlock: rem(6) }}>
                  <Link
                    to={`/visits/${visit.id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs">
                        <ThemeIcon color="blue" variant="light" size="md">
                          <IconCalendarStats size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={500}>
                            {visit.petName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {visit.serviceType}
                          </Text>
                        </div>
                      </Group>
                      <div style={{ textAlign: 'left' }}>
                        <Text size="sm" fw={500}>
                          {new Date(visit.date).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(visit.date).toLocaleDateString('he-IL')}
                        </Text>
                      </div>
                    </Group>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Text c="dimmed" size="sm">
              אין ביקורים קרובים
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Container>
  );
}

function StatCard({
  title,
  value,
  secondaryValue,
  icon: Icon,
  color,
  action,
}: {
  title: string;
  value: string;
  secondaryValue?: string;
  icon: ComponentType<IconProps>;
  color: string;
  action?: () => void;
}) {
  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} size="xs">
            {title}
          </Text>
          <Text fw={700} size="xl" mt="xs">
            {value}
          </Text>
          {secondaryValue && (
            <Text size="sm" c="dimmed" mt={4}>
              {secondaryValue}
            </Text>
          )}
        </div>
        <Group align="flex-start">
          {action && (
            <ActionIcon variant="light" color="gray" onClick={action} title="חיפוש">
              <IconSearch size={18} />
            </ActionIcon>
          )}
          <ThemeIcon color={color} variant="light" size="xl" radius="md">
            <Icon style={{ width: rem(28), height: rem(28) }} stroke={1.5} />
          </ThemeIcon>
        </Group>
      </Group>
    </Card>
  );
}

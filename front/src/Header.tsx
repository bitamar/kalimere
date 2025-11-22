import { Avatar, Burger, Button, Divider, Group, Menu, Title } from '@mantine/core';
import { IconChevronDown, IconLogout, IconPawFilled, IconSettings } from '@tabler/icons-react';
import { useAuth } from './auth/AuthContext';
import { Link } from 'react-router-dom';
import { useGlobalLoading } from './components/GlobalLoadingIndicator';
import classes from './Header.module.css';

export default function Header({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { logout, user } = useAuth();
  const isLoading = useGlobalLoading();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        <Burger
          opened={opened}
          onClick={() => setOpened((open: boolean) => !open)}
          hiddenFrom="sm"
          size="sm"
        />

        <Title order={6} className={classes['branding'] ?? ''}>
          <span
            role="status"
            aria-live="polite"
            aria-label={isLoading ? 'Loading data' : 'Ready'}
            className={classes['brandPaw'] ?? ''}
          >
            <IconPawFilled
              aria-hidden
              size={22}
              className={classes['brandPawIcon'] ?? ''}
              data-loading={isLoading ? 'true' : undefined}
            />
          </span>
        </Title>
      </Group>

      <Group>
        <Menu shadow="md" width={220}>
          <Menu.Target>
            <Button
              variant="subtle"
              leftSection={<Avatar size={20} radius="xl" src={user?.avatarUrl ?? null} />}
              rightSection={<IconChevronDown size={16} />}
            >
              {user?.name || user?.email || ''}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item component={Link} to="/settings" leftSection={<IconSettings size={16} />}>
              הגדרות
            </Menu.Item>

            <Divider my="xs" />
            <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={logout}>
              התנתקות
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}

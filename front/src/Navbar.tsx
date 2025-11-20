import { AppShell, Divider, NavLink, ScrollArea } from '@mantine/core';
import { IconHome2, IconFirstAidKit, IconSettings, IconUsers } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <AppShell.Navbar p="md">
      <ScrollArea type="auto" style={{ height: '100%' }}>
        <NavLink
          component={Link}
          to="/"
          label="דאשבורד"
          leftSection={<IconHome2 size={18} />}
          active={pathname === '/'}
        />
        <NavLink
          component={Link}
          to="/treatments"
          label="סוגי טיפולים"
          leftSection={<IconFirstAidKit size={18} />}
          active={pathname.startsWith('/treatments')}
        />

        <NavLink
          component={Link}
          to="/customers"
          label="לקוחות"
          leftSection={<IconUsers size={18} />}
          active={pathname.startsWith('/customers')}
        />

        <NavLink
          component={Link}
          to="/settings"
          label="הגדרות"
          leftSection={<IconSettings size={18} />}
          active={pathname.startsWith('/settings')}
        />

        <Divider my="md" />
      </ScrollArea>
    </AppShell.Navbar>
  );
}

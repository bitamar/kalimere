import { AppShell, Divider, NavLink, rem, ScrollArea, Title } from '@mantine/core';
import {
  IconHome2,
  IconChevronRight,
  IconChevronLeft,
  IconFirstAidKit,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { DatePicker } from '@mantine/dates';
import { Link, useLocation } from 'react-router-dom';
import { formatHebrewMonthLabel, formatHebrewWeekdayLabel } from './lib/hebrewDateFormatting';

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

        <Title order={6} mb="xs">
          תאריכים
        </Title>
        <DatePicker
          allowDeselect
          weekendDays={[5, 6]}
          locale="he"
          monthLabelFormat={formatHebrewMonthLabel}
          weekdayFormat={formatHebrewWeekdayLabel}
          previousIcon={<IconChevronRight size={16} />}
          nextIcon={<IconChevronLeft size={16} />}
          styles={{ day: { marginInline: rem(5) } }}
        />
      </ScrollArea>
    </AppShell.Navbar>
  );
}

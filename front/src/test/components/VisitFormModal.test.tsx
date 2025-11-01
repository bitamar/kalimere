import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitFormModal } from '../../components/VisitFormModal';
import { renderWithProviders } from '../utils/renderWithProviders';

describe('VisitFormModal', () => {
  it('submits trimmed values with ISO timestamp', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const scheduledStartAt = new Date('2024-05-01T09:00:00.000Z');

    renderWithProviders(
      <VisitFormModal
        opened
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initialValues={{
          scheduledStartAt,
          title: '  Follow up ',
          description: '  Needs extra care ',
        }}
      />
    );

    const submitButton = await screen.findByRole('button', { name: 'תזמן' });
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith({
      scheduledStartAt: scheduledStartAt.toISOString(),
      title: 'Follow up',
      description: 'Needs extra care',
    });
  });

  it('prevents submission when start time is missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(<VisitFormModal opened onClose={vi.fn()} onSubmit={onSubmit} />);

    const submitButton = await screen.findByRole('button', { name: 'תזמן' });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

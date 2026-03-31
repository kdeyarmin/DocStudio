import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewChecklistPanel, buildChecklistGroups } from './ReviewChecklistPanel';
import type { ChecklistResult, ChecklistTemplate } from '../../../types/doc-studio-review';

const useReviewChecklistMock = vi.fn();
const mutateAsyncMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('../../../hooks/useDocStudioReview', () => ({
  useReviewChecklist: (...args: unknown[]) => useReviewChecklistMock(...args),
  useUpsertChecklistResult: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('../../../lib/toast', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

const templates: ChecklistTemplate[] = [
  {
    id: 'content-required',
    category: 'content',
    item_key: 'content_required',
    label: 'Content completeness',
    description: 'All required content is present.',
    sort_order: 2,
    is_required: true,
    is_active: true,
    created_at: '2026-03-29T00:00:00Z',
  },
  {
    id: 'content-optional',
    category: 'content',
    item_key: 'content_optional',
    label: 'Optional content',
    description: null,
    sort_order: 1,
    is_required: false,
    is_active: true,
    created_at: '2026-03-29T00:00:00Z',
  },
  {
    id: 'visual-required',
    category: 'visual',
    item_key: 'visual_required',
    label: 'Visual quality',
    description: 'Key screenshots are present.',
    sort_order: 1,
    is_required: true,
    is_active: true,
    created_at: '2026-03-29T00:00:00Z',
  },
];

const results: ChecklistResult[] = [
  {
    id: 'result-1',
    draft_id: 'draft-1',
    organization_id: 'org-1',
    checklist_item_id: 'content-required',
    reviewer_id: 'reviewer-1',
    passed: true,
    notes: 'Looks good',
    checked_at: '2026-03-29T00:00:00Z',
    created_at: '2026-03-29T00:00:00Z',
    updated_at: '2026-03-29T00:00:00Z',
  },
];

describe('buildChecklistGroups', () => {
  it('sorts categories and only counts required passes', () => {
    expect(buildChecklistGroups(templates, results)).toEqual([
      {
        category: 'content',
        items: [
          {
            template: templates[1],
            result: null,
          },
          {
            template: templates[0],
            result: results[0],
          },
        ],
        passCount: 1,
        totalRequired: 1,
      },
      {
        category: 'visual',
        items: [
          {
            template: templates[2],
            result: null,
          },
        ],
        passCount: 0,
        totalRequired: 1,
      },
    ]);
  });
});

describe('ReviewChecklistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders checklist groups instead of the empty state when data exists', () => {
    useReviewChecklistMock.mockReturnValue({
      data: { templates, results },
      isLoading: false,
    });

    render(<ReviewChecklistPanel draftId="draft-1" organizationId="org-1" />);

    expect(screen.getByText('Review Checklist')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Visual')).toBeInTheDocument();
    expect(screen.getByText('Content completeness')).toBeInTheDocument();
    expect(screen.queryByText('No checklist items configured')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2 required items passed')).toBeInTheDocument();
    expect(screen.getByText('Looks good')).toBeInTheDocument();
  });

  it('shows the empty state when there are no templates', () => {
    useReviewChecklistMock.mockReturnValue({
      data: { templates: [], results: [] },
      isLoading: false,
    });

    render(<ReviewChecklistPanel draftId="draft-1" organizationId="org-1" />);

    expect(screen.getByText('No checklist items configured')).toBeInTheDocument();
  });

  it('toggles an unchecked item to passed using the mutation', async () => {
    useReviewChecklistMock.mockReturnValue({
      data: { templates, results: [] },
      isLoading: false,
    });
    mutateAsyncMock.mockResolvedValue({ success: true });

    render(<ReviewChecklistPanel draftId="draft-1" organizationId="org-1" />);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button')[0]);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      draft_id: 'draft-1',
      organization_id: 'org-1',
      checklist_item_id: 'content-optional',
      passed: true,
    });
  });

  it('shows a toast when checklist mutation fails', async () => {
    useReviewChecklistMock.mockReturnValue({
      data: { templates, results: [] },
      isLoading: false,
    });
    mutateAsyncMock.mockRejectedValue(new Error('Update failed'));

    render(<ReviewChecklistPanel draftId="draft-1" organizationId="org-1" />);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button')[0]);

    expect(showToastMock).toHaveBeenCalledWith('Update failed', 'error');
  });
});

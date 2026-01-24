'use client';

import React, { useState, useEffect } from 'react';
import { Button, LoadingSpinner, Card } from './ui.tsx';
import { apiClient, ScheduledEmail } from '@/api.ts';
import { formatDistanceToNow } from 'date-fns';

interface ScheduledEmailsTableProps {
  refresh: number;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({ refresh }) => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getScheduledEmails(page, 20);
      setEmails(response.emails);
      setTotal(response.pagination.total);
      setPages(response.pagination.pages);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [page, refresh]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (emails.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No scheduled emails yet</p>
          <p className="text-gray-400">Click "Compose New Email" to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">To</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">From</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Scheduled Time
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{email.recipientEmail}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{email.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {email.sender.name} ({email.sender.email})
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(email.scheduledTime).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-blue-800">
                      {email.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {page} of {pages} (Total: {total})
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

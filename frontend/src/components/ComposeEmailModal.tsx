'use client';

import React, { useState } from 'react';
import { Button, Input, Textarea, Modal } from './ui.tsx';
import { apiClient } from '@/api.ts';
import Papa from 'papaparse';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayMs, setDelayMs] = useState('1000');
  const [hourlyLimit, setHourlyLimit] = useState('200');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const emails = results.data
          .map((row: any) => row.email || row.Email || Object.values(row)[0])
          .filter((email: string) => email && typeof email === 'string' && email.includes('@'));

        setRecipients(emails as string[]);
        setRecipientCount(emails.length);
      },
      error: (error) => {
        setError(`CSV parse error: ${error.message}`);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!subject || !body || recipients.length === 0 || !startTime || !senderEmail) {
        throw new Error('Please fill all required fields');
      }

      await apiClient.scheduleEmails({
        subject,
        body,
        recipients,
        startTime: new Date(startTime),
        delayMs: parseInt(delayMs),
        hourlyLimit: parseInt(hourlyLimit),
        senderEmail,
        senderName,
      });

      setSubject('');
      setBody('');
      setRecipients([]);
      setStartTime('');
      setDelayMs('1000');
      setHourlyLimit('200');
      setSenderEmail('');
      setSenderName('');
      setRecipientCount(0);

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">From Email</label>
            <Input
              type="email"
              value={senderEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSenderEmail(e.target.value)}
              placeholder="sender@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">From Name</label>
            <Input
              value={senderName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSenderName(e.target.value)}
              placeholder="Sender Name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Subject</label>
          <Input
            value={subject}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
            placeholder="Email subject"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email Body (HTML)</label>
          <Textarea
            value={body}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
            placeholder="<p>Your email content here...</p>"
            rows={6}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Upload Recipients (CSV)</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="block w-full text-sm file:rounded file:border file:border-gray-300 file:bg-gray-50 file:px-4 file:py-2 file:text-gray-700"
          />
          {recipientCount > 0 && (
            <p className="mt-2 text-sm text-green-600">{recipientCount} recipients detected</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Delay Between (ms)</label>
            <Input
              type="number"
              value={delayMs}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelayMs(e.target.value)}
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hourly Limit</label>
            <Input
              type="number"
              value={hourlyLimit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHourlyLimit(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Scheduling...' : 'Schedule Emails'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

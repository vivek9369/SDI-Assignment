'use client';

import React, { useState, useEffect } from 'react';
import { AuthPage } from '@/components/AuthPage.tsx';
import { Header } from '@/components/Header.tsx';
import { Button } from '@/components/ui.tsx';
import { ComposeEmailModal } from '@/components/ComposeEmailModal.tsx';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable.tsx';
import { SentEmailsTable } from '@/components/SentEmailsTable.tsx';
import { User, apiClient } from '@/api.ts';
import Cookie from 'js-cookie';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initUser = async () => {
      try {
        const userId = Cookie.get('user_id');
        if (userId) {
          const response = await apiClient.getProfile();
          setUser(response.user);
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <svg
            className="h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLoginSuccess={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <Header
          user={user}
          onLogout={() => setUser(null)}
        />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsComposeOpen(true)}
            >
              + Compose New Email
            </Button>
          </div>

          <div className="mb-6 border-b border-gray-200">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'scheduled'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Scheduled Emails
              </button>
              <button
                onClick={() => setActiveTab('sent')}
                className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'sent'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Sent Emails
              </button>
            </nav>
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshTrigger(t => t + 1)}
            >
              ↻ Refresh
            </Button>
          </div>

          {activeTab === 'scheduled' && (
            <ScheduledEmailsTable refresh={refreshTrigger} />
          )}

          {activeTab === 'sent' && (
            <SentEmailsTable refresh={refreshTrigger} />
          )}
        </main>

        <ComposeEmailModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          onSuccess={() => setRefreshTrigger(t => t + 1)}
        />
      </div>
    );
}
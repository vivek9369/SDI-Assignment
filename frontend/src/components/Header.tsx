'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card } from './ui.tsx';
import { User } from '@/api.ts';
import Cookie from 'js-cookie';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    Cookie.remove('auth_token');
    Cookie.remove('user_id');
    onLogout();
  };

  if (!user) return null;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ReachInbox</h1>
          <p className="text-sm text-gray-500">Email Scheduler</p>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="relative"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-full border-2 border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {showMenu && (
            <div className="absolute top-14 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                className="w-full"
              >
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

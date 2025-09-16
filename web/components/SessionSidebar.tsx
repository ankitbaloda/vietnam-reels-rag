'use client';

import { useState } from 'react';
import { Session, StepId } from '../types';
import { formatDate } from '../utils/dateUtils';
import { createNewSession } from '../utils/localStorage';

interface SessionSidebarProps {
  sessions: Session[];
  currentSession: Session | null;
  onSessionSelect: (session: Session) => void;
  onSessionCreate: () => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionDuplicate: (session: Session) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function SessionSidebar({
  sessions,
  currentSession,
  onSessionSelect,
  onSessionCreate,
  onSessionRename,
  onSessionDelete,
  onSessionDuplicate,
  collapsed = false,
  onToggleCollapse
}: SessionSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleRename = (session: Session) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const handleRenameSubmit = (sessionId: string) => {
    if (editingName.trim()) {
      onSessionRename(sessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleRenameCancel = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={onSessionCreate}
          className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          + New Session
        </button>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="ml-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group relative border-b border-gray-100 dark:border-gray-700 transition-colors ${
              currentSession?.id === session.id 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="p-4">
              {editingSessionId === session.id ? (
                <div className="mb-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(session.id);
                      if (e.key === 'Escape') handleRenameCancel();
                    }}
                    onBlur={() => handleRenameSubmit(session.id)}
                    className="w-full text-sm font-medium border border-blue-300 dark:border-blue-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => onSessionSelect(session)}
                  className="cursor-pointer mb-2"
                >
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-relaxed">
                    {session.name}
                  </h3>
                </div>
              )}
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Created {formatDate(session.createdAt)}
              </div>
              
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {session.currentStep}
                </span>
              </div>

              {/* Action buttons */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                  onClick={() => handleRename(session)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Rename
                </button>
                <button
                  onClick={() => onSessionDuplicate(session)}
                  className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 px-2 py-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => onSessionDelete(session.id)}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center bg-gray-50 dark:bg-gray-800/50">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
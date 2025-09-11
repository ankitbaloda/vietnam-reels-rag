'use client';

import { useState } from 'react';
import { Session, StepId } from '../types';
import { createNewSession } from '../utils/localStorage';

interface SessionSidebarProps {
  sessions: Session[];
  currentSession: Session | null;
  onSessionSelect: (session: Session) => void;
  onSessionCreate: () => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionDuplicate: (session: Session) => void;
}

export default function SessionSidebar({
  sessions,
  currentSession,
  onSessionSelect,
  onSessionCreate,
  onSessionRename,
  onSessionDelete,
  onSessionDuplicate
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
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onSessionCreate}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + New Session
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group relative border-b border-gray-100 ${
              currentSession?.id === session.id ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="p-3">
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
                    className="w-full text-sm font-medium border border-blue-300 rounded px-2 py-1"
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  onClick={() => onSessionSelect(session)}
                  className="cursor-pointer mb-2"
                >
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {session.name}
                  </h3>
                </div>
              )}
              
              <div className="text-xs text-gray-500 mb-2">
                Created {new Date(session.createdAt).toLocaleDateString()}
              </div>
              
              <div className="text-xs text-gray-400 mb-2">
                Current: {session.currentStep}
              </div>

              {/* Action buttons */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => handleRename(session)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Rename
                </button>
                <button
                  onClick={() => onSessionDuplicate(session)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => onSessionDelete(session.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-center">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Session, FinalEntry, StepId } from '../types';

interface DashboardProps {
  sessions: Session[];
  finals: Record<string, Record<StepId, FinalEntry[]>>;
  onClose: () => void;
  onOpenSession: (session: Session) => void;
}

export default function Dashboard({ sessions, finals, onClose, onOpenSession }: DashboardProps) {
  const [filterStage, setFilterStage] = useState<StepId | 'all'>('all');
  const [filterTrip, setFilterTrip] = useState<string>('all');
  const [filterPersona, setFilterPersona] = useState<string>('all');

  // Collect all finalized items across sessions
  const finalizedItems = sessions.flatMap(session => {
    const sessionFinals = finals[session.id] || {};
    return Object.entries(sessionFinals).flatMap(([step, entries]) =>
      entries.map(entry => ({
        ...entry,
        sessionId: session.id,
        sessionName: session.name,
        step: step as StepId,
        session
      }))
    );
  });

  // Apply filters
  const filteredItems = finalizedItems.filter(item => {
    if (filterStage !== 'all' && item.step !== filterStage) return false;
    // Add more filters as needed
    return true;
  });

  const stages = ['ideation', 'outline', 'edl', 'script', 'suno', 'handoff'] as StepId[];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredItems.length} finalized items across {sessions.length} sessions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value as StepId | 'all')}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Stages</option>
                {stages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trip</label>
              <select
                value={filterTrip}
                onChange={(e) => setFilterTrip(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Trips</option>
                <option value="vietnam">Vietnam</option>
                <option value="maldives">Maldives</option>
                <option value="ladakh">Ladakh</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Persona</label>
              <select
                value={filterPersona}
                onChange={(e) => setFilterPersona(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Personas</option>
                <option value="Vipin">Vipin</option>
                <option value="Divya">Divya</option>
                <option value="Both">Both</option>
                <option value="Freehand">Freehand</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={`${item.sessionId}-${item.step}-${item.id}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onOpenSession(item.session)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.step === 'ideation' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      item.step === 'outline' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      item.step === 'edl' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      item.step === 'script' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      item.step === 'suno' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {item.step}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(item.ts).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {item.sessionName}
                  </h3>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                    {item.content.substring(0, 150)}...
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{item.model || 'Unknown Model'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSession(item.session);
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    >
                      Open →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No finalized items yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Mark messages as "Final" to see them appear in your dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
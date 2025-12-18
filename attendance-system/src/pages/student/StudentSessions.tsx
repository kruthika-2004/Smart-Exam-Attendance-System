import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { localDB, Session } from '../../lib/database';
import { Calendar, Clock } from 'lucide-react';

export function StudentSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await localDB.select<Session>('sessions', {
        orderBy: { column: 'start_at', ascending: false }
      });
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge variant="success">Live</Badge>;
      case 'upcoming':
        return <Badge variant="info">Upcoming</Badge>;
      case 'ended':
        return <Badge variant="default">Ended</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Sessions</h2>
        <p className="text-sm text-gray-500 mt-1">View all attendance sessions</p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">No sessions available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{session.title}</CardTitle>
                  {getStatusBadge(session.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  {new Date(session.start_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} />
                  {new Date(session.start_at).toLocaleTimeString()} - {session.duration_minutes} min
                </div>
                {session.notes && (
                  <p className="text-sm text-gray-600 mt-2">{session.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

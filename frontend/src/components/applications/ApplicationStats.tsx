import React from 'react';
import { Layers, Bookmark, Send, CalendarCheck, Award, XCircle } from 'lucide-react';
import type { Application } from '../../api/applications';

interface ApplicationStatsProps {
  applications: Application[];
  activeStatusFilter: string;
  onSelectStatus: (status: string) => void;
}

export const ApplicationStats: React.FC<ApplicationStatsProps> = ({
  applications,
  activeStatusFilter,
  onSelectStatus,
}) => {
  const counts = {
    total: applications.length,
    saved: applications.filter((a) => a.status === 'saved').length,
    applied: applications.filter((a) => a.status === 'applied' || a.status === 'submitted' || a.status === 'pending').length,
    interviewing: applications.filter((a) => a.status === 'interviewing').length,
    offer: applications.filter((a) => a.status === 'offer').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const statCards = [
    {
      id: 'all',
      label: 'Total Applications',
      count: counts.total,
      icon: Layers,
      color: 'var(--primary)',
      bg: 'var(--primary-light)',
    },
    {
      id: 'saved',
      label: 'Saved Shortlist',
      count: counts.saved,
      icon: Bookmark,
      color: '#475569',
      bg: '#f1f5f9',
    },
    {
      id: 'applied',
      label: 'Applied',
      count: counts.applied,
      icon: Send,
      color: '#0284c7',
      bg: '#e0f2fe',
    },
    {
      id: 'interviewing',
      label: 'Interviewing',
      count: counts.interviewing,
      icon: CalendarCheck,
      color: '#d97706',
      bg: '#fef3c7',
    },
    {
      id: 'offer',
      label: 'Offers',
      count: counts.offer,
      icon: Award,
      color: '#16a34a',
      bg: '#dcfce7',
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: counts.rejected,
      icon: XCircle,
      color: '#dc2626',
      bg: '#fee2e2',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}
    >
      {statCards.map((stat) => {
        const Icon = stat.icon;
        const isSelected =
          (stat.id === 'all' && (!activeStatusFilter || activeStatusFilter === 'all')) ||
          activeStatusFilter === stat.id;

        return (
          <div
            key={stat.id}
            onClick={() => onSelectStatus(stat.id)}
            className="card"
            style={{
              padding: '14px 16px',
              cursor: 'pointer',
              border: isSelected ? `2px solid ${stat.color}` : '1px solid var(--border-color)',
              boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
              transition: 'all 0.15s ease-in-out',
              backgroundColor: isSelected ? '#ffffff' : '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {stat.label}
              </span>
              <div
                style={{
                  backgroundColor: stat.bg,
                  color: stat.color,
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={14} />
              </div>
            </div>

            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {stat.count}
            </div>
          </div>
        );
      })}
    </div>
  );
};

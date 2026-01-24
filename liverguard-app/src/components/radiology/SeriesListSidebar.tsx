// src/components/radiology/SeriesListSidebar.tsx
import React from 'react';
import './SeriesListSidebar.css';

interface Series {
  id: string;
  data: {
    ID: string;
    MainDicomTags: {
      Modality?: string;
      SeriesDescription?: string;
      SeriesNumber?: string;
      SeriesDate?: string;
    };
    Instances?: string[];
  };
}

interface SeriesListSidebarProps {
  seriesList: Series[];
  selectedSeriesId: string | null;
  onSeriesSelect: (seriesId: string) => void;
  isLoading?: boolean;
  headerAction?: React.ReactNode;
  orderNotes?: string[];
}

const SeriesListSidebar: React.FC<SeriesListSidebarProps> = ({
  seriesList,
  selectedSeriesId,
  onSeriesSelect,
  isLoading = false,
  headerAction,
  orderNotes,
}) => {
  const formatSeriesNumber = (seriesNumber?: string) => {
    return seriesNumber ? `Series ${seriesNumber}` : 'Series';
  };

  const formatDate = (date?: string) => {
    if (!date) return '';
    // DICOM date format: YYYYMMDD
    if (date.length === 8) {
      return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    }
    return date;
  };
  const normalizedNotes = (orderNotes || [])
    .filter((note) => typeof note === 'string' && note.trim().length > 0);

  return (
    <div className="series-list-sidebar">
      <div className="sidebar-header">
        <h2>Series 목록</h2>
        {headerAction}
      </div>

      <div className="series-list">
        {isLoading ? (
          <div className="loading-state">Loading...</div>
        ) : seriesList.filter((series) => series.data.MainDicomTags?.Modality === 'CT').length === 0 ? (
          <div className="empty-state">Series가 없습니다</div>
        ) : (
          seriesList
            .filter((series) => series.data.MainDicomTags?.Modality === 'CT')
            .map((series) => (
            <div
              key={series.id}
              className={`series-card ${selectedSeriesId === series.id ? 'selected' : ''}`}
              onClick={() => onSeriesSelect(series.id)}
            >
              <div className="series-card-header">
                <span className="series-number">
                  {formatSeriesNumber(series.data.MainDicomTags?.SeriesNumber)}
                </span>
              </div>
              <div className="series-card-body">
                <div className="series-description">
                  {series.data.MainDicomTags?.SeriesDescription || 'No Description'}
                </div>
                <div className="series-modality">
                  {series.data.MainDicomTags?.Modality || 'Unknown'}
                </div>
                <div className="series-date">
                  {formatDate(series.data.MainDicomTags?.SeriesDate)}
                </div>
                <div className="series-instances">
                  {series.data.Instances?.length || 0} images
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="queue-order-notes">
        <div className="queue-order-notes-header">오더 노트</div>
        <div className="queue-order-notes-body">
          {normalizedNotes.length > 0 ? (
            normalizedNotes.map((note, index) => (
              <div key={`note-${index}`} className="order-note-item">
                {note}
              </div>
            ))
          ) : (
            <div className="order-note-empty">오더 노트가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeriesListSidebar;

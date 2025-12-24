// src/components/radiology/StudyListSidebar.tsx
import React from 'react';
import './StudyListSidebar.css';

interface Study {
  id: string;
  bodyPart: string;
  studyNumber: string;
  modality: string;
  date: string;
}

interface StudyListSidebarProps {
  studies: Study[];
  selectedStudyId?: string;
  onStudySelect: (studyId: string) => void;
}

const StudyListSidebar: React.FC<StudyListSidebarProps> = ({
  studies,
  selectedStudyId,
  onStudySelect,
}) => {
  return (
    <div className="study-list-sidebar">
      <div className="sidebar-header">
        <h2>Study 목록</h2>
      </div>

      <div className="study-list">
        {studies.map((study) => (
          <div
            key={study.id}
            className={`study-card ${selectedStudyId === study.id ? 'selected' : ''}`}
            onClick={() => onStudySelect(study.id)}
          >
            <div className="study-card-header">
              <span className="body-part">{study.bodyPart}</span>
            </div>
            <div className="study-card-body">
              <div className="study-number">{study.studyNumber}</div>
              <div className="study-modality">{study.modality}</div>
              <div className="study-date">{study.date}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <h3>환자 정보</h3>
      </div>
    </div>
  );
};

export default StudyListSidebar;

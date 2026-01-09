/**
 * Feature Vector Tables Component
 */

import React from 'react';
import type { RadioFeature, ClinicalFeature, GenomicFeature } from '../../api/predictionApi';

// ============================================================
// Radio (CT) Feature Table
// ============================================================

interface RadioFeatureTableProps {
  features: RadioFeature[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const RadioFeatureTable: React.FC<RadioFeatureTableProps> = ({
  features, loading, selectedId, onSelect,
}) => {
  if (loading) return <TableSkeleton title="CT 특징 벡터" />;
  if (!features.length) return <EmptyTable title="CT 특징 벡터" icon="🩻" message="CT 영상에서 추출된 특징 벡터가 없습니다" />;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-700 flex items-center">
          <span className="mr-2">🩻</span>CT 특징 벡터 ({features.length}개)
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left">촬영일</th>
              <th className="px-3 py-2 text-left">설명</th>
              <th className="px-3 py-2 text-left">모델</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr 
                key={f.radio_vector_id}
                className={`border-t cursor-pointer hover:bg-blue-50 ${selectedId === f.radio_vector_id ? 'bg-blue-100' : ''}`}
                onClick={() => onSelect(f.radio_vector_id)}
              >
                <td className="px-3 py-2">
                  <input type="radio" checked={selectedId === f.radio_vector_id} onChange={() => onSelect(f.radio_vector_id)} />
                </td>
                <td className="px-3 py-2">{f.study_date || '-'}</td>
                <td className="px-3 py-2 text-xs">{f.study_description || '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{f.model_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// Clinical Feature Table
// ============================================================

interface ClinicalFeatureTableProps {
  features: ClinicalFeature[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ClinicalFeatureTable: React.FC<ClinicalFeatureTableProps> = ({
  features, loading, selectedId, onSelect,
}) => {
  if (loading) return <TableSkeleton title="임상 특징 벡터" />;
  if (!features.length) return <EmptyTable title="임상 특징 벡터" icon="🩺" message="등록된 임상 데이터가 없습니다" />;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-700 flex items-center">
          <span className="mr-2">🩺</span>임상 특징 벡터 ({features.length}개)
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left">검사일</th>
              <th className="px-3 py-2 text-left">나이</th>
              <th className="px-3 py-2 text-left">AFP</th>
              <th className="px-3 py-2 text-left">Albumin</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr 
                key={f.clinical_vector_id}
                className={`border-t cursor-pointer hover:bg-blue-50 ${selectedId === f.clinical_vector_id ? 'bg-blue-100' : ''}`}
                onClick={() => onSelect(f.clinical_vector_id)}
              >
                <td className="px-3 py-2">
                  <input type="radio" checked={selectedId === f.clinical_vector_id} onChange={() => onSelect(f.clinical_vector_id)} />
                </td>
                <td className="px-3 py-2">{f.lab_date}</td>
                <td className="px-3 py-2">{f.age ?? '-'}</td>
                <td className="px-3 py-2">{f.afp?.toFixed(1) ?? '-'}</td>
                <td className="px-3 py-2">{f.albumin?.toFixed(2) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// Genomic Feature Table
// ============================================================

interface GenomicFeatureTableProps {
  features: GenomicFeature[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export const GenomicFeatureTable: React.FC<GenomicFeatureTableProps> = ({
  features, loading, selectedId, onSelect,
}) => {
  if (loading) return <TableSkeleton title="유전체 특징 벡터" />;
  if (!features.length) return <EmptyTable title="유전체 특징 벡터" icon="🧬" message="등록된 유전체 데이터가 없습니다" />;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-700 flex items-center">
          <span className="mr-2">🧬</span>유전체 특징 벡터 ({features.length}개)
        </h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left">검사일</th>
              <th className="px-3 py-2 text-left">샘플 ID</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              className={`border-t cursor-pointer hover:bg-gray-50 ${selectedId === null ? 'bg-gray-100' : ''}`}
              onClick={() => onSelect(null)}
            >
              <td className="px-3 py-2"><input type="radio" checked={selectedId === null} onChange={() => onSelect(null)} /></td>
              <td colSpan={3} className="px-3 py-2 text-gray-500 italic">mRNA 사용 안 함 (Stage만 예측)</td>
            </tr>
            {features.map((f) => (
              <tr 
                key={f.genomic_id}
                className={`border-t cursor-pointer hover:bg-purple-50 ${selectedId === f.genomic_id ? 'bg-purple-100' : ''}`}
                onClick={() => onSelect(f.genomic_id)}
              >
                <td className="px-3 py-2">
                  <input type="radio" checked={selectedId === f.genomic_id} onChange={() => onSelect(f.genomic_id)} />
                </td>
                <td className="px-3 py-2">{f.sample_date}</td>
                <td className="px-3 py-2">{f.sample_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// Helper Components
// ============================================================

const TableSkeleton: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white rounded-lg shadow-sm border">
    <div className="px-4 py-3 border-b bg-gray-50"><h3 className="font-semibold text-gray-700">{title}</h3></div>
    <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
  </div>
);

const EmptyTable: React.FC<{ title: string; icon: string; message: string; optional?: boolean }> = ({ title, icon, message, optional }) => (
  <div className="bg-white rounded-lg shadow-sm border">
    <div className="px-4 py-3 border-b bg-gray-50">
      <h3 className="font-semibold text-gray-700 flex items-center">
        <span className="mr-2">{icon}</span>{title}
      </h3>
    </div>
    <div className="p-8 text-center text-gray-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  </div>
);
/**
 * Prediction Results Display Component
 * 병기/재발/생존 예측 결과 카드 (퍼센트 표시)
 */

import React from 'react';
import { type PredictionResult, getRiskLevelBgClass } from '../../api/predictionApi';

interface PredictionResultsProps {
  result: PredictionResult | null;
  loading: boolean;
  error?: string | null;
}

export const PredictionResults: React.FC<PredictionResultsProps> = ({
  result,
  loading,
  error,
}) => {
  if (loading) return <div>AI 분석 중...</div>;
  if (error) return <div>오류: message = {error}</div>;
  if (!result) return <div>비어 있음</div>;
  
  const { stage_prediction, relapse_prediction, survival_analysis, warnings } = result;
  
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">🔬 AI 분석 결과</h2>
        <span className="text-xs text-gray-500">
          {result.model_version} | {new Date(result.prediction_timestamp).toLocaleString('ko-KR')}
        </span>
      </div>
      
      {/* 날짜 불일치 경고 */}
      {warnings?.date_mismatch?.mismatch && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r">
          <div className="flex items-start">
            <span className="text-yellow-600 text-lg mr-2">⚠️</span>
            <p className="text-sm text-yellow-700">{warnings.date_mismatch.warning}</p>
          </div>
        </div>
      )}
      
      {/* 결과 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StageResultCard prediction={stage_prediction} />
        <RelapseResultCard prediction={relapse_prediction} />
        <SurvivalResultCard prediction={survival_analysis} />
      </div>
    </div>
  );
};

// ============================================================
// Stage Result Card (병기 예측)
// ============================================================

const StageResultCard: React.FC<{ prediction: any }> = ({ prediction }) => {
  if (prediction?.error) {
    return <ErrorCard title="병기 예측" error={prediction.error} usesMrna={false} />;
  }
  
  const stageColors: Record<string, string> = {
    'Stage I': 'text-green-600 bg-green-50',
    'Stage II': 'text-yellow-600 bg-yellow-50',
    'Stage III+': 'text-red-600 bg-red-50',
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-5 border-t-4 border-blue-500">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-2">📊</span>
          <h3 className="text-lg font-semibold text-blue-700">병기 예측</h3>
        </div>
        <MrnaIndicator usesMrna={prediction?.uses_mrna} />
      </div>
      
      <div className={`text-center py-4 rounded-lg ${stageColors[prediction?.predicted_stage] || 'bg-gray-50'}`}>
        <div className="text-3xl font-bold">{prediction?.predicted_stage}</div>
        <div className="text-sm text-gray-500 mt-1">
          확신도: {((prediction?.confidence || 0) * 100).toFixed(1)}%
        </div>
      </div>
      
      {/* 클래스별 확률 */}
      <div className="mt-4 space-y-2">
        <div className="text-xs text-gray-500 font-medium">클래스별 확률</div>
        {prediction?.probabilities && Object.entries(prediction.probabilities).map(([stage, prob]) => (
          <ProbabilityBar key={stage} label={stage} value={prob as number} color="bg-blue-500" />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Relapse Result Card (재발 예측)
// ============================================================

const RelapseResultCard: React.FC<{ prediction: any }> = ({ prediction }) => {
  if (prediction?.error) {
    return <ErrorCard title="재발 예측" error={prediction.error} usesMrna={true} />;
  }
  
  const probability = prediction?.relapse_probability || 0;
  const progressColor = probability > 0.6 ? 'bg-red-500' : probability > 0.4 ? 'bg-yellow-500' : 'bg-green-500';
  
  return (
    <div className="bg-white rounded-lg shadow-md p-5 border-t-4 border-orange-500">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-2">🔄</span>
          <h3 className="text-lg font-semibold text-orange-700">조기재발 예측</h3>
        </div>
        <MrnaIndicator usesMrna={prediction?.uses_mrna} />
      </div>
      
      <div className="text-center py-4">
        <div className="text-4xl font-bold text-gray-800">
          {(probability * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">24개월 이내 재발 확률</div>
      </div>
      
      {/* 프로그레스 바 */}
      <div className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${progressColor} transition-all duration-500`} 
          style={{ width: `${probability * 100}%` }} 
        />
      </div>
      
      {/* Risk Level Badge */}
      <div className="mt-4 flex justify-center">
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getRiskLevelBgClass(prediction?.risk_level)}`}>
          {prediction?.risk_level} Risk
        </span>
      </div>
      
      {/* Threshold 정보 */}
      <div className="mt-2 text-center text-xs text-gray-400">
        결정 경계: {((prediction?.threshold_used || 0) * 100).toFixed(1)}%
      </div>
    </div>
  );
};

// ============================================================
// Survival Result Card (생존 분석)
// ============================================================

const SurvivalResultCard: React.FC<{ prediction: any }> = ({ prediction }) => {
  if (prediction?.error) {
    return <ErrorCard title="생존 분석" error={prediction.error} usesMrna={true} />;
  }
  
  // 백엔드(BentoML)에서 내려주는 새로운 필드들
  const { risk_group, risk_percentile, risk_score, warning, interpretation } = prediction || {};

  // 상위 % 계산 (risk_percentile이 80이면 상위 20%)
  const topPercent = risk_percentile ? (100 - risk_percentile).toFixed(0) : null;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-5 border-t-4 border-green-500">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-2">📈</span>
          <h3 className="text-lg font-semibold text-green-700">생존 분석</h3>
        </div>
        <MrnaIndicator usesMrna={prediction?.uses_mrna} />
      </div>
      
      {/* 위험군 및 표시 */}
      <div className="text-center py-3">
        <div className="px-4 py-2 rounded-full text-lg font-medium">상대적 위험 그룹</div>
        <div className={`text-2xl font-bold mb-1 ${
          risk_group === 'High' ? 'text-red-600' : 
          risk_group === 'Medium' ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {risk_group} {topPercent && <span className="text-lg font-semibold">(상위 {topPercent}%)</span>}
        </div>
        <div className="mt-2 text-center text-xs text-gray-400">
          Risk Score: {risk_score?.toFixed(6)}
        </div>
      </div>
      
      {/* 해석 및 안내 문구 */}
      <div className="space-y-3">
        <p className="text-sm text-gray-600 leading-relaxed tabular-nums">
          본 환자의 생존 위험도는 학습된 전체 환자군 중 상위 <strong>{topPercent}%</strong>에 해당하며, 
          이는 <strong>상대적 위험도</strong>를 의미합니다.
        </p>
      
      {/* 법적/의료적 주의 문구 */}
      <div className="mt-4 p-2 bg-gray-50 rounded border border-gray-200">
        <div className="text-xs text-gray-500">
          <span className="font-medium text-amber-600">⚠️ 참고:</span>
          <div className="text-xs text-amber-800 leading-snug">
              <strong>주의:</strong><br />
              본 결과는 AI 모델이 학습한 환자군 내에서의 상대적 지표이며, 
              <strong>실제 생존 확률(%/개월)이나 확정적 의료 판단을 대체하지 않습니다.</strong>
            </div>
          </div>
        </div>
        
        {/* 백엔드 커스텀 경고 메시지 자동 표시 */}
        {warning && (
          <div className="text-xs text-red-500 italic mt-1 font-medium">
            * {warning}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Helper Components
// ============================================================

const MrnaIndicator: React.FC<{ usesMrna?: boolean }> = ({ usesMrna }) => (
  <span className={`text-xs px-2 py-1 rounded-full ${
    usesMrna ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
  }`}>
    {usesMrna ? '🧬 mRNA' : '⚫ No mRNA'}
  </span>
);

const ProbabilityBar: React.FC<{ label: string; value: number; color?: string }> = ({ 
  label, 
  value, 
  color = 'bg-blue-500' 
}) => (
  <div className="flex items-center">
    <span className="text-xs w-20 text-gray-600">{label}</span>
    <div className="flex-1 mx-2 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }} />
    </div>
    <span className="text-xs font-mono w-14 text-right text-gray-700">{(value * 100).toFixed(1)}%</span>
  </div>
);

const SurvivalBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const percentage = (value || 0) * 100;
  const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center">
      <span className="text-sm w-16 text-gray-600">{label}</span>
      <div className="flex-1 mx-2 h-4 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-700`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <span className="text-sm font-bold w-14 text-right">{percentage.toFixed(0)}%</span>
    </div>
  );
};

const ErrorCard: React.FC<{ title: string; error: string; usesMrna?: boolean }> = ({ 
  title, 
  error, 
  usesMrna 
}) => (
  <div className="bg-white rounded-lg shadow-md p-5 border-t-4 border-gray-300">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold text-gray-500">{title}</h3>
      {usesMrna !== undefined && <MrnaIndicator usesMrna={usesMrna} />}
    </div>
    <div className="text-center py-6 text-gray-400">
      <div className="text-3xl mb-2">⚠️</div>
      <p className="text-sm">{error}</p>
    </div>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl">🔬</span>
      </div>
    </div>
    <p className="mt-4 text-gray-600 font-medium">AI 분석 중...</p>
    <p className="text-sm text-gray-400">잠시만 기다려 주세요</p>
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
    <div className="text-4xl mb-2">❌</div>
    <h3 className="text-lg font-semibold text-red-700">분석 오류</h3>
    <p className="text-sm text-red-600 mt-1">{message}</p>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
    <div className="text-5xl mb-3">🎯</div>
    <h3 className="text-lg font-medium text-gray-700">분석 대기 중</h3>
    <p className="text-sm text-gray-500 mt-1">
      데이터를 선택하고 "AI 분석 실행" 버튼을 클릭하세요
    </p>
  </div>
);

export default PredictionResults;
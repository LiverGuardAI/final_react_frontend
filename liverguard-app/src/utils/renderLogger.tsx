import { useEffect, useRef } from 'react';

/**
 * 컴포넌트의 재렌더링을 추적하는 커스텀 훅
 * @param componentName - 추적할 컴포넌트 이름
 * @param props - 추적할 props 객체
 */
export function useRenderLogger(componentName: string, props?: Record<string, any>) {
  const renderCount = useRef(0);
  const prevProps = useRef<Record<string, any>>();

  useEffect(() => {
    renderCount.current += 1;
    console.log(`🔄 [${componentName}] Render #${renderCount.current}`);

    if (props && prevProps.current) {
      const changedProps: Record<string, { old: any; new: any }> = {};

      // 변경된 props 찾기
      Object.keys(props).forEach((key) => {
        if (props[key] !== prevProps.current![key]) {
          changedProps[key] = {
            old: prevProps.current![key],
            new: props[key],
          };
        }
      });

      // 변경된 props가 있으면 로그 출력
      if (Object.keys(changedProps).length > 0) {
        console.log(`  📝 Changed props:`, changedProps);
      } else {
        console.log(`  ✅ No props changed`);
      }
    }

    prevProps.current = props;
  });
}

import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

type ViewportSize = { width: number; height: number };

export function useViewportLayout(): ViewportSize & { onLayout: (event: LayoutChangeEvent) => void } {
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport(current => current.width === width && current.height === height ? current : { width, height });
  }, []);

  return { ...viewport, onLayout };
}

import { useState, useEffect } from 'react';

interface DeviceDetectionResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useDeviceDetection(): DeviceDetectionResult {
  const [deviceType, setDeviceType] = useState<DeviceDetectionResult>({
    isMobile: false,
    isTablet: false,
    isDesktop: true
  });

  useEffect(() => {
    const handleResize = () => {
      // Use screen width for more reliable detection
      const width = window.innerWidth;
      
      // More accurate device detection
      // Mobile: < 768px
      // Tablet: 768px - 1024px
      // Desktop: > 1024px
      
      const isMobile = width < 768;
      const isTablet = width >= 768 && width <= 1024;
      const isDesktop = width > 1024;
      
      setDeviceType({ isMobile, isTablet, isDesktop });
      
      console.log(`Device detection: Width=${width}, Type=${
        isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
      }`);
    };
    
    // Initial detection
    handleResize();
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceType;
}
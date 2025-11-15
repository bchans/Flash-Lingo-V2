import { useDeviceDetection } from './use-device-detection';

/**
 * Simple hook that returns whether the current device is mobile.
 * Uses the more comprehensive useDeviceDetection hook under the hood.
 * 
 * @returns {boolean} True if the device is a mobile device, false otherwise
 */
export function useIsMobile() {
  const { isMobile } = useDeviceDetection();
  return isMobile;
}
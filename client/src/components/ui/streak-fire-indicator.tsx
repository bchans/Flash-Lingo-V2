import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import clsx from "clsx";

interface StreakFireIndicatorProps {
  streak: number;
  label?: string;
  showLabel?: boolean;
  disabled?: boolean;
  variant?: "default" | "compact";
  className?: string;
}

const MAX_PARTICLE_INTENSITY = 10;

export function StreakFireIndicator({
  streak,
  label = "Streak",
  showLabel = true,
  disabled = false,
  variant = "default",
  className,
}: StreakFireIndicatorProps) {
  const [particleKey, setParticleKey] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const prevStreakRef = useRef(streak);

  const particleIntensity = useMemo(() => {
    if (streak <= 0) return 1;
    return Math.min(MAX_PARTICLE_INTENSITY, Math.max(1, streak));
  }, [streak]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (disabled) {
      setShowParticles(false);
      prevStreakRef.current = streak;
      return;
    }

    if (streak > 0 && streak > prevStreakRef.current) {
      const newKey = Date.now();
      setParticleKey(newKey);
      setShowParticles(true);
      timeout = setTimeout(() => setShowParticles(false), 900);
    } else if (streak === 0) {
      setShowParticles(false);
    }

    prevStreakRef.current = streak;

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [streak, disabled]);

  if (streak <= 0) {
    return null;
  }

  const sizeConfig =
    variant === "compact"
      ? {
          emoji: "text-2xl",
          number: "text-sm",
          particleScale: 0.6,
          containerPx: 40,
        }
      : {
          emoji: "text-3xl",
          number: "text-lg",
          particleScale: 1,
          containerPx: 54,
        };

  const baseClass =
    "flex items-center gap-2 text-green-600 animate-in fade-in-0 slide-in-from-top-1 duration-300";

  return (
    <div className={clsx(baseClass, className)}>
      {showLabel && (
        <span className="text-sm font-medium flex items-center gap-1">
          {label}
        </span>
      )}
      <div
        className="relative inline-flex items-center justify-center"
        style={{
          width: sizeConfig.containerPx,
          height: sizeConfig.containerPx,
        }}
      >
        <span className={clsx("drop-shadow-md", sizeConfig.emoji)}>🔥</span>
        <span
          className={clsx(
            "absolute font-bold text-white drop-shadow-xl",
            sizeConfig.number,
          )}
        >
          {streak}
        </span>
        {showParticles && (
          <div
            key={`particle-container-${particleKey}`}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            {Array.from({ length: particleIntensity * 4 }).map((_, i) => {
              const angle = (i / (particleIntensity * 4)) * 2 * Math.PI;
              const distance =
                (60 + particleIntensity * 15) * sizeConfig.particleScale;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;

              return (
                <div
                  key={`primary-${i}-${particleKey}`}
                  className="absolute w-3 h-3 bg-green-400 rounded-full"
                  style={{
                    left: "50%",
                    top: "50%",
                    "--particle-x": `${x}px`,
                    "--particle-y": `${y}px`,
                    animation: `particle-explode ${
                      1 + Math.random() * 0.3
                    }s ease-out forwards`,
                    animationDelay: `${0.1 + i * 0.02}s`,
                    opacity: 0,
                  } as CSSProperties & {
                    "--particle-x": string;
                    "--particle-y": string;
                  }}
                />
              );
            })}
            {particleIntensity >= 3 &&
              Array.from({ length: particleIntensity * 2 }).map((_, i) => {
                const angle =
                  (i / (particleIntensity * 2)) * 2 * Math.PI + 0.5;
                const distance =
                  (80 + particleIntensity * 20) * sizeConfig.particleScale;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const animationDuration = 1.2 + Math.random() * 0.4;
                const delay = 0.3 + i * 0.03;

                return (
                  <div
                    key={`secondary-${i}-${particleKey}`}
                    className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                    style={{
                      left: "50%",
                      top: "50%",
                      "--particle-x": `${x}px`,
                      "--particle-y": `${y}px`,
                      animation: `particle-explode ${animationDuration}s ease-out forwards`,
                      animationDelay: `${delay}s`,
                      opacity: 0,
                    } as CSSProperties & {
                      "--particle-x": string;
                      "--particle-y": string;
                    }}
                  />
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}


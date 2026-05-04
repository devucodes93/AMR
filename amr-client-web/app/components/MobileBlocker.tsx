"use client";

import { useEffect, useState } from "react";

export function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      setIsMobile(mobileRegex.test(userAgent));
    };
    checkMobile();
  }, []);

  if (!isLoaded) return null;

  if (isMobile) {
    return (
      <div className="rr-mobile-blocker">
        <div className="rr-mobile-blocker-content">
          {/* Animated background elements */}
          <div className="rr-mobile-blocker-bg">
            <div className="rr-mobile-blocker-orb orb-1" />
            <div className="rr-mobile-blocker-orb orb-2" />
            <div className="rr-mobile-blocker-orb orb-3" />
          </div>

          {/* Main content */}
          <div className="rr-mobile-blocker-card">
            <div className="rr-mobile-blocker-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="9" y1="18" x2="15" y2="18" />
              </svg>
            </div>

            <h1 className="rr-mobile-blocker-title">Desktop Only</h1>
            <p className="rr-mobile-blocker-subtitle">
              ResistanceRadar is optimized for desktop viewing
            </p>

            <div className="rr-mobile-blocker-text">
              <p>
                For the best experience, please access this application from a
                desktop or laptop computer.
              </p>
              <p>
                Our mobile app is available for secure field operations on your
                smartphone.
              </p>
            </div>

            <div className="rr-mobile-blocker-divider" />

            <div className="rr-mobile-blocker-apps">
              <h3>Mobile Apps</h3>
              <div className="rr-mobile-blocker-app-links">
                <a href="#" className="rr-mobile-blocker-app-link">
                  <span className="rr-mobile-blocker-app-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6915026,0.256551724 C18.98357,0.256551724 20.2040146,1.33793103 20.2040146,2.53448276 L20.2040146,21.1517241 C20.2040146,22.6563793 18.98357,23.5603448 17.6915026,23.5603448 L2.45989899,23.5603448 C1.16782246,23.5603448 0,22.6563793 0,21.1517241 L0,2.53448276 C0,1.33793103 1.16782246,0.256551724 2.45989899,0.256551724 L17.6915026,0.256551724 Z M17.6915026,1.29448276 L2.45989899,1.29448276 C1.90236413,1.29448276 1.27956989,1.77068966 1.27956989,2.53448276 L1.27956989,21.1517241 C1.27956989,21.9155172 1.90236413,22.52 2.45989899,22.52 L17.6915026,22.52 C18.2490375,22.52 18.9218313,21.9155172 18.9218313,21.1517241 L18.9218313,2.53448276 C18.9218313,1.77068966 18.2490375,1.29448276 17.6915026,1.29448276 Z" />
                    </svg>
                  </span>
                  iOS App
                </a>
                <a href="#" className="rr-mobile-blocker-app-link">
                  <span className="rr-mobile-blocker-app-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2 C6.48,2 2,6.48 2,12 C2,17.52 6.48,22 12,22 C17.52,22 22,17.52 22,12 C22,6.48 17.52,2 12,2 Z" />
                    </svg>
                  </span>
                  Android App
                </a>
              </div>
            </div>

            <p className="rr-mobile-blocker-footer">
              Continue on desktop to access the full dashboard
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

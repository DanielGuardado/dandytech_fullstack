import React, { useState, ReactNode, useRef, useEffect } from 'react';

interface CalculatorTooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

const CalculatorTooltip: React.FC<CalculatorTooltipProps> = ({ 
  children, 
  content, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8, // Position above the element
        left: rect.left + rect.width / 2 // Center horizontally
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible]);

  return (
    <>
      <div 
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-block' }}
        className={className}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#333',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          lineHeight: '1.4',
          whiteSpace: 'pre-line',
          minWidth: '200px',
          maxWidth: '300px',
          zIndex: 10000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: '1px solid #555',
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}>
          {content}
          {/* Arrow pointing down */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #333'
          }} />
        </div>
      )}
    </>
  );
};

export default CalculatorTooltip;
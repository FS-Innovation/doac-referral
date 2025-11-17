import React from 'react';

const LoadingSpinner = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#000',
      width: '100%'
    }}>
      <div style={{
        position: 'relative',
        width: '40px',
        height: '40px'
      }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: '3px solid transparent',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LoadingSpinner;

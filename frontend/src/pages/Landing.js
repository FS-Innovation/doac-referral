import React, { useState } from 'react';
import AuthModal from '../components/AuthModal';

const Landing = () => {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('login'); // 'login' or 'register'

  const handleOpenModal = (mode) => {
    setModalMode(mode);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <div className="landing-page">
        <div className="landing-container">
          <div className="logo-container">
            <img
              src="https://danielpriestley.com/wp-content/uploads/2025/01/doac-daniel-priestley.png"
              alt="DOAC Logo"
              className="landing-logo"
            />
          </div>

          <div className="glassmorphism-buttons">
            <button
              className="glass-btn glass-btn-primary"
              onClick={() => handleOpenModal('login')}
            >
              Login
            </button>
            <button
              className="glass-btn glass-btn-secondary"
              onClick={() => handleOpenModal('register')}
            >
              Get Started
            </button>
          </div>
        </div>

        {/* Background gradient */}
        <div className="landing-gradient"></div>
      </div>

      {showModal && (
        <AuthModal
          mode={modalMode}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default Landing;

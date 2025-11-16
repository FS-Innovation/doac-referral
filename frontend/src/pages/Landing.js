import React, { useState } from 'react';
import AuthModal from '../components/AuthModal';
import Header from '../components/Header';

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
      {showModal && <Header />}
      <div className="landing-page">
        <div className="landing-container">
          <div className="logo-container">
            <img
              src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
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

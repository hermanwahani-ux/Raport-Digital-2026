/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import LoginForm from './components/LoginForm';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';

import teacherAvatar from './assets/images/avatar_herman_1781190757209.jpg';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('waliku_session') === 'active';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('waliku_email') || 'herman@sekolah.sch.id';
  });
  const [teacherAvatarState, setTeacherAvatarState] = useState<string>(() => {
    return localStorage.getItem('waliku_teacher_avatar') || teacherAvatar;
  });

  const handleAvatarUpload = (newBase64: string) => {
    setTeacherAvatarState(newBase64);
    localStorage.setItem('waliku_teacher_avatar', newBase64);
  };

  const handleLoginSuccess = (email: string, role: string = 'teacher', studentId?: string) => {
    setUserEmail(email);
    setIsLoggedIn(true);
    localStorage.setItem('waliku_session', 'active');
    localStorage.setItem('waliku_email', email);
    localStorage.setItem('waliku_role', role);
    if (studentId) {
      localStorage.setItem('waliku_selected_student', studentId);
    } else {
      localStorage.removeItem('waliku_selected_student');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('waliku_session');
    localStorage.removeItem('waliku_role');
    localStorage.removeItem('waliku_selected_student');
    // We keep emails/data in database (localStorage) intact for persistent editing!
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const scrollToLogin = () => {
    const el = document.getElementById('login');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Enforce Inter font family in document body on launch
  useEffect(() => {
    document.title = 'Portal Raport Digital - Kelola Kelas Lebih Mudah';
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-blue-100 selection:text-blue-900 antialiased font-sans">
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          /* LANDING PAGE EXPERIENCE */
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Header Navigation */}
            <Navbar
              isLoggedIn={false}
              onLogout={handleLogout}
              onLoginClick={scrollToLogin}
              teacherAvatar={teacherAvatarState}
            />

            {/* Hero Banner Section */}
            <Hero 
              onCtaclick={scrollToLogin} 
              teacherAvatar={teacherAvatarState}
              onAvatarUpload={handleAvatarUpload}
            />

            {/* Solution Features Information Grid */}
            <Features />

            {/* Integrated Access Portal Section */}
            <LoginForm onLoginSuccess={handleLoginSuccess} />

            {/* Complete Detailed Footer */}
            <Footer />
          </motion.div>
        ) : (
          /* INTERACTIVE WALI KELAS DIGITAL PORTAL */
          <motion.div
            key="portal"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.4 }}
          >
            <Dashboard
              userEmail={userEmail}
              onLogout={handleLogout}
              teacherAvatar={teacherAvatarState}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

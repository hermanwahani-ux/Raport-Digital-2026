/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  isLoggedIn: boolean;
  onLogout: () => void;
  onLoginClick: () => void;
  teacherName?: string;
  teacherAvatar?: string;
}

export default function Navbar({
  isLoggedIn,
  onLogout,
  onLoginClick,
  teacherName = 'Herman Wahani',
  teacherAvatar
}: NavbarProps) {
  const [activeTab, setActiveTab] = useState('Beranda');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = ['Beranda', 'Fitur', 'Setor Nilai', 'Tentang', 'Kontak'];

  const handleNavClick = (item: string) => {
    setActiveTab(item);
    setIsMobileMenuOpen(false);

    // Scroll to section corresponding to the item or handle scroll actions
    const sectionMap: { [key: string]: string } = {
      'Beranda': 'hero',
      'Fitur': 'features',
      'Setor Nilai': 'setor-nilai',
      'Tentang': 'about',
      'Kontak': 'footer'
    };

    const targetId = sectionMap[item];
    if (targetId) {
      if (isLoggedIn) {
        // If logged in, maybe we are inside dashboard, so clicking is different or we just go out
        onLogout();
      } else {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm" id="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleNavClick('Beranda')}>
            <div className="bg-[#00288e] text-white p-1.5 rounded-md flex items-center justify-center shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-sans text-xl font-bold tracking-tight text-[#00288e]">Portal Raport Digital</span>
          </div>

          {/* Desktop Navigation */}
          {!isLoggedIn ? (
            <div className="hidden md:flex space-x-8">
              {menuItems.map((item) => (
                <button
                  key={item}
                  onClick={() => handleNavClick(item)}
                  className={`font-sans text-sm font-medium transition-colors cursor-pointer relative py-1 ${
                    activeTab === item ? 'text-[#00288e]' : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  {item}
                  {activeTab === item && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00288e] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center space-x-1 border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span>Wali Kelas Aktif</span>
              </span>
            </div>
          )}

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={onLoginClick}
                  className="font-sans text-sm font-medium text-gray-700 hover:text-[#00288e] transition-colors px-4 py-2 cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={onLoginClick}
                  className="font-sans text-sm font-semibold text-white bg-[#00288e] hover:bg-[#1e40af] transition-all px-4 py-1.5 rounded-[4px] shadow-sm hover:shadow cursor-pointer duration-150"
                >
                  Daftar
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-gray-50 p-1.5 pr-3 rounded-full border border-gray-100">
                  <img
                    src={teacherAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                    alt="Teacher"
                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-xs font-bold text-gray-800">{teacherName}</span>
                    <span className="text-[10px] text-gray-400">Guru Wali Kelas</span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                  title="Logout dari WaliKu"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu, toggle button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-500 hover:text-gray-950 hover:bg-gray-50 rounded-md"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-2 px-4 shadow-inner">
          {!isLoggedIn ? (
            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item}
                  onClick={() => handleNavClick(item)}
                  className="block w-full text-left py-2 px-3 text-sm font-medium text-gray-600 hover:text-[#00288e] hover:bg-gray-50 rounded-md"
                >
                  {item}
                </button>
              ))}
              <div className="border-t border-gray-100 my-2 pt-2 flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="text-center py-2 text-sm font-medium text-gray-600 hover:text-[#00288e]"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="text-center py-2 text-sm font-semibold text-white bg-[#00288e] rounded-[4px] shadow"
                >
                  Daftar
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2 flex flex-col space-y-3">
              <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-md">
                <img
                  src={teacherAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                  alt="Teacher"
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-800">{teacherName}</span>
                  <span className="text-[11px] text-gray-400">Guru Wali Kelas XI MIPA 2</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-center py-2 text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-100 rounded-md flex items-center justify-center space-x-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

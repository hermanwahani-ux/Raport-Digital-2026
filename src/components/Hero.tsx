/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, CheckSquare, Camera } from 'lucide-react';
import laptopImg from '../assets/images/laptop_classroom_dashboard_1781190740403.jpg';
import avatarImg from '../assets/images/avatar_herman_1781190757209.jpg';

interface HeroProps {
  onCtaclick: () => void;
  teacherAvatar?: string;
  onAvatarUpload?: (newBase64: string) => void;
}

export default function Hero({ onCtaclick, teacherAvatar, onAvatarUpload }: HeroProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScrollDown = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (onAvatarUpload) {
          onAvatarUpload(base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section id="hero" className="relative overflow-hidden bg-white pt-10 pb-16 md:py-24">
      {/* Decorative backdrop glow */}
      <div className="absolute top-0 right-0 -mr-20 h-96 w-96 rounded-full bg-blue-50 opacity-50 blur-3xl" />
      <div className="absolute -bottom-10 left-10 h-72 w-72 rounded-full bg-teal-50 opacity-40 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <motion.div 
            className="lg:col-span-6 flex flex-col space-y-6 text-left"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center space-x-2 bg-blue-50 text-[#00288e] text-xs font-semibold px-3 py-1 rounded-full border border-blue-100 self-start">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Sistem Manajemen Kelas</span>
            </div>

            <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-[1.12]">
              Portal Raport Digital
            </h1>

            <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl italic">
              Portal raport digital membantu guru wali kelas mengelola pengumuman digital, raport online, rekap absen semester, penyetoran nilai mata pelajaran, perkembangan akademik siswa dalam satu platform yang aman dan efisien. Transformasi manajemen administrasi guru digital.
            </p>

            {/* Author Badge precisely styled to screen */}
            <div className="flex items-center space-x-3 pt-2">
              <div className="relative cursor-pointer group" onClick={handleAvatarClick} title="Klik untuk mengunggah foto profil baru">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <img
                  src={teacherAvatar || avatarImg}
                  alt="Herman Wahani"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md group-hover:brightness-90 transition duration-150"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-mono tracking-widest text-[#00288e] font-semibold">
                  CREATE BY, HERMANWAHANI.COM
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  Project Lead & Wali Kelas Guru
                </span>
              </div>
            </div>

            {/* CTA action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={onCtaclick}
                className="font-sans text-sm font-semibold text-white bg-[#00288e] hover:bg-[#1e40af] transition-colors px-6 py-3 rounded-[4px] shadow-lg shadow-blue-900/10 hover:shadow-xl hover:translate-y-[-1px] duration-150 cursor-pointer text-center"
              >
                Coba Manajemen Kelas Sekarang
              </button>
              <button
                onClick={handleScrollDown}
                className="font-sans text-sm font-semibold text-gray-700 hover:text-gray-950 bg-gray-50 hover:bg-gray-100 transition-colors px-6 py-3 rounded-[4px] border border-gray-200 flex items-center justify-center space-x-1 duration-150 cursor-pointer"
              >
                <span>Pelajari Fitur</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>
            </div>
          </motion.div>

          {/* Right Image/Mockup Column */}
          <motion.div 
            className="lg:col-span-6 relative flex justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            {/* Soft backdrop radial shadow */}
            <div className="absolute inset-0 bg-[#00288e]/5 blur-2xl rounded-[30px] transform rotate-3 scale-95" />
            
            <div className="relative bg-white p-3 rounded-2xl border border-gray-150 shadow-2xl max-w-full overflow-hidden">
              <img
                src={laptopImg}
                alt="WaliKu School Administration Laptop Mockup"
                className="rounded-xl w-full object-cover transition-transform hover:scale-[1.01] duration-300"
                style={{ maxHeight: '420px' }}
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

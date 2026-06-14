/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  Key, 
  FileCheck, 
  Download, 
  Info, 
  ChevronRight, 
  Sparkles,
  HelpCircle,
  Hash,
  AlertCircle
} from 'lucide-react';

interface MobileHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileHelpModal({ isOpen, onClose }: MobileHelpModalProps) {
  const steps = [
    {
      icon: <Smartphone className="w-5 h-5 text-blue-600" />,
      title: "1. Buka melalui Browser HP",
      desc: "Buka link aplikasi ini di Handphone (menggunakan Google Chrome, Safari, atau browser bawaan HP Anda)."
    },
    {
      icon: <Hash className="w-5 h-5 text-indigo-600" />,
      title: "2. Masukkan Nomor NISN",
      desc: "Gunakan 10-digit Nomor Induk Siswa Nasional (NISN) Anda sebagai Username utama."
    },
    {
      icon: <Key className="w-5 h-5 text-violet-600" />,
      title: "3. Gunakan Kata Sandi Kelas",
      desc: "Gunakan kata sandi 'password123' (atau kata sandi khusus yang dibagikan secara resmi oleh Wali Kelas Bapak/Ibu)."
    },
    {
      icon: <FileCheck className="w-5 h-5 text-emerald-600" />,
      title: "4. Lihat Pengumuman & Raport",
      desc: "Setelah berhasil masuk, status presensi, pengumuman terbaru, dan tombol unduh Raport PDF otomatis tampil responsif."
    },
    {
      icon: <Download className="w-5 h-5 text-rose-600" />,
      title: "5. Unduh Dokumen PDF Resmi",
      desc: "Ketuk tombol 'Buka Raport PDF' atau 'Unduh PDF' untuk menyimpan file raport resmi langsung ke memori handphone."
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            id="mobile-help-backdrop"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden z-10 my-8 text-left"
            id="mobile-help-content"
          >
            {/* Visual Top Decorative Header Banner */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-850 p-6 text-white relative">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
              
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition cursor-pointer"
                aria-label="Tutup"
                id="close-mobile-help-modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="bg-white/15 p-2 rounded-xl text-amber-300">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center space-x-1.5">
                    <span>Panduan Akses HP</span>
                    <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                  </h3>
                  <p className="text-[11px] text-indigo-150 text-blue-100">
                    Petunjuk mudah untuk orang tua dan siswa memantau nilai via gawai.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-150 p-3.5 rounded-lg flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                  Aplikasi WaliKu dirancang sepenuhnya responsif (mobile-friendly) sehingga sangat ringan diakses lewat browser internet ponsel pintar apa pun tanpa harus install aplikasi tambahan.
                </p>
              </div>

              {/* Steps stack */}
              <div className="space-y-4">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Langkah-Langkah Akses</span>
                <div className="space-y-3">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex space-x-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-205 transition duration-150">
                      <div className="bg-white border border-slate-200 shadow-xs w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                        {s.icon}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 flex items-center">
                          <span>{s.title}</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Note for First Time Login */}
              <div className="bg-amber-50 border border-amber-150 p-3.5 rounded-lg flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Pemberitahuan Sinkronisasi</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Jika data rapor tidak langsung tampil atau berbeda dari komputer guru, mintalah Wali Kelas untuk menekan tombol <strong>"Sinkronisasikan Sekarang"</strong> di halaman pengaturan laptopnya agar pangkalan data langsung terupdate ke handphone Anda secara instan.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end">
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition duration-150 cursor-pointer shadow-sm"
                id="close-instruction-btn"
              >
                Saya Mengerti, Tutup Panduan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

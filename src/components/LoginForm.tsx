/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ShieldAlert, 
  ArrowRight, 
  User, 
  GraduationCap, 
  Briefcase, 
  HelpCircle, 
  FileText,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';
import { INITIAL_STUDENTS } from '../data';
import studentImg from '../assets/images/student_login_preview_1781192210124.jpg';

interface LoginFormProps {
  onLoginSuccess: (email: string, role?: string, studentId?: string) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  // --- Teacher Login States ---
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [teacherRememberMe, setTeacherRememberMe] = useState(true);
  const [teacherError, setTeacherError] = useState('');
  const [isTeacherLoading, setIsTeacherLoading] = useState(false);

  // --- Student Login States ---
  const [studentNisn, setStudentNisn] = useState(''); // Default: empty
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentRememberMe, setStudentRememberMe] = useState(true);
  const [studentError, setStudentError] = useState('');
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('waliku_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          INITIAL_STUDENTS.forEach(initS => {
            if (!merged.some(s => s.id === initS.id || s.nisn === initS.nisn)) {
              merged.push(initS);
            }
          });
          return merged;
        }
      } catch (err) {
        console.error("Gagal mendapatkan data siswa dari localStorage:", err);
      }
    }
    return INITIAL_STUDENTS;
  });

  useEffect(() => {
    async function fetchStudents() {
      try {
        const snap = await getDocs(collection(db, 'students'));
        const list: Student[] = [];
        if (snap.size > 0) {
          snap.forEach(sDoc => {
            const data = sDoc.data() as Student;
            list.push(data);
          });
        }
        
        // Gabungkan hasil Firestore, data localStorage, dan data baseline awal
        const merged = [...list];
        const savedStr = localStorage.getItem('waliku_students');
        if (savedStr) {
          try {
            const savedList = JSON.parse(savedStr);
            if (Array.isArray(savedList)) {
              savedList.forEach(s => {
                if (!merged.some(m => m.id === s.id || m.nisn === s.nisn)) {
                  merged.push(s);
                }
              });
            }
          } catch (e) {
            console.error(e);
          }
        }

        INITIAL_STUDENTS.forEach(initS => {
          if (!merged.some(s => s.id === initS.id || s.nisn === initS.nisn)) {
            merged.push(initS);
          }
        });

        setStudents(merged);
        localStorage.setItem('waliku_students', JSON.stringify(merged));
      } catch (err) {
        console.error("Gagal memuat siswa dari Cloud Firestore:", err);
      }
    }
    fetchStudents();
  }, []);

  useEffect(() => {
    localStorage.setItem('waliku_students', JSON.stringify(students));
  }, [students]);

  // --- Teacher Submit Handler ---
  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');

    if (!teacherEmail) {
      setTeacherError('Email wajib diisi.');
      return;
    }
    if (!teacherPassword) {
      setTeacherError('Kata sandi wajib diisi.');
      return;
    }

    setIsTeacherLoading(true);
    setTimeout(() => {
      setIsTeacherLoading(false);
      // Validate with Herman default
      if (teacherEmail === 'herman@sekolah.sch.id' && teacherPassword === 'password123') {
        onLoginSuccess(teacherEmail, 'teacher');
      } else {
        setTeacherError('Kredensial salah! Gunakan akun guru demo yang tersedia.');
      }
    }, 750);
  };

  // --- Student Submit Handler ---
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');

    if (!studentNisn) {
      setStudentError('Nomor Induk Siswa Nasional (NISN) wajib diisi.');
      return;
    }
    if (!studentPassword) {
      setStudentError('Kata sandi wajib diisi.');
      return;
    }

    setIsStudentLoading(true);
    setTimeout(() => {
      setIsStudentLoading(false);
      
      // Match NISN from students state (which includes Firestore data)
      const inputNisn = studentNisn.trim();
      const matchedStudent = students.find(s => s.nisn.trim() === inputNisn);
      if (matchedStudent) {
        onLoginSuccess(matchedStudent.email, 'student', matchedStudent.id);
      } else {
        setStudentError('NISN tidak terdaftar! Periksa NISN murid Anda dalam daftar kemajuan kelas.');
      }
    }, 750);
  };

  // --- Preset Login for Demos ---
  const handleTeacherDemo = () => {
    setTeacherEmail('herman@sekolah.sch.id');
    setTeacherPassword('password123');
    setIsTeacherLoading(true);
    setTimeout(() => {
      setIsTeacherLoading(false);
      onLoginSuccess('herman@sekolah.sch.id', 'teacher');
    }, 500);
  };

  const handleStudentDemo = (nisn: string) => {
    setStudentNisn(nisn);
    setStudentPassword('password123');
    setIsStudentLoading(true);
    setTimeout(() => {
      setIsStudentLoading(false);
      const cleanNisn = nisn.trim();
      const student = students.find(s => s.nisn.trim() === cleanNisn);
      if (student) {
        onLoginSuccess(student.email, 'student', student.id);
      }
    }, 500);
  };

  return (
    <section id="login" className="py-16 bg-gradient-to-b from-[#fbf8ff] to-[#f4f2fc] relative text-left">
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#00288e_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative">
        
        {/* Unified Portal Title Panel */}
        <div className="text-center space-y-3">
          <span className="text-[10px] font-extrabold bg-blue-100 text-[#00288e] px-3.5 py-1.5 rounded-full uppercase tracking-wider">
            Portal Raport Digital
          </span>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight font-sans mt-1">
            Akses Portal Raport Digital
          </h2>
          <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Pusat administrasi mandiri guru wali kelas, pendidik, siswa, serta akses pantau nilai transparan bagi bapak/ibu orang tua murid.
          </p>
        </div>

        {/* Dynamic Multi-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* COLUMN 1: PORTAL GURU (lg:col-span-4) */}
          <motion.div
            className="lg:col-span-4 bg-white border border-gray-250/80 rounded-xl shadow-xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden h-full"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            id="portal-guru-card"
          >
            {/* Top accent ribbon */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#00288e]" />
            
            <div>
              {/* Form Header */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 text-[#00288e] font-extrabold mb-1.5">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-wider">Portal Pendidik</span>
                </div>
                <h3 className="text-lg font-black text-gray-900">
                  Masuk sebagai Guru
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gunakan email resmi dari dinas pendidikan atau sekolah Anda.
                </p>
              </div>

              {/* Error Notification */}
              {teacherError && (
                <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{teacherError}</span>
                </div>
              )}

              {/* Form fields */}
              <form onSubmit={handleTeacherSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-gray-700 tracking-wider uppercase">
                    Email Resmi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-gray-450 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder="contoh@sekolah.sch.id"
                      className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-[4px] text-xs placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-gray-700 tracking-wider uppercase">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-450 text-gray-400" />
                    </div>
                    <input
                      type={showTeacherPassword ? 'text' : 'password'}
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-9 py-2 bg-white border border-gray-300 rounded-[4px] text-xs placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-1.5 text-[10.5px] text-gray-650 text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teacherRememberMe}
                      onChange={(e) => setTeacherRememberMe(e.target.checked)}
                      className="rounded border-gray-300 text-[#00288e] focus:ring-[#00288e] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Ingat saya</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => alert('Sistem reset password: Silakan hubungi bagian IT operator sekolah Anda.')}
                    className="text-[10.5px] text-gray-500 hover:text-[#00288e] font-medium cursor-pointer"
                  >
                    Lupa sandi?
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={isTeacherLoading}
                    className="w-full text-center py-2 px-4 text-xs font-bold text-white bg-[#00288e] hover:bg-[#1e40af] disabled:bg-blue-300 rounded-[4px] transition-all shadow duration-150 flex items-center justify-center space-x-2 cursor-pointer h-9 shrink-0"
                  >
                    {isTeacherLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Memfilter Data...</span>
                      </>
                    ) : (
                      <>
                        <span>Masuk Pendidik</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTeacherDemo}
                    className="w-full text-center py-1.5 px-4 text-[10px] font-bold text-[#00288e] bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition cursor-pointer"
                  >
                    Masuk Instan (Guru Wali Demo)
                  </button>
                </div>
              </form>
            </div>


          </motion.div>

          {/* COLUMN 2: PORTAL SISWA MOCKUP (lg:col-span-8) - BUILT EXACTLY AS SHOWN IN THE HERO PREVIEW */}
          <motion.div
            className="lg:col-span-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-2 items-stretch"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            id="portal-siswa-card"
          >
            {/* Left side: Premium Blue Cover Block with Student Image */}
            <div className="bg-[#00288e] p-8 text-white flex flex-col justify-between text-center relative overflow-hidden min-h-[360px] md:min-h-auto">
              {/* Top background abstract dots */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              
              {/* Student image wrapper styled exactly like mock */}
              <div className="my-auto space-y-6">
                <div className="relative mx-auto w-56 h-56 rounded-lg overflow-hidden border-2 border-white/60 shadow-lg bg-indigo-900/40">
                  <img
                    src={studentImg}
                    alt="Siswa Belajar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-lg font-black tracking-tight leading-snug">
                    Masa Depan Dimulai dari Sini
                  </h4>
                  <p className="text-[10.5px] text-indigo-100/90 leading-relaxed max-w-sm mx-auto">
                    Akses materi belajar, pantau nilai, dan kelola tugas harianmu dengan WaliKu — asisten digital pintarmu.
                  </p>
                </div>
              </div>
              
              <div className="text-[9px] text-indigo-200/60 font-mono tracking-widest mt-4">
                WaliKu • DIGITAL PORTAL v1.2
              </div>
            </div>

            {/* Right side: White Student Form Block */}
            <div className="p-8 flex flex-col justify-between text-left relative bg-white">
              <div>
                {/* Logo and Greeting */}
                <div className="mb-6 space-y-1.5">
                  <div className="w-7 h-7 bg-blue-50 text-[#00288e] rounded flex items-center justify-center font-bold text-xs border border-blue-100">
                    W
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      Selamat Datang, Siswa
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Silakan masukkan akun belajarmu
                    </p>
                  </div>
                </div>

                {/* Error Notification */}
                {studentError && (
                  <div className="mb-4 bg-red-50 border border-red-250 text-red-700 p-2.5 rounded text-[11px] flex items-center space-x-2">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{studentError}</span>
                  </div>
                )}

                {/* Form fields */}
                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-gray-700 tracking-wider uppercase">
                      Nomor Induk Siswa (NISN)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={studentNisn}
                        onChange={(e) => setStudentNisn(e.target.value)}
                        placeholder="Contoh: 0012345678"
                        className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-[4px] text-xs placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-mono font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-extrabold text-gray-700 tracking-wider uppercase">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => alert('Untuk keamanan, penyetelan ulang sandi siswa dapat dikonfirmasikan oleh Wali Murid langsung ke pihak Tata Usaha sekolah.')}
                        className="text-[10px] text-[#00288e] font-bold hover:underline"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                        type={showStudentPassword ? 'text' : 'password'}
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-9 pr-9 py-2 bg-white border border-gray-300 rounded-[4px] text-xs placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center space-x-1.5 text-[10.5px] text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={studentRememberMe}
                        onChange={(e) => setStudentRememberMe(e.target.checked)}
                        className="rounded border-gray-300 text-[#00288e] focus:ring-[#00288e] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Ingat saya di perangkat ini</span>
                    </label>
                  </div>

                  {/* Standard Form Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isStudentLoading}
                      className="w-full text-center py-2.5 px-4 text-xs font-bold text-white bg-[#00288e] hover:bg-slate-900 disabled:bg-blue-300 rounded-[4px] transition-all shadow duration-150 flex items-center justify-center space-x-2 cursor-pointer h-9 shrink-0"
                    >
                      {isStudentLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Memverifikasi Akun...</span>
                        </>
                      ) : (
                        <>
                          <span>Masuk sebagai Siswa</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-150" />
                  </div>
                  <div className="relative flex justify-center text-[9px] uppercase tracking-wider">
                    <span className="bg-white px-2.5 font-bold text-slate-400">Akses Cepat Uji Coba</span>
                  </div>
                </div>

                {/* Instant Student Selector Clickable Badges for Easy Demo */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 text-slate-500 block mb-1">Klik nama siswa untuk masuk demo instan:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {students.slice(0, 4).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentDemo(student.nisn)}
                        className="p-1 px-2 text-[10.5px] font-bold text-slate-700 bg-slate-50 hover:bg-indigo-50 border border-slate-205 border-slate-200 rounded text-left truncate flex items-center space-x-1 cursor-pointer transition duration-100/60"
                        title={`Masuk sebagai ${student.name}`}
                      >
                        <User className="w-3 h-3 text-[#00288e] shrink-0" />
                        <span className="truncate">{student.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Support Notice */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 text-center">
                <p className="text-[10px] text-gray-500">
                  Kesulitan masuk? Hubungi <span className="text-emerald-700 font-bold">Admin Sekolah</span> atau <span className="text-emerald-700 font-bold">Guru Wali Kelas</span>.
                </p>
                <div className="flex items-center justify-center space-x-3 text-[9px] text-gray-400 mt-2 font-semibold">
                  <button type="button" onClick={() => alert('Pusat Bantuan Sekolah: Hubungi No Telp Tata Usaha')} className="hover:text-amber-800 transition">Pusat Bantuan</button>
                  <span>•</span>
                  <button type="button" onClick={() => alert('Kebijakan Privasi WaliKu: Data Anda dilindungi undang-undang perlindungan data pendidikan')} className="hover:text-amber-800 transition">Keamanan Akun</button>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  FileText, 
  FileUp, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2, 
  ChevronRight,
  ShieldCheck,
  User,
  BookOpen
} from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, ensureSignedInUser, handleFirestoreError, OperationType } from '../lib/firebase';
import { SubjectGrade } from '../types';

export default function SubjectGradesPortal() {
  const [teacherName, setTeacherName] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjectsList = [
    'Pendidikan agama dan budi pekerti',
    'Pendidikan Pancasila dan Kewarganegaraan',
    'Bahasa Indonesia',
    'PJOK',
    'Sejarah',
    'Seni Rupa',
    'Mulok',
    'Matematika',
    'Bahasa Inggris',
    'Informatika',
    'Ipas',
    'DPK',
    'KKA',
    'Lainnya (Tulis Sendiri)'
  ];

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = (selectedFile: File) => {
    const validExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const fileName = selectedFile.name.toLowerCase();
    const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExt) {
      setErrorMessage('Format berkas tidak didukung! Pastikan menggunakan file PDF, Word (.doc, .docx), atau Excel (.xls, .xlsx)');
      return;
    }

    // Limit size to 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas terlalu besar! Maksimum ukuran file adalah 10 MB.');
      return;
    }

    setErrorMessage('');
    setFile(selectedFile);

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileBase64(e.target?.result as string);
    };
    reader.onerror = () => {
      setErrorMessage('Gagal membaca dokumen berkas.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
      return <FileSpreadsheet className="w-10 h-10 text-emerald-600" />;
    }
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      return <FileText className="w-10 h-10 text-blue-600" />;
    }
    return <FileText className="w-10 h-10 text-rose-600" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const subjectToUse = subject === 'Lainnya (Tulis Sendiri)' ? customSubject.trim() : subject;

    if (!teacherName.trim()) {
      setErrorMessage('Mohon lengkapi Nama Guru Pengampu.');
      return;
    }
    if (!subjectToUse) {
      setErrorMessage('Mohon lengkapi Nama Mata Pelajaran.');
      return;
    }
    if (!file || !fileBase64) {
      setErrorMessage('Silakan upload / seret draf dokumen Excel atau PDF nilai.');
      return;
    }

    setStatus('loading');

    try {
      // Ensure the browser session is authenticated (e.g. anonymously)
      await ensureSignedInUser();

      // Create unique ID
      const gradeId = 'sub_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      const uploadDateStr = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const payload: SubjectGrade = {
        id: gradeId,
        subject: subjectToUse,
        teacherName: teacherName.trim(),
        fileName: file.name,
        fileSize: formatBytes(file.size),
        uploadDate: uploadDateStr,
        fileData: fileBase64
      };

      // Store in firestore collection "subjectGrades"
      const docRef = doc(collection(db, 'subjectGrades'), gradeId);
      await setDoc(docRef, payload);

      setStatus('success');
    } catch (err: any) {
      console.error('Submit subject grade error:', err);
      setStatus('error');
      setErrorMessage('Terjadi kegagalan sistem saat mengupload nilai: ' + (err?.message || err));
    }
  };

  const handleReset = () => {
    setTeacherName('');
    setSubject('');
    setCustomSubject('');
    setFile(null);
    setFileBase64('');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <section id="setor-nilai" className="py-20 bg-[#001042]/5 relative overflow-hidden border-t border-gray-200">
      <div className="absolute inset-0 bg-white/40 pointer-events-none" />
      <div className="absolute -top-40 right-10 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute top-20 -left-10 w-96 h-96 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Info side: Columns 1-5 */}
          <div className="lg:col-span-5 text-left space-y-6">
            <div className="inline-flex items-center space-x-2 bg-blue-50 text-[#00288e] text-xs font-bold px-3 py-1.5 rounded-full border border-blue-100">
              <ShieldCheck className="w-4 h-4 text-[#00288e]" />
              <span>Akses Bebas Password (Instan)</span>
            </div>

            <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">
              Penyetoran Nilai Mata Pelajaran (Guru Mapel)
            </h2>

            <p className="text-sm text-gray-600 leading-relaxed">
              Bapak/Ibu Guru Mata Pelajaran dapat menyetorkan draf laporan hasil nilai kesiswaan di kelas ini kepada Wali Kelas secara langsung dan cepat, tanpa perlu kredensial sandi login.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#00288e] shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wide">Format Didukung Luas</h4>
                  <p className="text-xs text-gray-500 leading-tight">Mendukung Microsoft Excel (.xls, .xlsx), Word (.doc, .docx), serta berkas format PDF harian atau akhir semester.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wide">Backup Google Drive Otomatis</h4>
                  <p className="text-xs text-gray-500 leading-tight">Data laporan nilai yang diupload didepositkan ke server cloud kesiswaan, dan secara instan siap disinkronisasikan ke Google Drive terintegrasi milik Wali Kelas.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 border border-gray-200/80 p-4 rounded-lg flex items-center space-x-3 text-left">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <p className="text-xs text-gray-500">
                Penerima aktif wali kelas saat ini: <strong className="text-gray-800 font-bold">Herman Wahani, S.Pd.</strong>
              </p>
            </div>
          </div>

          {/* Form Card side: Columns 6-12 */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200/80 p-6 md:p-8 relative text-left">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-t-xl" />

              <AnimatePresence mode="wait">
                {status !== 'success' ? (
                  <motion.form 
                    onSubmit={handleSubmit} 
                    className="space-y-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key="form"
                  >
                    <div className="border-b border-gray-100 pb-3">
                      <h3 className="text-base font-extrabold text-gray-800">Formulir Kirim Nilai</h3>
                      <p className="text-xs text-gray-400">Silakan isi kelengkapan rincian mata pelajaran berikut</p>
                    </div>

                    {errorMessage && (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded text-xs flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Inputs Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Teacher Name */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-extrabold text-gray-750 text-gray-700 uppercase tracking-wider flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>Nama Guru Mapel</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                          placeholder="Contoh: Budi Santoso, S.Pd."
                          className="block w-full border border-gray-300 rounded-[4px] p-2.5 text-xs bg-white placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium"
                        />
                      </div>

                      {/* Subject Choice */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-extrabold text-gray-750 text-gray-700 uppercase tracking-wider flex items-center space-x-1">
                          <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                          <span>Mata Pelajaran</span>
                        </label>
                        <select
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="block w-full border border-gray-300 rounded-[4px] p-2.5 text-xs bg-white focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium text-gray-800 cursor-pointer"
                        >
                          <option value="">-- Pilih Mata Pelajaran --</option>
                          {subjectsList.map((subj, idx) => (
                            <option key={idx} value={subj}>{subj}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Custom Input when Custom is selected */}
                    {subject === 'Lainnya (Tulis Sendiri)' && (
                      <motion.div 
                        className="space-y-1.5 text-left"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider">Nama Mapel Kastem</label>
                        <input
                          type="text"
                          required
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="Masukkan nama mata pelajaran di sini..."
                          className="block w-full border border-gray-300 rounded-[4px] p-2.5 text-xs bg-white placeholder-gray-400 focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e] transition font-medium"
                        />
                      </motion.div>
                    )}

                    {/* Drag and Drop Dropzone */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider">Unggah / Setor Dokumen Berkas Nilai</label>
                      
                      {!file ? (
                        <div
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          onClick={triggerFileSelect}
                          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition duration-150 flex flex-col justify-center items-center space-y-3 relative overflow-hidden group select-none ${
                            isDragActive 
                              ? 'border-[#00288e] bg-blue-50/50 scale-[1.01]' 
                              : 'border-gray-350 border-gray-300 hover:border-gray-450 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf, .doc, .docx, .xls, .xlsx"
                            className="hidden"
                          />

                          <div className="bg-indigo-50 border border-indigo-100 w-12 h-12 rounded-full flex items-center justify-center text-[#00288e] group-hover:scale-105 transition duration-150 shadow-sm">
                            <FileUp className="w-5 h-5" />
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-gray-700">
                              Seret draf berkas di sini atau <span className="text-[#00288e] underline">pilih file</span>
                            </p>
                            <p className="text-[10.5px] text-gray-400">
                              Ekstensi yang diterima: PDF, Word (Doc/Docx), Excel (Xls/Xlsx) hingga maks 10MB
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50/40 border border-blue-200/80 rounded-lg p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
                          
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="p-2.5 bg-white border border-gray-200 rounded shadow-inner">
                              {getFileIcon(file.name)}
                            </div>
                            <div className="text-left overflow-hidden">
                              <h4 className="text-xs font-bold text-gray-800 truncate" title={file.name}>{file.name}</h4>
                              <div className="flex items-center space-x-2 text-[10.5px] text-gray-400 font-medium">
                                <span>{formatBytes(file.size)}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 flex items-center space-x-0.5">
                                  <span>Siap Dikirim</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setFileBase64('');
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
                            title="Hapus berkas terpilih"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Submit Section */}
                    <div className="pt-4 border-t border-gray-100">
                      <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full text-center py-2.5 px-4 text-xs font-bold text-white bg-[#00288e] hover:bg-[#1e40af] disabled:bg-blue-300 rounded-[4px] transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer h-10 shrink-0"
                      >
                        {status === 'loading' ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Mengunggah Berkas Nilai...</span>
                          </>
                        ) : (
                          <>
                            <span>Setor Berkas Nilai Sekarang</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    className="p-6 md:p-10 text-center space-y-6"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    key="success"
                  >
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100 animate-bounce">
                      <CheckCircle className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-gray-950">Berkas Nilai Terkirim!</h3>
                      <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                        Terima kasih Bapak/Ibu <strong className="text-gray-800 font-bold">{teacherName}</strong>. Nilai mata pelajaran <strong className="text-[#00288e]">{subject === 'Lainnya (Tulis Sendiri)' ? customSubject : subject}</strong> telah disetorkan dengan selamat ke Wali Kelas <strong className="text-gray-800">Herman Wahani, S.Pd.</strong>
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-lg flex items-center space-x-3 text-left max-w-md mx-auto">
                      <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="text-[11px] leading-snug">
                        <span className="block font-bold text-gray-800">Status Penyimpanan:</span>
                        <span className="text-gray-500">Tersimpan aman di Cloud server. Wali Kelas akan mengunduh dan mencadangkan file <span className="font-mono text-gray-700 bg-gray-100 px-1 rounded">{file?.name}</span> ke folder Google Drive kelas.</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="py-2.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Setor Berkas / Mapel Lainnya
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

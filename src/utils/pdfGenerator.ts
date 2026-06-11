/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Student, StudentGrade, AttendanceDay, UserProfile } from '../types';

// Helper to determine letter predicate
const getGradeLetter = (score: number) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
};

// Map grade letters to descriptive texts
const getGradeText = (letter: string) => {
  switch (letter) {
    case 'A': return 'Sangat Baik';
    case 'B': return 'Baik';
    case 'C': return 'Cukup';
    default: return 'Perlu Pendampingan';
  }
};

/**
 * Downloads a single student's academic report card as PDF
 */
export const downloadSingleStudentRaforPDF = (
  student: Student,
  gradeRecord: StudentGrade | undefined,
  profile: UserProfile,
  average: number
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const mGrades = gradeRecord?.grades || { matematika: 0, ipa: 0, ips: 0, bahasaIndonesia: 0, bahasaInggris: 0 };

  // --- Headings & Border ---
  doc.setDrawColor(0, 40, 142); // #00288e
  doc.setLineWidth(1);
  doc.rect(5, 5, 200, 287); // Page boundary border

  // Header Box
  doc.setFillColor(0, 40, 142);
  doc.rect(5, 5, 200, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PEMERINTAH PROVINSI DKI JAKARTA', 105, 12, { align: 'center' });
  doc.setFontSize(14);
  doc.text(profile.school.toUpperCase(), 105, 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Jl. Budi Utomo No. 7, Jakarta Pusat, DKI Jakarta • Telp (021) 386509', 105, 26, { align: 'center' });
  doc.text('Situs Resmi: www.sman1-jakarta.sch.id • Email: info@sman1jkt.sch.id', 105, 30, { align: 'center' });

  // Document Title
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAPORAN CAPAIAN HASIL BELAJAR SISWA (RAPORT)', 105, 48, { align: 'center' });
  
  // Double divider line under Title
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  doc.line(15, 52, 195, 52);
  doc.line(15, 53, 195, 53);

  // --- Metadata info ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Left meta
  doc.text('Nama Siswa', 15, 62);
  doc.text('NISN', 15, 68);
  doc.text('Jenis Kelamin', 15, 74);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${student.name.toUpperCase()}`, 42, 62);
  doc.text(`: ${student.nisn}`, 42, 68);
  doc.text(`: ${student.gender}`, 42, 74);

  // Right meta
  doc.setFont('helvetica', 'normal');
  doc.text('Kelas Binaan', 120, 62);
  doc.text('Semester/Tipe', 120, 68);
  doc.text('Tahun Ajaran', 120, 74);

  doc.setFont('helvetica', 'bold');
  doc.text(`: ${profile.className}`, 148, 62);
  doc.text(': II (Dua) / Genap', 148, 68);
  doc.text(`: ${profile.academicYear}`, 148, 74);

  // --- Grades Table ---
  const tableTop = 84;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  // Table Header Background
  doc.setFillColor(235, 240, 255);
  doc.rect(15, tableTop, 180, 10, 'F');

  // Header borders & Text
  doc.rect(15, tableTop, 180, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 40, 142);
  doc.text('NO', 20, tableTop + 6.5, { align: 'center' });
  doc.text('MATA PELAJARAN', 30, tableTop + 6.5);
  doc.text('KKM', 115, tableTop + 6.5, { align: 'center' });
  doc.text('NILAI AKHIR', 142, tableTop + 6.5, { align: 'center' });
  doc.text('PREDIKAT', 178, tableTop + 6.5, { align: 'center' });

  // Rows data
  const subjects = [
    { label: 'Matematika (Wajib)', score: mGrades.matematika },
    { label: 'Ilmu Pengetahuan Alam (IPA / Sains)', score: mGrades.ipa },
    { label: 'Ilmu Pengetahuan Sosial (IPS / Sosial)', score: mGrades.ips },
    { label: 'Bahasa dan Sastra Indonesia', score: mGrades.bahasaIndonesia },
    { label: 'Bahasa Inggris (Peminatan)', score: mGrades.bahasaInggris }
  ];

  doc.setTextColor(40, 40, 40);
  let currentY = tableTop + 10;
  subjects.forEach((subj, index) => {
    // Alternate row bg
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(15, currentY, 180, 10, 'F');
    }
    
    doc.rect(15, currentY, 180, 10);
    
    doc.setFont('helvetica', 'normal');
    // Draw cells
    doc.text((index + 1).toString(), 20, currentY + 6.5, { align: 'center' });
    doc.text(subj.label, 30, currentY + 6.5);
    doc.text('75.0', 115, currentY + 6.5, { align: 'center' });
    
    // Bold score
    doc.setFont('helvetica', 'bold');
    doc.text(subj.score.toString(), 142, currentY + 6.5, { align: 'center' });
    
    const letter = getGradeLetter(subj.score);
    doc.text(letter, 178, currentY + 6.5, { align: 'center' });

    currentY += 10;
  });

  // Average Row
  doc.setFillColor(245, 245, 247);
  doc.rect(15, currentY, 180, 11, 'F');
  doc.rect(15, currentY, 180, 11);
  
  doc.setFont('helvetica', 'bold');
  doc.text('RATA-RATA NILAI AKHIR CAPAIAN', 30, currentY + 7);
  doc.text('75.0', 115, currentY + 7, { align: 'center' });
  doc.setTextColor(0, 40, 142);
  doc.setFontSize(10);
  doc.text(average.toFixed(1), 142, currentY + 7, { align: 'center' });
  
  const classLetter = getGradeLetter(average);
  doc.text(classLetter, 178, currentY + 7, { align: 'center' });

  // Notes box
  const notesTop = currentY + 17;
  doc.setFillColor(240, 245, 255);
  doc.setDrawColor(200, 215, 255);
  doc.rect(15, notesTop, 180, 20, 'FD');
  
  doc.setFontSize(8.5);
  doc.setTextColor(0, 42, 110);
  doc.setFont('helvetica', 'bold');
  doc.text('CATATAN KHUSUS WALI KELAS:', 20, notesTop + 6);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  const commentText = `Siswa dengan nama ${student.name} telah meyelesaikan semester genap dengan raihan rata-rata ${average.toFixed(1)} berkategori "${getGradeText(classLetter)}". Tetap pertahankan nilai ini untuk memperpanjang peluang beasiswa atau jalur undangan PTN.`;
  const splitComment = doc.splitTextToSize(commentText, 170);
  doc.text(splitComment, 20, notesTop + 11);

  // Signatures
  const footerY = notesTop + 32;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  
  // Left signature
  doc.text('Mengetahui,', 15, footerY);
  doc.text('Orang Tua / Wali Murid,', 15, footerY + 5);
  doc.setDrawColor(120, 120, 120);
  doc.line(15, footerY + 28, 70, footerY + 28);
  doc.setFont('helvetica', 'bold');
  doc.text(student.parentName.toUpperCase(), 15, footerY + 32);

  // Right signature
  doc.setFont('helvetica', 'normal');
  doc.text('Jakarta, 11 Juni 2026', 135, footerY);
  doc.text('Guru Wali Kelas,', 135, footerY + 5);
  doc.line(135, footerY + 28, 190, footerY + 28);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.name.toUpperCase(), 135, footerY + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NIP. 19840211 201101 1003', 135, footerY + 36);

  // Save PDF
  const safeName = student.name.toLowerCase().replace(/\s+/g, '_');
  doc.save(`raport_${safeName}_${student.nisn}.pdf`);
};

/**
 * Downloads the overall Class Grade report table as PDF
 */
export const downloadClassGradesReportPDF = (
  students: Student[],
  grades: StudentGrade[],
  profile: UserProfile,
  classAverage: number
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Border bounds
  doc.setDrawColor(0, 40, 142);
  doc.setLineWidth(1);
  doc.rect(5, 5, 287, 200);

  // Header Band
  doc.setFillColor(0, 40, 142);
  doc.rect(5, 5, 287, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ADMINISTRASI AKADEMIK SEKOLAH MENENGAH ATAS', 148, 11, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`DAFTAR REKAPITULASI RAPORT NILAI KELAS - ${profile.className.toUpperCase()}`, 148, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${profile.school} • Tahun Ajaran ${profile.academicYear} • Wali Kelas: ${profile.name}`, 148, 24, { align: 'center' });

  // Metadata block
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DAFTAR MUTASI NILAI SEMESTER GENAP', 15, 40);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Waktu Cetak: ${new Date().toLocaleDateString('id-ID')} • Jam: ${new Date().toLocaleTimeString('id-ID')} WIB`, 15, 45);
  doc.text(`Total Siswa Binaan: ${students.length} Orang  •  Nilai Klasifikasi Rata-Rata Kelas: ${classAverage}`, 15, 49);

  // Table construction
  const tableTop = 54;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  // Header Row background
  doc.setFillColor(235, 240, 255);
  doc.rect(15, tableTop, 267, 10, 'F');
  doc.rect(15, tableTop, 267, 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 40, 142);
  doc.text('NO', 20, tableTop + 6.5, { align: 'center' });
  doc.text('NAMA LENGKAP SISWA', 30, tableTop + 6.5);
  doc.text('NISN', 105, tableTop + 6.5);
  doc.text('MTK', 140, tableTop + 6.5, { align: 'center' });
  doc.text('IPA', 158, tableTop + 6.5, { align: 'center' });
  doc.text('IPS', 176, tableTop + 6.5, { align: 'center' });
  doc.text('B.IND', 194, tableTop + 6.5, { align: 'center' });
  doc.text('B.ING', 212, tableTop + 6.5, { align: 'center' });
  doc.text('RATA-RATA', 236, tableTop + 6.5, { align: 'center' });
  doc.text('PREDIKAT', 264, tableTop + 6.5, { align: 'center' });

  let currentY = tableTop + 10;
  doc.setTextColor(50, 50, 50);

  students.forEach((student, index) => {
    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(15, currentY, 267, 9, 'F');
    }
    doc.rect(15, currentY, 267, 9);

    const sGrade = grades.find(g => g.studentId === student.id)?.grades || {
      matematika: 0, ipa: 0, ips: 0, bahasaIndonesia: 0, bahasaInggris: 0
    };
    
    const sAvg = (sGrade.matematika + sGrade.ipa + sGrade.ips + sGrade.bahasaIndonesia + sGrade.bahasaInggris) / 5;
    const letter = getGradeLetter(sAvg);

    doc.setFont('helvetica', 'normal');
    doc.text((index + 1).toString(), 20, currentY + 6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(student.name, 30, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(student.nisn, 105, currentY + 6);
    
    doc.setFont('helvetica', 'bold');
    doc.text(sGrade.matematika.toString(), 140, currentY + 6, { align: 'center' });
    doc.text(sGrade.ipa.toString(), 158, currentY + 6, { align: 'center' });
    doc.text(sGrade.ips.toString(), 176, currentY + 6, { align: 'center' });
    doc.text(sGrade.bahasaIndonesia.toString(), 194, currentY + 6, { align: 'center' });
    doc.text(sGrade.bahasaInggris.toString(), 212, currentY + 6, { align: 'center' });
    
    doc.setTextColor(0, 40, 142);
    doc.text(sAvg.toFixed(1), 236, currentY + 6, { align: 'center' });
    doc.setTextColor(50, 50, 50);
    doc.text(letter, 264, currentY + 6, { align: 'center' });

    currentY += 9;
  });

  // Overall class Average Row
  doc.setFillColor(240, 245, 255);
  doc.rect(15, currentY, 267, 10, 'F');
  doc.rect(15, currentY, 267, 10);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 40, 142);
  doc.text('RATA-RATA KOMPARATIF KELAS', 30, currentY + 6.5);
  doc.text(classAverage.toFixed(1), 236, currentY + 6.5, { align: 'center' });
  doc.text(getGradeLetter(classAverage), 264, currentY + 6.5, { align: 'center' });

  // Signatures on landscape
  const footerY = currentY + 18;
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  
  doc.text('Mengetahui / Mengesahkan,', 15, footerY);
  doc.text('Kepala Sekolah SMA Negeri 1', 15, footerY + 4);
  doc.line(15, footerY + 20, 80, footerY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text('DR. HENDRA WIJAYA, M.PD', 15, footerY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. 19760912 200210 1004', 15, footerY + 28);

  doc.text(`Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 205, footerY);
  doc.text(`Guru Wali Kelas ${profile.className},`, 205, footerY + 4);
  doc.line(205, footerY + 20, 270, footerY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.name.toUpperCase(), 205, footerY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. 19840211 201101 1003', 205, footerY + 28);

  doc.save(`rekap_nilai_kelas_${profile.className.toLowerCase().replace(/\s+/g, '_')}.pdf`);
};

/**
 * Downloads the Class Attendance roster sheets as PDF
 */
export const downloadClassAttendanceReportPDF = (
  students: Student[],
  activeDay: AttendanceDay,
  profile: UserProfile,
  stats: { hadir: number, sakit: number, izin: number, absen: number, percent: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Border bounds
  doc.setDrawColor(0, 40, 142);
  doc.setLineWidth(1);
  doc.rect(5, 5, 200, 287);

  // Header Box
  doc.setFillColor(0, 40, 142);
  doc.rect(5, 5, 200, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PELAPORAN PRESENSI HARIAN SISWA', 105, 11, { align: 'center' });
  doc.setFontSize(13);
  doc.text(`REKAP ABSENSI KELAS ${profile.className.toUpperCase()}`, 105, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${profile.school} • Tahun Ajaran ${profile.academicYear}`, 105, 23, { align: 'center' });

  // Set parameters
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('BERKAS DOKUMEN REKAPITULASI PRESENSI', 15, 40);

  // Metadata block
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Tanggal Absensi', 15, 47);
  doc.text('Wali Kelas', 15, 52);
  doc.text('Kemantapan Kehadiran', 15, 57);

  const formatIDDate = (dateStr: string) => {
    try {
      const parsed = new Date(dateStr);
      return parsed.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.text(`: ${formatIDDate(activeDay.date)}`, 45, 47);
  doc.text(`: ${profile.name}`, 45, 52);
  doc.text(`: ${stats.percent}% (${stats.hadir} Hadir, ${stats.sakit} Sakit, ${stats.izin} Izin, ${stats.absen} Alpha)`, 45, 57);

  // Table setup
  const tableTop = 64;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  // Table Header Box
  doc.setFillColor(240, 240, 243);
  doc.rect(15, tableTop, 180, 10, 'F');
  doc.rect(15, tableTop, 180, 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 40, 142);
  doc.text('NO', 22, tableTop + 6.5, { align: 'center' });
  doc.text('NAMA LENGKAP SISWA', 32, tableTop + 6.5);
  doc.text('NISN', 105, tableTop + 6.5);
  doc.text('GENDER', 140, tableTop + 6.5);
  doc.text('STATUS PRESENSI', 178, tableTop + 6.5, { align: 'center' });

  let currentY = tableTop + 10;
  doc.setTextColor(50, 50, 50);

  students.forEach((student, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(252, 252, 254);
      doc.rect(15, currentY, 180, 9, 'F');
    }
    doc.rect(15, currentY, 180, 9);

    const status = activeDay.records[student.id] || 'hadir';
    let label = 'HADIR';
    if (status === 'sakit') label = 'SAKIT';
    else if (status === 'izin') label = 'IZIN';
    else if (status === 'absen') label = 'ALPA';

    doc.setFont('helvetica', 'normal');
    doc.text((index + 1).toString(), 22, currentY + 6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(student.name, 32, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(student.nisn, 105, currentY + 6);
    doc.text(student.gender, 140, currentY + 6);
    
    // Custom label style based on status
    if (status === 'hadir') {
      doc.setTextColor(16, 124, 65); // Emerald-ish green
    } else if (status === 'sakit') {
      doc.setTextColor(180, 110, 0); // Amber
    } else if (status === 'izin') {
      doc.setTextColor(30, 40, 150); // Royal blue
    } else {
      doc.setTextColor(180, 30, 30); // Red
    }
    doc.setFont('helvetica', 'bold');
    doc.text(label, 178, currentY + 6, { align: 'center' });
    doc.setTextColor(50, 50, 50);

    currentY += 9;
  });

  // Summary box
  const summaryTop = currentY + 8;
  doc.setFillColor(245, 245, 247);
  doc.rect(15, summaryTop, 180, 16, 'F');
  doc.rect(15, summaryTop, 180, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CATATAN PRESENSI INTEGRAL:', 18, summaryTop + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rasio kehadiran kelas XI MIPA 2 berjalan sangat andal yaitu ${stats.percent}%. Mohon surat keterangan sakit/izin`, 18, summaryTop + 10);
  doc.text('diarsipkan secara tertulis untuk pemenuhan kelayakan ujian nasional.', 18, summaryTop + 14);

  // Signatures
  const footerY = summaryTop + 24;
  doc.setFontSize(9);
  
  doc.text('Piket Harian Jurusan,', 15, footerY);
  doc.text('Staf Kesiswaan SMAN 1,', 15, footerY + 4);
  doc.line(15, footerY + 22, 70, footerY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('TRIO ATMADJA, S.PD', 15, footerY + 26);

  doc.setFont('helvetica', 'normal');
  doc.text('Jakarta, 11 Juni 2026', 135, footerY);
  doc.text('Guru Wali Kelas,', 135, footerY + 4);
  doc.line(135, footerY + 22, 190, footerY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.name.toUpperCase(), 135, footerY + 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('NIP. 19840211 201101 1003', 135, footerY + 30);

  doc.save(`absensi_kelas_${profile.className.toLowerCase().replace(/\s+/g, '_')}_${activeDay.date}.pdf`);
};

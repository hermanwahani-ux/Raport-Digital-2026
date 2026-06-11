/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, StudentGrade, Announcement, AttendanceDay, UserProfile } from './types';

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    name: 'Aditya Pratama',
    gender: 'Laki-laki',
    nisn: '0087452391',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email: 'aditya.pratama@sekolah.sch.id',
    parentName: 'Hendra Pratama',
    parentPhone: '0812-3456-7890'
  },
  {
    id: 'std-2',
    name: 'Bunga Lestari',
    gender: 'Perempuan',
    nisn: '0089221143',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    email: 'bunga.lestari@sekolah.sch.id',
    parentName: 'Siti Lestari',
    parentPhone: '0813-9876-5432'
  },
  {
    id: 'std-3',
    name: 'Candra Wijaya',
    gender: 'Laki-laki',
    nisn: '0076554421',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    email: 'candra.wijaya@sekolah.sch.id',
    parentName: 'Budi Wijaya',
    parentPhone: '0811-2233-4455'
  },
  {
    id: 'std-4',
    name: 'Dian Sastrowardoyo',
    gender: 'Perempuan',
    nisn: '0081234567',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    email: 'dian.sastro@sekolah.sch.id',
    parentName: 'Ahmad Sastro',
    parentPhone: '0812-7788-9900'
  },
  {
    id: 'std-5',
    name: 'Eko Sulistyo',
    gender: 'Laki-laki',
    nisn: '0088765432',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    email: 'eko.sulistyo@sekolah.sch.id',
    parentName: 'Tri Sulistyo',
    parentPhone: '0815-5566-7788'
  },
  {
    id: 'std-6',
    name: 'Fitriani Handayani',
    gender: 'Perempuan',
    nisn: '0091122334',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    email: 'fitriani.h@sekolah.sch.id',
    parentName: 'Agus Handayani',
    parentPhone: '0877-1122-3344'
  },
  {
    id: 'std-7',
    name: 'Gilang Ramadhan',
    gender: 'Laki-laki',
    nisn: '0079988776',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    email: 'gilang.r@sekolah.sch.id',
    parentName: 'Rudi Ramadhan',
    parentPhone: '0813-4455-6677'
  },
  {
    id: 'std-8',
    name: 'Hana Alifah',
    gender: 'Perempuan',
    nisn: '0083344556',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    email: 'hana.alifah@sekolah.sch.id',
    parentName: 'Deni Alifah',
    parentPhone: '0812-9900-1122'
  }
];

export const INITIAL_GRADES: StudentGrade[] = [
  {
    studentId: 'std-1',
    grades: { matematika: 85, ipa: 82, ips: 78, bahasaIndonesia: 90, bahasaInggris: 88 }
  },
  {
    studentId: 'std-2',
    grades: { matematika: 92, ipa: 95, ips: 88, bahasaIndonesia: 94, bahasaInggris: 91 }
  },
  {
    studentId: 'std-3',
    grades: { matematika: 75, ipa: 78, ips: 82, bahasaIndonesia: 80, bahasaInggris: 76 }
  },
  {
    studentId: 'std-4',
    grades: { matematika: 98, ipa: 96, ips: 92, bahasaIndonesia: 98, bahasaInggris: 95 }
  },
  {
    studentId: 'std-5',
    grades: { matematika: 65, ipa: 70, ips: 72, bahasaIndonesia: 78, bahasaInggris: 68 }
  },
  {
    studentId: 'std-6',
    grades: { matematika: 80, ipa: 84, ips: 85, bahasaIndonesia: 88, bahasaInggris: 82 }
  },
  {
    studentId: 'std-7',
    grades: { matematika: 88, ipa: 85, ips: 80, bahasaIndonesia: 84, bahasaInggris: 90 }
  },
  {
    studentId: 'std-8',
    grades: { matematika: 90, ipa: 88, ips: 86, bahasaIndonesia: 92, bahasaInggris: 94 }
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Persiapan Ujian Akhir Semester (UAS) Genap',
    content: 'Diberitahukan kepada seluruh orang tua dan siswa kelas XI MIPA 2 bahwa UAS Genap akan dilaksanakan mulai tanggal 15 Juni 2026. Mohon untuk memastikan putra-putrinya mempersiapkan diri dengan belajar di rumah serta menyelesaikan semua tugas administrasi kelas yang masih tertinggal. Jadwal lengkap ujian dapat diunduh di dashboard masing-masing.',
    date: '2026-06-10',
    category: 'urgent',
    target: 'semua'
  },
  {
    id: 'ann-2',
    title: 'Rapat Koordinasi Wali Murid dan Guru',
    content: 'Undangan resmi menghadiri Musyawarah Kelas XI MIPA 2 yang akan diadakan hari Sabtu ini pukul 09.00 - 11.00 WIB bertempat di Aula Sekolah. Agenda rapat adalah presentasi program kemajuan rapor tengah semester, kesiapan ujian, dan sosialisasi tabungan kelas.',
    date: '2026-06-08',
    category: 'akademik',
    target: 'ortu'
  },
  {
    id: 'ann-3',
    title: 'Pelaksanaan Kerja Bakti & Kebersihan Kelas',
    content: 'Sesuai dengan gerakan Sekolah Sehat, siswa kelas XI MIPA 2 diwajibkan membawa peralatan kebersihan (lap, kemoceng, atau sapu) pada hari Jumat pagi untuk kegiatan renovasi taman kelas dan pembersihan sudut belajar bersama.',
    date: '2026-06-05',
    category: 'umum',
    target: 'siswa'
  }
];

export const INITIAL_ATTENDANCE: AttendanceDay[] = [
  {
    date: '2026-06-10',
    records: {
      'std-1': 'hadir',
      'std-2': 'hadir',
      'std-3': 'izin',
      'std-4': 'hadir',
      'std-5': 'hadir',
      'std-6': 'hadir',
      'std-7': 'sakit',
      'std-8': 'hadir'
    }
  },
  {
    date: '2026-06-11',
    records: {
      'std-1': 'hadir',
      'std-2': 'hadir',
      'std-3': 'hadir',
      'std-4': 'hadir',
      'std-5': 'absen',
      'std-6': 'hadir',
      'std-7': 'hadir',
      'std-8': 'hadir'
    }
  }
];

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Herman Wahani',
  role: 'Guru Wali Kelas XI MIPA 2',
  school: 'SMA Negeri 1 Jakarta',
  className: 'XI MIPA 2',
  academicYear: '2025/2026',
  avatar: '', // We will bind the generated asset dynamically in App
  email: 'herman@sekolah.sch.id'
};

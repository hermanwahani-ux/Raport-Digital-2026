/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  id: string;
  name: string;
  gender: 'Laki-laki' | 'Perempuan';
  nisn: string;
  avatar: string;
  email: string;
  parentName: string;
  parentPhone: string;
  className?: string;
}

export interface SubjectGrades {
  muatanUmum: number;
  muatanKejuruan: number;
  mataPelajaranPilihan: number;
  kokurikuler: number;
}

export interface StudentGrade {
  studentId: string;
  grades: SubjectGrades;
}

export type AnnouncementCategory = 'urgent' | 'umum' | 'akademik';
export type AnnouncementTarget = 'ortu' | 'siswa' | 'semua';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: AnnouncementCategory;
  target: AnnouncementTarget;
}

export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'absen';

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  records: {
    [studentId: string]: AttendanceStatus;
  };
}

export interface UserProfile {
  name: string;
  role: string;
  school: string;
  className: string;
  academicYear: string;
  avatar: string;
  email: string;
}

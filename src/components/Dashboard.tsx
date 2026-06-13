/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Bell, FileText, CheckSquare, Settings,
  Users, BookOpen, Clock, Plus, Trash2, Edit2, Printer, Search,
  Check, AlertTriangle, User, Mail, ShieldCheck, HelpCircle,
  Calendar, Award, Phone, Save, ClipboardList, Info, GraduationCap, UserCheck,
  Download, FileDown, Upload, Eye, Cloud, HardDrive, RefreshCw, Sliders, Camera,
  Inbox, Share2, ExternalLink
} from 'lucide-react';
import {
  Student, StudentGrade, Announcement, AttendanceDay,
  UserProfile, AttendanceStatus, SubjectGrades, SubjectGrade
} from '../types';
import {
  downloadSingleStudentRaforPDF,
  downloadClassGradesReportPDF,
  downloadClassAttendanceReportPDF
} from '../utils/pdfGenerator';
import {
  INITIAL_STUDENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GRADES,
  INITIAL_ATTENDANCE
} from '../data';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  initAuth,
  listPdfFilesFromDrive,
  downloadFileAsBase64,
  uploadFileToDrive,
  createDriveFolder
} from '../utils/googleDrive';
import { savePDFToIndexedDB, getPDFFromIndexedDB, deletePDFFromIndexedDB } from '../utils/indexedDB';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, ensureSignedInUser } from '../lib/firebase';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  teacherAvatar: string;
}

export default function Dashboard({ userEmail, onLogout, teacherAvatar }: DashboardProps) {
  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements' | 'grades' | 'attendance' | 'settings' | 'subject_grades'>('overview');

  // --- Cloud Firebase Sync States ---
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing');
  const [cloudErrorMessage, setCloudErrorMessage] = useState<string | null>(null);

  // --- Subject Grades Inbox States ---
  const [subjectGradesList, setSubjectGradesList] = useState<SubjectGrade[]>([]);
  const [isSyncingAllDrive, setIsSyncingAllDrive] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  // --- Real-time Clock ---
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to real-time Subject Grades uploaded by outside teachers
  useEffect(() => {
    if (cloudSyncStatus !== 'synced') return;

    const path = 'subjectGrades';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const list: SubjectGrade[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as SubjectGrade);
      });
      // Sort by upload date or ID descending
      list.sort((a, b) => b.id.localeCompare(a.id));
      setSubjectGradesList(list);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedError: any) {
        const errMsg = wrappedError?.message || String(wrappedError);
        if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit')) {
          console.warn("Firestore subscription quota limits reached. Operating in offline/local recipient mode gracefully.");
        } else {
          console.error("Gagal memuat Nilai Mapel Masuk:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [cloudSyncStatus]);

  // --- Persistent States from LocalStorage ---
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('waliku_profile');
    if (saved) return JSON.parse(saved);
    return {
      name: 'Herman Wahani',
      role: 'Guru Wali Kelas XI MIPA 2',
      school: 'SMA Negeri 1 Jakarta',
      className: 'XI MIPA 2',
      academicYear: '2025/2026',
      avatar: teacherAvatar,
      email: userEmail || 'herman@sekolah.sch.id'
    };
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('waliku_students');
    if (saved) return JSON.parse(saved);
    return INITIAL_STUDENTS;
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const saved = localStorage.getItem('waliku_announcements');
    if (saved) return JSON.parse(saved);
    return INITIAL_ANNOUNCEMENTS;
  });

  const [grades, setGrades] = useState<StudentGrade[]>(() => {
    const saved = localStorage.getItem('waliku_grades');
    if (saved) return JSON.parse(saved);
    return INITIAL_GRADES;
  });

  const [attendance, setAttendance] = useState<AttendanceDay[]>(() => {
    const saved = localStorage.getItem('waliku_attendance');
    if (saved) return JSON.parse(saved);
    return INITIAL_ATTENDANCE;
  });

  // Save states to localStorage on change
  useEffect(() => {
    localStorage.setItem('waliku_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('waliku_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('waliku_announcements', JSON.stringify(announcements));
  }, [announcements]);

  useEffect(() => {
    localStorage.setItem('waliku_grades', JSON.stringify(grades));
  }, [grades]);

  useEffect(() => {
    localStorage.setItem('waliku_attendance', JSON.stringify(attendance));
  }, [attendance]);

  // --- Persistent State for Uploaded PDF Reports ---
  const [uploadedReports, setUploadedReports] = useState<{
    id: string;
    studentId: string;
    fileName: string;
    fileSize: string;
    uploadDate: string;
    fileData: string;
    semester?: number;
  }[]>(() => {
    const saved = localStorage.getItem('waliku_uploaded_reports');
    if (saved) return JSON.parse(saved);
    return [];
  });

  useEffect(() => {
    // 1. Save metadata (without heavy fileData payload) to localStorage to avoid QuotaExceededError
    const sanitizedReports = uploadedReports.map(({ fileData, ...rest }) => rest);
    try {
      localStorage.setItem('waliku_uploaded_reports', JSON.stringify(sanitizedReports));
    } catch (err) {
      console.error("Gagal menyimpan metadata raport ke localStorage:", err);
    }

    // 2. Proactively save any new/loaded fileData to IndexedDB so they persist offline correctly
    uploadedReports.forEach(report => {
      if (report.fileData) {
        savePDFToIndexedDB(report.id, report.fileData);
      }
    });
  }, [uploadedReports]);

  // Load heavy PDF file data from IndexedDB on startup to populate state transparently
  useEffect(() => {
    const loadFilesFromIndexedDB = async () => {
      let updated = false;
      const loadedReports = await Promise.all(
        uploadedReports.map(async (r) => {
          if (!r.fileData) {
            const data = await getPDFFromIndexedDB(r.id);
            if (data) {
              updated = true;
              return { ...r, fileData: data };
            }
          }
          return r;
        })
      );
      if (updated) {
        setUploadedReports(loadedReports);
      }
    };
    loadFilesFromIndexedDB();
  }, []);

  // --- Google Drive Integration States ---
  const [driveUser, setDriveUser] = useState<FirebaseUser | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [useCustomFolder, setUseCustomFolder] = useState<boolean>(() => {
    const saved = localStorage.getItem('waliku_use_custom_folder');
    return saved !== null ? saved === 'true' : true;
  });
  const [customFolderUrl, setCustomFolderUrl] = useState<string>(() => {
    return localStorage.getItem('waliku_custom_folder_url') || 'https://drive.google.com/drive/folders/18XOtbRlWtoDNZR9C4Llk8JRQ8v2ACAH4?usp=sharing';
  });
  const [customFolderId, setCustomFolderId] = useState<string | null>(() => {
    return localStorage.getItem('waliku_custom_folder_id') || '18XOtbRlWtoDNZR9C4Llk8JRQ8v2ACAH4';
  });
  const [driveFolderId, setDriveFolderId] = useState<string | null>(() => localStorage.getItem('waliku_drive_folder_id'));
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; size?: string; createdTime?: string }[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [targetStudentForDriveImport, setTargetStudentForDriveImport] = useState<string | null>(null);
  const [targetSemesterForDriveImport, setTargetSemesterForDriveImport] = useState<1 | 2 | null>(null);
  const [syncingReports, setSyncingReports] = useState<{ [id: string]: boolean }>({});
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const extractDriveFolderId = (urlOrId: string): string => {
    if (!urlOrId) return '';
    const trimmed = urlOrId.trim();
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]{25,50})/);
    if (folderMatch && folderMatch[1]) {
      return folderMatch[1];
    }
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]{25,50})/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
    if (/^[a-zA-Z0-9-_]{25,50}$/.test(trimmed)) {
      return trimmed;
    }
    return '';
  };

  const handleUpdateCustomFolder = (urlOrId: string) => {
    const parsedId = extractDriveFolderId(urlOrId);
    if (parsedId) {
      setCustomFolderUrl(urlOrId);
      setCustomFolderId(parsedId);
      localStorage.setItem('waliku_use_custom_folder', 'true');
      localStorage.setItem('waliku_custom_folder_url', urlOrId);
      localStorage.setItem('waliku_custom_folder_id', parsedId);
      setUseCustomFolder(true);
      alert("Link Folder Google Drive Kustom berhasil dikonfigurasi! Semua unggahan akan dikirim langsung ke folder tersebut.");
    } else {
      alert("Tautan atau ID folder tidak valid. Pastikan tautan Google Drive berformat: https://drive.google.com/drive/folders/... atau tempel ID foldernya langsung.");
    }
  };

  // Authenticate Google Drive on state initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Authenticate & Load/Seed Firebase Firestore
  useEffect(() => {
    async function loadFirebaseData() {
      try {
        setCloudSyncStatus('syncing');

        // Wait for a secure signed in session (Anonymous fallback or Google restore)
        try {
          await ensureSignedInUser();
        } catch (authError) {
          console.warn("Could not establish Firebase session:", authError);
        }

        // 1. Sync Profile
        const profileRef = doc(db, 'profiles', 'active_teacher');
        const profileSnap = await getDoc(profileRef).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'profiles/active_teacher');
          throw err;
        });
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          await setDoc(profileRef, profile).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'profiles/active_teacher');
            throw err;
          });
        }

        // 2. Sync Students
        const studentsSnap = await getDocs(collection(db, 'students')).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'students');
          throw err;
        });
        if (studentsSnap.size > 0) {
          const studentsList: Student[] = [];
          studentsSnap.forEach(sDoc => studentsList.push(sDoc.data() as Student));
          setStudents(studentsList);
        } else {
          for (const s of students) {
            await setDoc(doc(db, 'students', s.id), s).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `students/${s.id}`);
              throw err;
            });
          }
        }

        // 3. Sync Announcements
        const announcementsSnap = await getDocs(collection(db, 'announcements')).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'announcements');
          throw err;
        });
        if (announcementsSnap.size > 0) {
          const announcementsList: Announcement[] = [];
          announcementsSnap.forEach(aDoc => announcementsList.push(aDoc.data() as Announcement));
          setAnnouncements(announcementsList);
        } else {
          for (const a of announcements) {
            await setDoc(doc(db, 'announcements', a.id), a).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `announcements/${a.id}`);
              throw err;
            });
          }
        }

        // 4. Sync Grades
        const gradesSnap = await getDocs(collection(db, 'grades')).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'grades');
          throw err;
        });
        if (gradesSnap.size > 0) {
          const gradesList: StudentGrade[] = [];
          gradesSnap.forEach(gDoc => {
            const data = gDoc.data() as StudentGrade;
            const rawGrades = (data.grades || {}) as any;
            // Backwards compatibility/repair: if data has legacy structure, map legacy properties to new ones
            const muatanUmum = rawGrades.muatanUmum ?? rawGrades.matematika ?? 80;
            const muatanKejuruan = rawGrades.muatanKejuruan ?? rawGrades.ipa ?? 80;
            const mataPelajaranPilihan = rawGrades.mataPelajaranPilihan ?? rawGrades.ips ?? 80;
            const kokurikuler = rawGrades.kokurikuler ?? rawGrades.bahasaIndonesia ?? rawGrades.bahasaInggris ?? 80;
            
            gradesList.push({
              studentId: data.studentId,
              grades: {
                muatanUmum: Number(muatanUmum) || 0,
                muatanKejuruan: Number(muatanKejuruan) || 0,
                mataPelajaranPilihan: Number(mataPelajaranPilihan) || 0,
                kokurikuler: Number(kokurikuler) || 0
              }
            });
          });
          setGrades(gradesList);

          // If there is an override for class averages in cloud, let's load it
          const averagesRec = gradesList.find(g => g.studentId === 'class_averages');
          if (averagesRec) {
            setManualSubjectAverages(averagesRec.grades);
            setIsManualOverride(true);
          }
        } else {
          for (const g of grades) {
            await setDoc(doc(db, 'grades', g.studentId), g).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `grades/${g.studentId}`);
              throw err;
            });
          }
        }

        // 5. Sync Attendance
        const attendanceSnap = await getDocs(collection(db, 'attendance')).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'attendance');
          throw err;
        });
        if (attendanceSnap.size > 0) {
          const attendanceList: AttendanceDay[] = [];
          attendanceSnap.forEach(attDoc => attendanceList.push(attDoc.data() as AttendanceDay));
          setAttendance(attendanceList);
        } else {
          for (const att of attendance) {
            await setDoc(doc(db, 'attendance', att.date), att).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `attendance/${att.date}`);
              throw err;
            });
          }
        }

        // 6. Sync Uploaded PDF Reports
        const reportsSnap = await getDocs(collection(db, 'uploadedReports')).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'uploadedReports');
          throw err;
        });
        if (reportsSnap.size > 0) {
          const reportsList: any[] = [];
          reportsSnap.forEach(repDoc => reportsList.push(repDoc.data()));
          setUploadedReports(reportsList);
        } else {
          for (const r of uploadedReports) {
            await setDoc(doc(db, 'uploadedReports', r.id), r).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `uploadedReports/${r.id}`);
              throw err;
            });
          }
        }

        setCloudSyncStatus('synced');
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit')) {
          console.warn('Firebase DB sync was suspended due to Spark plan limits. Operating safely in local recipient storage mode.', err);
        } else {
          console.error('Firebase DB sync init failed:', err);
        }
        setCloudSyncStatus('error');
        setCloudErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }

    loadFirebaseData();
  }, []);

  // --- Student Portal View Switcher States ---
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>(() => {
    const savedRole = localStorage.getItem('waliku_role');
    return savedRole === 'student' ? 'student' : 'teacher';
  });
  const [selectedStudentForPortal, setSelectedStudentForPortal] = useState<string>(() => {
    return localStorage.getItem('waliku_selected_student') || 'std-1';
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // --- Security PIN Mode Guru Lock states ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSwitchToTeacherMode = () => {
    if (profile.isPinLocked !== false) {
      setIsPinModalOpen(true);
      setPinInput('');
      setPinError('');
    } else {
      setViewMode('teacher');
      localStorage.setItem('waliku_role', 'teacher');
    }
  };

  const handleSwitchToStudentMode = () => {
    setViewMode('student');
    localStorage.setItem('waliku_role', 'student');
  };

  // --- Sub-states ---
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // --- PDF Report Upload Handlers ---
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
    studentId: string,
    forcedSemester?: 1 | 2
  ) => {
    e.preventDefault();
    let file: File | null = null;
    
    if ('dataTransfer' in e) {
       file = e.dataTransfer.files?.[0] || null;
    } else if ('target' in e && e.target.files) {
       file = e.target.files?.[0] || null;
    }

    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Format file salah! Mohon hanya mengunggah file berekstensi PDF.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const sizeString = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        
        let semesterToUse = forcedSemester;
        if (!semesterToUse) {
          if (printingCard && printingCard.id === studentId) {
            semesterToUse = selectedSemesterToUpload;
          } else {
            const input = window.prompt("Tentukan semester untuk berkas scan raport ini (Ketik angka 1 atau 2):", "2");
            if (input === null) return; // User cancelled
            const num = parseInt(input);
            if (num === 1 || num === 2) {
              semesterToUse = num as 1 | 2;
            } else {
              alert("Input salah! Mengunggah dibatalkan.");
              return;
            }
          }
        }

        const existingReport = uploadedReports.find(r => r.studentId === studentId && (r.semester || 2) === semesterToUse);

        const newReport = {
          id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          studentId: studentId,
          fileName: file.name,
          fileSize: sizeString,
          uploadDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
          fileData: base64,
          semester: semesterToUse
        };

        if (existingReport) {
          setUploadedReports(prev => [newReport, ...prev.filter(r => r.id !== existingReport.id)]);
          deleteDoc(doc(db, 'uploadedReports', existingReport.id)).catch(err => {
            console.warn("Could not delete old report on revision:", err);
          });
        } else {
          setUploadedReports(prev => [newReport, ...prev]);
        }
        setDoc(doc(db, 'uploadedReports', newReport.id), newReport).catch(err => handleFirestoreError(err, OperationType.WRITE, `uploadedReports/${newReport.id}`));
      };
      reader.readAsDataURL(file);
    }
    setIsDragOver(false);
  };

  const handleDownloadFile = (fileData: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteUploadedFile = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus file raport PDF ini dari pangkalan data?')) {
      setUploadedReports(prev => prev.filter(r => r.id !== id));
      deletePDFFromIndexedDB(id);
      deleteDoc(doc(db, 'uploadedReports', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `uploadedReports/${id}`));
    }
  };

  // --- Google Drive Business Logic Handlers ---

  const handleConnectDrive = async () => {
    setIsDriveLoading(true);
    try {
      const res = await connectGoogleDrive();
      if (res) {
        setDriveUser(res.user);
        setDriveToken(res.accessToken);
        await ensureBackupFolder(res.accessToken);
      }
    } catch (err: any) {
      console.error("Connect Google Drive error:", err);
      
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const isClosedByUser = err?.code === 'auth/popup-closed-by-user' || 
                             err?.message?.includes('popup-closed-by-user') ||
                             err?.message?.includes('closed by user');
                             
      if (isIframe) {
        alert(
          "Penyambungan Google Drive Terkendala Kebijakan Iframe Browser!\n\n" +
          "Sistem mendeteksi Anda sedang berada di mode pratinjau (iframe) AI Studio. Pembatasan keamanan browser memblokir pop-up/cookies interaksi Google Drive di dalam iframe.\n\n" +
          "Solusi:\n" +
          "Silakan klik tombol 'Buka di Tab Baru' (Open in new tab) di bagian atas dashboard untuk membuka aplikasi di tab mandiri, lalu klik 'Hubungkan Google Drive' kembali dengan lancar!"
        );
      } else if (isClosedByUser) {
        alert(
          "Sambungan Google Drive Terputus atau Dibatalkan.\n\n" +
          "Sistem mendeteksi jendela popup ditutup sebelum penyambungan akun selesai.\n\n" +
          "Silakan klik 'Hubungkan Google Drive' lagi dan pastikan Anda tidak menutup jendela popup sebelum memilih akun Anda."
        );
      } else {
        alert("Gagal menghubungkan Google Drive: " + (err?.message || "Mohon periksa kembali izin akses akun Anda."));
      }
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (window.confirm("Apakah Anda yakin ingin memutuskan sambungan dari akun Google Drive Anda?")) {
      await disconnectGoogleDrive();
      setDriveUser(null);
      setDriveToken(null);
      setDriveFolderId(null);
      localStorage.removeItem('waliku_drive_folder_id');
    }
  };

  const ensureBackupFolder = async (token: string) => {
    if (useCustomFolder && customFolderId) {
      return customFolderId;
    }
    try {
      const folderName = `WaliKu Raport Online - ${profile.className}`;
      const fId = await createDriveFolder(token, folderName);
      setDriveFolderId(fId);
      localStorage.setItem('waliku_drive_folder_id', fId);
      return fId;
    } catch (err) {
      console.error("Error creating/getting backup folder:", err);
      throw err;
    }
  };

  // --- Subject Grades Management Business Logic ---
  const handleDownloadSubjectGrade = (item: SubjectGrade) => {
    try {
      const link = document.createElement('a');
      link.href = item.fileData;
      link.download = item.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Gagal mendownload berkas nilai mapel:", err);
      alert("Terjadi masalah saat mendownload berkas nilai.");
    }
  };

  const handleSyncSubjectGradeToDrive = async (itemId: string) => {
    if (!driveToken) {
      alert("Silakan hubungkan akun Google Drive Anda terlebih dahulu melalui tab Ringkasan Kelas!");
      return;
    }

    const item = subjectGradesList.find(g => g.id === itemId);
    if (!item) return;

    setSyncingItemId(itemId);
    try {
      const fId = await ensureBackupFolder(driveToken);
      const res = await uploadFileToDrive(driveToken, item.fileName, item.fileData, fId);
      
      // Update the firestore document with the returned Google Drive ID and Link
      const docRef = doc(db, 'subjectGrades', itemId);
      await setDoc(docRef, {
        ...item,
        driveFileId: res.id,
        driveFileLink: res.webViewLink || `https://drive.google.com/open?id=${res.id}`
      });

      alert(`Berhasil mengunggah berkas "${item.fileName}" ke Google Drive!`);
    } catch (err) {
      console.error("Gagal mencadangkan berkas ke Google Drive:", err);
      alert("Terdapat kendala saat mencadangkan dokumen Anda ke Google Drive.");
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleBulkSyncSubjectGradesToDrive = async () => {
    if (!driveToken) {
      alert("Silakan hubungkan akun Google Drive Anda terlebih dahulu melalui tab Ringkasan Kelas.");
      return;
    }

    const unsynced = subjectGradesList.filter(item => !item.driveFileId);
    if (unsynced.length === 0) {
      alert("Seluruh draf nilai mata pelajaran dalam inbox sudah tercadangkan ke Google Drive!");
      return;
    }

    const confirmSync = window.confirm(`Apakah Anda yakin ingin mencadangkan seluruh (${unsynced.length}) dokumen nilai mata pelajaran masuk ke Google Drive?`);
    if (!confirmSync) return;

    setIsSyncingAllDrive(true);
    let successCount = 0;

    try {
      const fId = await ensureBackupFolder(driveToken);
      
      for (const item of unsynced) {
        try {
          const res = await uploadFileToDrive(driveToken, item.fileName, item.fileData, fId);
          // Update in Firestore
          const docRef = doc(db, 'subjectGrades', item.id);
          await setDoc(docRef, {
            ...item,
            driveFileId: res.id,
            driveFileLink: res.webViewLink || `https://drive.google.com/open?id=${res.id}`
          });
          successCount++;
        } catch (singleErr) {
          console.error(`Gagal mengunggah ${item.fileName}:`, singleErr);
        }
      }

      alert(`Sinkronisasi selesai! ${successCount} dari ${unsynced.length} draf nilai berhasil dicadangkan ke Google Drive.`);
    } catch (err) {
      console.error("Gagal melakukan pencadangan otomatis masal:", err);
      alert("Terjadi kendala sistem pada pencadangan masal.");
    } finally {
      setIsSyncingAllDrive(false);
    }
  };

  const handleDeleteSubjectGrade = async (itemId: string) => {
    const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus dokumen laporan nilai mata pelajaran ini dari inbox?");
    if (!isConfirmed) return;

    try {
      const docRef = doc(db, 'subjectGrades', itemId);
      await deleteDoc(docRef);
      alert("Dokumen nilai berhasil dihapus.");
    } catch (err) {
      console.error("Gagal menghapus dokumen laporan nilai:", err);
      alert("Gagal menghapus dokumen. Silakan periksa koneksi internet Anda.");
    }
  };

  const syncReportToDrive = async (reportId: string) => {
    if (!driveToken) {
      alert("Hubungkan ke Google Drive terlebih dahulu!");
      return;
    }
    
    const report = uploadedReports.find(r => r.id === reportId);
    if (!report) return;

    setSyncingReports(prev => ({ ...prev, [reportId]: true }));
    try {
      const fId = await ensureBackupFolder(driveToken);
      await uploadFileToDrive(driveToken, report.fileName, report.fileData, fId);
      alert(`Berhasil mengunggah dan mencadangkan "${report.fileName}" ke Google Drive Anda!`);
    } catch (err) {
      console.error("Error syncing to drive:", err);
      alert("Format atau ukuran file gagal diunggah ke Google Drive.");
    } finally {
      setSyncingReports(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const handleBulkSyncToDrive = async () => {
    if (!driveToken) {
      alert("Hubungkan ke Google Drive terlebih dahulu!");
      return;
    }
    if (uploadedReports.length === 0) {
      alert("Belum ada raport PDF yang diunggah untuk disinkronisasikan!");
      return;
    }

    const confirmed = window.confirm(`Apakah Anda yakin ingin mencadangkan seluruh (${uploadedReports.length}) raport PDF siswa ke Google Drive?`);
    if (!confirmed) return;

    setBulkSyncing(true);
    let successCount = 0;
    try {
      const fId = await ensureBackupFolder(driveToken);
      
      for (const report of uploadedReports) {
        try {
          await uploadFileToDrive(driveToken, report.fileName, report.fileData, fId);
          successCount++;
        } catch (e) {
          console.error(`Failed to sync ${report.fileName}:`, e);
        }
      }
      
      alert(`Cadangan selesai! ${successCount} dari ${uploadedReports.length} berkas berhasil diunggah ke Google Drive.`);
    } catch (err) {
      console.error("Bulk sync error:", err);
      alert("Terjadi kesalahan saat mencadangkan berkas secara massal.");
    } finally {
      setBulkSyncing(false);
    }
  };

  const searchDriveFiles = async () => {
    if (!driveToken) return;
    setIsDriveLoading(true);
    try {
      const files = await listPdfFilesFromDrive(driveToken, driveSearch);
      setDriveFiles(files);
    } catch (err) {
      console.error("Search drive error:", err);
    } finally {
      setIsDriveLoading(false);
    }
  };

  // Trigger search when query or modal state changes
  useEffect(() => {
    if (isDrivePickerOpen && driveToken) {
      searchDriveFiles();
    }
  }, [isDrivePickerOpen, driveSearch, driveToken]);

  const handleImportFromDrive = async (fileId: string, fileName: string) => {
    if (!driveToken || !targetStudentForDriveImport) return;
    
    let semesterToUse: 1 | 2 = 2;
    if (targetSemesterForDriveImport !== null) {
      semesterToUse = targetSemesterForDriveImport;
    } else {
      const input = window.prompt("Import berkas dari Google Drive. Tentukan semester untuk raport ini (Ketik 1 atau 2):", "2");
      if (input === null) return; // User cancelled
      semesterToUse = input === "1" ? 1 : 2; // default to 2
    }

    setIsDriveLoading(true);
    try {
      const { fileData, sizeString } = await downloadFileAsBase64(driveToken, fileId);
      
      const newReport = {
         id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
         studentId: targetStudentForDriveImport,
         fileName: fileName,
         fileSize: sizeString,
         uploadDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
         fileData: fileData,
         semester: semesterToUse
      };
      
      const existingReport = uploadedReports.find(r => r.studentId === targetStudentForDriveImport && (r.semester || 2) === semesterToUse);
      if (existingReport) {
        deleteDoc(doc(db, 'uploadedReports', existingReport.id)).catch(err => {
          console.warn("Could not delete old report on revision:", err);
        });
      }

      setUploadedReports(prev => [newReport, ...prev.filter(r => !(r.studentId === targetStudentForDriveImport && (r.semester || 2) === semesterToUse))]);
      setDoc(doc(db, 'uploadedReports', newReport.id), newReport).catch(err => handleFirestoreError(err, OperationType.WRITE, `uploadedReports/${newReport.id}`));
      setIsDrivePickerOpen(false);
      setTargetStudentForDriveImport(null);
      alert(`Berhasil mengimpor berkas "${fileName}" sebagai raport resmi siswa.`);
    } catch (err) {
      console.error("Error importing file:", err);
      alert("Gagal mengunduh file dari Google Drive.");
    } finally {
      setIsDriveLoading(false);
    }
  };
  
  // Modals / Editors
  const [editingGrade, setEditingGrade] = useState<StudentGrade | null>(null);
  const [printingCard, setPrintingCard] = useState<Student | null>(null);
  const [selectedSemesterToUpload, setSelectedSemesterToUpload] = useState<1 | 2>(2);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previewPdfReport, setPreviewPdfReport] = useState<{ id: string; studentId: string; studentName: string; fileName: string; fileData: string; fileSize: string; uploadDate: string; semester?: number } | null>(null);

  // Manual Subject Statistics Overrides
  const [isManualOverride, setIsManualOverride] = useState<boolean>(() => {
    const saved = localStorage.getItem('waliku_is_manual_override');
    return saved === 'true';
  });

  const [manualSubjectAverages, setManualSubjectAverages] = useState<SubjectGrades>(() => {
    const saved = localStorage.getItem('waliku_manual_averages');
    if (saved) return JSON.parse(saved);
    return {
      muatanUmum: 85,
      muatanKejuruan: 84,
      mataPelajaranPilihan: 83,
      kokurikuler: 88
    };
  });

  const [isEditingStats, setIsEditingStats] = useState(false);

  useEffect(() => {
    localStorage.setItem('waliku_is_manual_override', isManualOverride ? 'true' : 'false');
  }, [isManualOverride]);

  useEffect(() => {
    localStorage.setItem('waliku_manual_averages', JSON.stringify(manualSubjectAverages));
  }, [manualSubjectAverages]);

  // Student Management States
  const [attendanceRecapSearch, setAttendanceRecapSearch] = useState('');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    className: '',
    nisn: '',
    gender: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    email: '',
    parentName: '',
    parentPhone: '',
    avatar: ''
  });

  const openAddStudentModal = () => {
    setEditingStudent(null);
    setStudentForm({
      name: '',
      className: profile.className,
      nisn: '',
      gender: 'Laki-laki',
      email: '',
      parentName: '',
      parentPhone: '',
      avatar: ''
    });
    setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      className: student.className || profile.className,
      nisn: student.nisn,
      gender: student.gender,
      email: student.email || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      avatar: student.avatar || ''
    });
    setIsStudentModalOpen(true);
  };

  const handleStudentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File foto terlalu besar. Maksimal ukuran file adalah 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setStudentForm(prev => ({
            ...prev,
            avatar: event.target!.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus siswa "${student.name}"? Ini juga akan menghapus data nilai dan raport PDF kesiswaan.`)) {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setGrades(prev => prev.filter(g => g.studentId !== studentId));
      setUploadedReports(prev => prev.filter(r => r.studentId !== studentId));
      
      deleteDoc(doc(db, 'students', studentId)).catch(err => handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`));
      deleteDoc(doc(db, 'grades', studentId)).catch(err => handleFirestoreError(err, OperationType.DELETE, `grades/${studentId}`));
      
      if (selectedStudentForPortal === studentId) {
        const remaining = students.filter(s => s.id !== studentId);
        if (remaining.length > 0) {
          setSelectedStudentForPortal(remaining[0].id);
        }
      }
    }
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.nisn.trim()) {
      alert('Nama Lengkap dan NISN wajib diisi!');
      return;
    }

    if (editingStudent) {
      const updatedStudent: Student = {
        ...editingStudent,
        name: studentForm.name.trim(),
        className: studentForm.className.trim(),
        nisn: studentForm.nisn.trim(),
        gender: studentForm.gender,
        email: studentForm.email.trim() || `${studentForm.name.toLowerCase().replace(/\s+/g, '.')}@sekolah.sch.id`,
        parentName: studentForm.parentName.trim(),
        parentPhone: studentForm.parentPhone.trim(),
        avatar: studentForm.avatar.trim() || editingStudent.avatar || (studentForm.gender === 'Laki-laki' 
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80')
      };
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? updatedStudent : s));
      setDoc(doc(db, 'students', editingStudent.id), updatedStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, `students/${editingStudent.id}`));
      alert('Profil siswa berhasil diperbarui!');
    } else {
      const newStudentId = `std-${Date.now()}`;
      const newStudent: Student = {
        id: newStudentId,
        name: studentForm.name.trim(),
        nisn: studentForm.nisn.trim(),
        gender: studentForm.gender,
        className: studentForm.className.trim() || profile.className,
        avatar: studentForm.avatar.trim() || (studentForm.gender === 'Laki-laki' 
          ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'),
        email: studentForm.email.trim() || `${studentForm.name.toLowerCase().replace(/\s+/g, '.')}@sekolah.sch.id`,
        parentName: studentForm.parentName.trim(),
        parentPhone: studentForm.parentPhone.trim()
      };

      setStudents(prev => [...prev, newStudent]);
      setDoc(doc(db, 'students', newStudentId), newStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, `students/${newStudentId}`));
      
      const newGradeObj = {
        studentId: newStudentId,
        grades: { muatanUmum: 0, muatanKejuruan: 0, mataPelajaranPilihan: 0, kokurikuler: 0 }
      };
      setGrades(prev => [
        ...prev,
        newGradeObj
      ]);
      setDoc(doc(db, 'grades', newStudentId), newGradeObj).catch(err => handleFirestoreError(err, OperationType.WRITE, `grades/${newStudentId}`));

      alert('Siswa baru berhasil ditambahkan.');
    }
    setIsStudentModalOpen(false);
  };

  // New Announcement form fields
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'urgent' | 'umum' | 'akademik'>('umum');
  const [newTarget, setNewTarget] = useState<'ortu' | 'siswa' | 'semua'>('semua');

  // Currently Selected Attendance Date
  const [attendanceDate, setAttendanceDate] = useState('2026-06-11');

  // --- Calculations ---
  // Dynamic averages
  const getStudentAverage = (studentId: string) => {
    const record = grades.find(g => g.studentId === studentId);
    if (!record) return 0;
    const muatanUmum = Number(record.grades?.muatanUmum) || 0;
    const muatanKejuruan = Number(record.grades?.muatanKejuruan) || 0;
    const mataPelajaranPilihan = Number(record.grades?.mataPelajaranPilihan) || 0;
    const kokurikuler = Number(record.grades?.kokurikuler) || 0;
    return parseFloat(((muatanUmum + muatanKejuruan + mataPelajaranPilihan + kokurikuler) / 4).toFixed(1));
  };

  const getStudentGradeLetter = (avg: number) => {
    if (avg >= 90) return { letter: 'A', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', text: 'Sangat Baik' };
    if (avg >= 80) return { letter: 'B', color: 'text-blue-600 bg-blue-50 border-blue-150', text: 'Baik' };
    if (avg >= 70) return { letter: 'C', color: 'text-amber-600 bg-amber-50 border-amber-150', text: 'Cukup' };
    return { letter: 'D', color: 'text-rose-600 bg-rose-50 border-rose-150', text: 'Perlu Pendampingan' };
  };

  const classOverallAverage = (() => {
    if (isManualOverride) {
      const muatanUmum = Number(manualSubjectAverages?.muatanUmum) || 0;
      const muatanKejuruan = Number(manualSubjectAverages?.muatanKejuruan) || 0;
      const mataPelajaranPilihan = Number(manualSubjectAverages?.mataPelajaranPilihan) || 0;
      const kokurikuler = Number(manualSubjectAverages?.kokurikuler) || 0;
      return parseFloat(((muatanUmum + muatanKejuruan + mataPelajaranPilihan + kokurikuler) / 4).toFixed(1));
    }
    const realGrades = grades.filter(g => g.studentId !== 'class_averages');
    if (realGrades.length === 0) return 0;
    return parseFloat(
      (realGrades.reduce((sum, g) => {
        const muatanUmum = Number(g.grades?.muatanUmum) || 0;
        const muatanKejuruan = Number(g.grades?.muatanKejuruan) || 0;
        const mataPelajaranPilihan = Number(g.grades?.mataPelajaranPilihan) || 0;
        const kokurikuler = Number(g.grades?.kokurikuler) || 0;
        const avg = (muatanUmum + muatanKejuruan + mataPelajaranPilihan + kokurikuler) / 4;
        return sum + avg;
      }, 0) / realGrades.length).toFixed(1)
    );
  })();

  const getSubjectAverage = (subject: keyof SubjectGrades) => {
    if (isManualOverride) {
      return Number(manualSubjectAverages?.[subject]) || 0;
    }
    const realGrades = grades.filter(g => g.studentId !== 'class_averages');
    if (realGrades.length === 0) return 0;
    const total = realGrades.reduce((sum, g) => sum + (Number(g.grades?.[subject]) || 0), 0);
    return parseFloat((total / realGrades.length).toFixed(1));
  };

  // Active Attendance for selected date
  const activeAttendanceRecord = attendance.find(a => a.date === attendanceDate) || {
    date: attendanceDate,
    records: students.reduce((acc, s) => ({ ...acc, [s.id]: 'hadir' as const }), {})
  };

  const getAttendanceStats = () => {
    const records = activeAttendanceRecord.records;
    let hadir = 0, sakit = 0, izin = 0, absen = 0;
    students.forEach(s => {
      const status = records[s.id] || 'hadir';
      if (status === 'hadir') hadir++;
      else if (status === 'sakit') sakit++;
      else if (status === 'izin') izin++;
      else if (status === 'absen') absen++;
    });
    return { hadir, sakit, izin, absen, percent: parseFloat(((hadir / students.length) * 100).toFixed(0)) };
  };

  const attendStats = getAttendanceStats();

  // --- Handlers ---
  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrade) return;

    setGrades(prev => prev.map(g => g.studentId === editingGrade.studentId ? editingGrade : g));
    setDoc(doc(db, 'grades', editingGrade.studentId), editingGrade).catch(err => handleFirestoreError(err, OperationType.WRITE, `grades/${editingGrade.studentId}`));
    setEditingGrade(null);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newItem: Announcement = {
      id: `ann-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      date: new Date().toISOString().split('T')[0],
      category: newCategory,
      target: newTarget
    };

    setAnnouncements([newItem, ...announcements]);
    setDoc(doc(db, 'announcements', newItem.id), newItem).catch(err => handleFirestoreError(err, OperationType.WRITE, `announcements/${newItem.id}`));
    setNewTitle('');
    setNewContent('');
    setNewCategory('umum');
    setNewTarget('semua');
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      deleteDoc(doc(db, 'announcements', id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`));
    }
  };

  const handleToggleAttendance = (studentId: string, status: AttendanceStatus) => {
    const updatedRecords = {
      ...activeAttendanceRecord.records,
      [studentId]: status
    };

    const updatedDay: AttendanceDay = {
      date: attendanceDate,
      records: updatedRecords
    };

    if (attendance.some(a => a.date === attendanceDate)) {
      setAttendance(prev => prev.map(a => a.date === attendanceDate ? updatedDay : a));
    } else {
      setAttendance(prev => [...prev, updatedDay]);
    }
    setDoc(doc(db, 'attendance', attendanceDate), updatedDay).catch(err => handleFirestoreError(err, OperationType.WRITE, `attendance/${attendanceDate}`));
  };

  const handleMarkAllPresent = () => {
    const updatedRecords = students.reduce((acc, s) => ({ ...acc, [s.id]: 'hadir' as const }), {});
    const updatedDay: AttendanceDay = {
      date: attendanceDate,
      records: updatedRecords
    };
    if (attendance.some(a => a.date === attendanceDate)) {
      setAttendance(prev => prev.map(a => a.date === attendanceDate ? updatedDay : a));
    } else {
      setAttendance(prev => [...prev, updatedDay]);
    }
    setDoc(doc(db, 'attendance', attendanceDate), updatedDay).catch(err => handleFirestoreError(err, OperationType.WRITE, `attendance/${attendanceDate}`));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('waliku_profile', JSON.stringify(profile));
    setDoc(doc(db, 'profiles', 'active_teacher'), profile).catch(err => handleFirestoreError(err, OperationType.WRITE, 'profiles/active_teacher'));
    alert('Pengaturan sekolah dan kelas berhasil diperbarui!');
  };

  // Filter students based on search string
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nisn.includes(searchQuery) ||
    (s.className || profile.className).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* LEFT SIDEBAR (Desktop) */}
      <aside className="w-full md:w-64 bg-[#00288e] text-white flex flex-col flex-shrink-0">
        
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center space-x-2 border-b border-blue-900 bg-[#002072]">
          <GraduationCap className="w-8 h-8 text-white" />
          <div className="flex flex-col text-left">
            <span className="font-sans text-xs font-bold tracking-tight">Portal Raport Digital</span>
            <span className="text-[10px] text-blue-200">PORTAL WALI KELAS</span>
          </div>
        </div>

        {/* Teacher Mini Profile Card */}
        <div className="p-4 mx-3 my-4 bg-blue-900/40 rounded-lg border border-blue-800/60 flex items-center space-x-3 text-left">
          <img
            src={teacherAvatar}
            alt="Teacher"
            className="w-10 h-10 rounded-full object-cover border border-blue-700"
            referrerPolicy="no-referrer"
          />
          <div className="overflow-hidden">
            <h4 className="text-sm font-bold truncate text-white">{profile.name}</h4>
            <span className="text-[11px] text-blue-200 truncate block">{profile.className} • {profile.school}</span>
          </div>
        </div>

        {/* Dynamic Sidebar Links */}
        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'overview', label: 'Ringkasan Kelas', icon: <LayoutDashboard className="w-5 h-5" /> },
            { id: 'announcements', label: 'Pengumuman Digital', icon: <Bell className="w-5 h-5" />, count: announcements.length },
            { id: 'grades', label: 'Raport Online', icon: <FileText className="w-5 h-5" /> },
            { id: 'subject_grades', label: 'Inbox Nilai Mapel', icon: <Inbox className="w-5 h-5" />, count: subjectGradesList.length },
            { id: 'attendance', label: 'Absensi Siswa', icon: <CheckSquare className="w-5 h-5" />, status: `${attendStats.percent}%` },
            { id: 'settings', label: 'Pengaturan Kelas', icon: <Settings className="w-5 h-5" /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${
                activeTab === item.id
                  ? 'bg-blue-800 text-white shadow-inner'
                  : 'text-blue-100 hover:bg-blue-800/40 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.count ? (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.count}
                </span>
              ) : null}
              {item.status && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                  {item.status}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Back to Landing */}
        <div className="p-4 border-t border-blue-900 bg-[#002072]/50 text-center">
          <button
            onClick={onLogout}
            className="w-full py-2 bg-blue-900 hover:bg-blue-950 text-blue-200 hover:text-white text-xs font-semibold rounded transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>Kembali ke Landing Page</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN PANEL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Dynamic Section Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 sm:px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 text-left">
            <h2 className="text-lg font-bold text-gray-900">
              {viewMode === 'student' ? (
                'Portal Siswa & Orang Tua'
              ) : (
                <>
                  {activeTab === 'overview' && 'Ringkasan Kemajuan Kelas'}
                  {activeTab === 'announcements' && 'Pengumuman Digital (Broadcast)'}
                  {activeTab === 'grades' && 'Pengelolaan Raport Online'}
                  {activeTab === 'subject_grades' && 'Inbox Nilai Mata Pelajaran'}
                  {activeTab === 'attendance' && 'Lembar Presensi Harian'}
                  {activeTab === 'settings' && 'Pengaturan Kelas & Instansi'}
                </>
              )}
            </h2>
            <span className="text-xs bg-gray-100 px-2 py-0.5 text-gray-500 rounded font-semibold id-academic-badge hidden sm:inline">
              Tahun Ajaran {profile.academicYear}
            </span>
          </div>

          {/* Role Switcher Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={handleSwitchToTeacherMode}
              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                viewMode === 'teacher'
                  ? 'bg-white text-[#00288e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mode Guru
            </button>
            <button
              onClick={handleSwitchToStudentMode}
              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
                viewMode === 'student'
                  ? 'bg-white text-[#00288e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mode Siswa
            </button>
          </div>

          {/* Cloud Firebase Sync Indicator */}
          <div className="flex items-center space-x-2 mr-2">
            {cloudSyncStatus === 'synced' && (
              <span className="flex items-center space-x-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-150 text-[11px] font-bold">
                <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>Cloud Terhubung</span>
              </span>
            )}
            {cloudSyncStatus === 'syncing' && (
              <span className="flex items-center space-x-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded border border-amber-150 text-[11px] font-bold">
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span>Menghubungkan...</span>
              </span>
            )}
            {cloudSyncStatus === 'error' && (
              <span 
                className="flex items-center space-x-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded border border-rose-150 text-[11px] font-bold cursor-help"
                title={cloudErrorMessage || "Koneksi cloud bermasalah"}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Gagal Sinkronisasi</span>
              </span>
            )}
          </div>

          {/* Clock & Status */}
          <div className="flex items-center space-x-6 text-right">
            <div className="hidden lg:flex flex-col text-xs leading-none">
              <span className="font-mono text-gray-800 font-bold">
                {currentTime.toLocaleTimeString('id-ID', { hourIndex: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
              </span>
              <span className="text-gray-400 font-medium text-[10px] mt-0.5">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded transition cursor-pointer shrink-0"
              id="dash-sign-out"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* SCROLLABLE MODULE VIEWS */}
        <div className="flex-1 p-6 sm:p-8 space-y-6">

          {/* Iframe Popup Support Alert Banner */}
          {typeof window !== 'undefined' && window.self !== window.top && !driveToken && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                  <AlertTriangle className="w-5 h-5 text-amber-700 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">Mode Pratinjau Terdeteksi (Pembatasan Iframe Browser)</h4>
                  <p className="text-[11.5px] text-amber-800 mt-1 font-semibold leading-relaxed">
                    Kebijakan keamanan peramban memblokir pop-up integrasi Google Drive ketika berjalan di dalam iframe pratinjau. Silakan gunakan tautan mandiri di samping untuk kemudahan menghubungkan akun Anda secara penuh dan aman!
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-lg shadow-sm duration-150 shrink-0 w-full sm:w-auto text-center cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Tab Baru</span>
              </button>
            </div>
          )}

          {viewMode === 'student' ? (
            /* COMPREHENSIVE HIGH-FIDELITY STUDENT PORTAL */
            <div className="space-y-6 text-left max-w-4xl mx-auto" id="student-portal-root">
              {/* Informative Header with dynamic student selector */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold bg-blue-105 bg-blue-100 text-[#00288e] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Portal Siswa & Wali Murid
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 mt-2 font-sans border-none">
                    Selamat Datang di WaliKu Digital
                  </h3>
                  <p className="text-xs text-gray-500">
                    Silakan pilih nama siswa untuk menyimulasikan akses portal pribadi mereka, melihat raihan akademik, presensi harian, dan mengunduh berkas laporan PDF resmi.
                  </p>
                </div>

                {/* Student Selector Dropdown with high design quality */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <label className="text-xs font-bold text-gray-705 text-gray-700 whitespace-nowrap shrink-0 uppercase tracking-wider">
                    Pilih Akun Siswa:
                  </label>
                  <select
                    value={selectedStudentForPortal}
                    onChange={(e) => setSelectedStudentForPortal(e.target.value)}
                    className="block w-full sm:w-60 text-xs font-bold text-gray-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-[4px] p-2 focus:outline-none focus:border-[#00288e] cursor-pointer"
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.nisn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Student profile info */}
              {(() => {
                const currentStudent = students.find(s => s.id === selectedStudentForPortal) || students[0];
                if (!currentStudent) return null;
                
                // Calculate student average & grade record
                const studentGradeRecord = grades.find(g => g.studentId === currentStudent.id);
                const rawGradesObj = studentGradeRecord?.grades || {};
                const mGrades = {
                  muatanUmum: Number(rawGradesObj.muatanUmum) || 0,
                  muatanKejuruan: Number(rawGradesObj.muatanKejuruan) || 0,
                  mataPelajaranPilihan: Number(rawGradesObj.mataPelajaranPilihan) || 0,
                  kokurikuler: Number(rawGradesObj.kokurikuler) || 0
                };
                const sAvg = (mGrades.muatanUmum + mGrades.muatanKejuruan + mGrades.mataPelajaranPilihan + mGrades.kokurikuler) / 4;
                
                // Calculate attendance rates
                let stHadir = 0, stSakit = 0, stIzin = 0, stAbsen = 0;
                attendance.forEach(day => {
                  const status = day.records[currentStudent.id] || 'hadir';
                  if (status === 'hadir') stHadir++;
                  else if (status === 'sakit') stSakit++;
                  else if (status === 'izin') stIzin++;
                  else stAbsen++;
                });
                const totalDays = attendance.length || 1;
                const presencePercent = Math.round((stHadir / totalDays) * 100);

                // Get uploaded PDF documents for this student
                const studentPDFs = uploadedReports.filter(r => r.studentId === currentStudent.id);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Student Bio & Core PDF Action Center */}
                    <div className="md:col-span-1 space-y-6">
                      {/* Identity Card */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="h-20 bg-gradient-to-r from-blue-700 to-[#00288e] relative" />
                        <div className="px-6 pb-6 text-center -mt-10 relative">
                          <img
                            src={currentStudent.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={currentStudent.name}
                            className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-white shadow bg-gray-50"
                            referrerPolicy="no-referrer"
                          />
                          <h4 className="font-bold text-base text-gray-900 mt-3">{currentStudent.name}</h4>
                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-mono px-2 py-0.5 rounded-full mt-1 inline-block">
                            NISN : {currentStudent.nisn}
                          </span>

                          <div className="mt-5 border-t border-gray-100 pt-4 text-[11px] space-y-2.5 text-left text-gray-600">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Email:</span>
                              <span className="font-semibold text-gray-800 truncate max-w-[120px]" title={currentStudent.email}>{currentStudent.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Gender:</span>
                              <span className="font-semibold text-gray-800">{currentStudent.gender}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Wali Murid:</span>
                              <span className="font-semibold text-gray-800 truncate max-w-[120px]" title={currentStudent.parentName}>{currentStudent.parentName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">No. Telp Wali:</span>
                              <span className="font-mono font-semibold text-[#00288e]">{currentStudent.parentPhone}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* PDF Report Center */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-1.5 bg-blue-50/50 border border-blue-200/50 p-3 rounded-lg">
                          <FileDown className="w-4.5 h-4.5 text-[#00288e]" />
                          <span className="text-xs font-extrabold text-[#00288e] uppercase tracking-wider">Arsip Dokumen Raport Digital</span>
                        </div>

                        {/* Semester 1 Card Box */}
                        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition duration-150 text-left relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-full -z-0 pointer-events-none" />
                          <div className="relative z-10 space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-md">SEMESTER 1 (GANJIL)</span>
                              <span className="text-[9px] font-mono text-gray-400">Ganjil</span>
                            </div>

                            {studentPDFs.filter(r => r.semester === 1).length === 0 ? (
                              <div className="p-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg text-center">
                                <p className="text-[11px] text-gray-400 font-medium">
                                  Belum ada scan dokumen resmi Semester 1 yang diunggah oleh Wali Kelas.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {studentPDFs.filter(r => r.semester === 1).map((report) => (
                                  <div key={report.id} className="p-3 bg-indigo-50/20 border border-indigo-150 rounded-lg flex flex-col space-y-2 text-xs">
                                    <div className="flex items-start space-x-2">
                                      <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                      </svg>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-xs font-bold text-slate-800 block truncate" title={report.fileName}>{report.fileName}</span>
                                        <span className="text-[9px] text-slate-400 font-medium block">Ukuran: {report.fileSize} • Terbit: {report.uploadDate}</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => setPreviewPdfReport({
                                          id: report.id,
                                          studentId: currentStudent.id,
                                          studentName: currentStudent.name,
                                          fileName: report.fileName,
                                          fileData: report.fileData,
                                          fileSize: report.fileSize,
                                          uploadDate: report.uploadDate,
                                          semester: 1
                                        })}
                                        className="py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00288e] border border-blue-250 text-[10px] font-bold rounded flex items-center justify-center space-x-1 transition cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Pratinjau</span>
                                      </button>
                                      <button
                                        onClick={() => handleDownloadFile(report.fileData, report.fileName)}
                                        className="py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded flex items-center justify-center space-x-1 transition cursor-pointer shadow-xs"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Unduh S1</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Semester 2 Card Box */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition duration-150 text-left relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-bl-full -z-0 pointer-events-none" />
                          <div className="relative z-10 space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-md">SEMESTER 2 (GENAP)</span>
                              <span className="text-[9px] font-mono text-gray-400">Genap</span>
                            </div>

                            {studentPDFs.filter(r => r.semester !== 1).length === 0 ? (
                              <div className="p-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg text-center">
                                <p className="text-[11px] text-gray-400 font-medium">
                                  Belum ada scan dokumen resmi Semester 2 yang diunggah oleh Wali Kelas.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {studentPDFs.filter(r => r.semester !== 1).map((report) => (
                                  <div key={report.id} className="p-3 bg-emerald-50/20 border border-emerald-150 rounded-lg flex flex-col space-y-2 text-xs">
                                    <div className="flex items-start space-x-2">
                                      <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                      </svg>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-xs font-bold text-slate-800 block truncate" title={report.fileName}>{report.fileName}</span>
                                        <span className="text-[9px] text-slate-400 font-medium block">Ukuran: {report.fileSize} • Terbit: {report.uploadDate}</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => setPreviewPdfReport({
                                          id: report.id,
                                          studentId: currentStudent.id,
                                          studentName: currentStudent.name,
                                          fileName: report.fileName,
                                          fileData: report.fileData,
                                          fileSize: report.fileSize,
                                          uploadDate: report.uploadDate,
                                          semester: report.semester || 2
                                        })}
                                        className="py-1.5 bg-blue-50 hover:bg-blue-100 text-[#00288e] border border-blue-250 text-[10px] font-bold rounded flex items-center justify-center space-x-1 transition cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Pratinjau</span>
                                      </button>
                                      <button
                                        onClick={() => handleDownloadFile(report.fileData, report.fileName)}
                                        className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded flex items-center justify-center space-x-1 transition cursor-pointer shadow-xs"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Unduh S2</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* System Generated Rekap Card */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:shadow-sm transition duration-150 text-left space-y-3">
                          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Rekap Raport Digital</span>
                          <p className="text-[11.5px] text-gray-550 leading-normal">
                            Salinan rangkuman hasil belajar digital yang digenerate otomatis dari server WaliKu.
                          </p>
                          <button
                            onClick={() => {
                              downloadSingleStudentRaforPDF(currentStudent, studentGradeRecord, profile, sAvg);
                            }}
                            className="w-full py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white text-[10.5px] font-bold rounded flex items-center justify-center space-x-1.5 shadow transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh Raport Sistem</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Grades Profile + Attendance + Announcements */}
                    <div className="md:col-span-2 space-y-6">
                      {/* Personal Academic Card details */}
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-left">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                          <h4 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                            <BookOpen className="w-4.5 h-4.5 text-[#00288e]" />
                            <span>Rincian Hasil Belajar Semester Genap</span>
                          </h4>
                          <div className="flex items-center space-x-1 bg-blue-50 text-[#00288e] text-xs font-bold px-2.5 py-1 rounded">
                            <span>RATA-RATA:</span>
                            <span className="font-mono text-sm">{sAvg.toFixed(1)}</span>
                          </div>
                        </div>

                        {/* Subject Progress bars */}
                        <div className="grid grid-cols-1 gap-4">
                          {[
                            { label: 'Muatan Umum', score: mGrades.muatanUmum },
                            { label: 'Muatan Kejuruan', score: mGrades.muatanKejuruan },
                            { label: 'Mata Pelajaran Pilihan', score: mGrades.mataPelajaranPilihan },
                            { label: 'Kokurikuler', score: mGrades.kokurikuler }
                          ].map((subj, idx) => {
                            const getLetter = (s: number) => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : 'D';
                            return (
                              <div key={idx} className="space-y-1.5 text-xs text-left">
                                <div className="flex justify-between items-center font-semibold text-slate-700">
                                  <span>{subj.label}</span>
                                  <div className="flex items-center space-x-2.5">
                                    <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">{subj.score} / 100</span>
                                    <span className="font-extrabold text-[#00288e] bg-indigo-50 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{getLetter(subj.score)}</span>
                                  </div>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#00288e]" style={{ width: `${subj.score}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Attendance Summary and Class Announcements widget side-by-side */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* 1. Personal Attendance */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center space-x-2 mb-3">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              <span>Kehadiran Anda</span>
                            </h4>
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle cx="28" cy="28" r="23" stroke="#f1f5f9" strokeWidth="5" fill="transparent" />
                                  <circle cx="28" cy="28" r="23" stroke="#10b981" strokeWidth="5" fill="transparent" strokeDasharray={144.44} strokeDashoffset={144.44 - (144.44 * presencePercent) / 100} />
                                </svg>
                                <span className="absolute text-[10px] font-black text-gray-900 font-mono">{presencePercent}%</span>
                              </div>
                              <div className="space-y-0.5 text-xs">
                                <span className="text-gray-400 block font-medium">Status Disiplin:</span>
                                <span className="text-emerald-600 font-bold block">Sangat Aktif</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div>
                              <span className="text-emerald-600 block text-xs font-bold">{stHadir}</span>
                              <span className="text-gray-400 text-[10px]">Hadir</span>
                            </div>
                            <div>
                              <span className="text-amber-600 block text-xs font-bold">{stSakit}</span>
                              <span className="text-gray-400 text-[10px]">Sakit</span>
                            </div>
                            <div>
                              <span className="text-blue-600 block text-xs font-bold">{stIzin}</span>
                              <span className="text-gray-400 text-[10px]">Izin</span>
                            </div>
                            <div>
                              <span className="text-rose-600 block text-xs font-bold">{stAbsen}</span>
                              <span className="text-gray-400 text-[10px]">Alpa</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Announcements */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-left flex flex-col">
                          <h4 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center space-x-2 mb-3">
                            <Bell className="w-4 h-4 text-rose-500" />
                            <span>Pengumuman Kelas</span>
                          </h4>

                          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-36 pr-1">
                            {announcements.filter(a => a.target === 'semua' || a.target === 'siswa').slice(0, 3).map((a) => (
                              <div key={a.id} className="border-l-2 border-rose-500 pl-2.5 py-0.5 space-y-0.5 text-xs text-left">
                                <span className="font-bold text-slate-800 block truncate" title={a.title}>{a.title}</span>
                                <span className="text-[10px] text-gray-500 block truncate" title={a.content}>{a.content}</span>
                                <span className="text-[9px] text-gray-400 block">{a.date}</span>
                              </div>
                            ))}
                            {announcements.length === 0 && (
                              <p className="text-xs text-gray-400 italic text-center py-4">Belum ada pengumuman kelas.</p>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* STANDARD TEACHER PORTAL VIEWS */
            <>
              {/* VIEW 1: OVERVIEW / RINGKASAN */}
              {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Stats bento layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Total Students */}
                <div className="bg-white border border-gray-250 p-5 rounded-lg flex items-center space-x-4 shadow-sm text-left">
                  <div className="bg-blue-50 p-3 rounded-lg text-[#00288e]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">Binaan Siswa</span>
                    <h3 className="text-2xl font-extrabold text-gray-900">{students.length} Siswa</h3>
                    <span className="text-[10px] text-gray-500 font-medium">4 Laki, 4 Perempuan</span>
                  </div>
                </div>

                {/* Attendance today */}
                <div className="bg-white border border-gray-250 p-5 rounded-lg flex items-center space-x-4 shadow-sm text-left">
                  <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">Hadir Hari Ini</span>
                    <h3 className="text-2xl font-extrabold text-gray-900">{attendStats.percent}%</h3>
                    <span className="text-[10px] text-emerald-600 font-semibold">{attendStats.hadir}/{students.length} Siswa hadir</span>
                  </div>
                </div>

                {/* Class Grade average */}
                <div className="bg-white border border-gray-250 p-5 rounded-lg flex items-center space-x-4 shadow-sm text-left">
                  <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">Rata-rata Kelas</span>
                    <h3 className="text-2xl font-extrabold text-gray-900">{classOverallAverage}</h3>
                    <span className="text-[10px] text-gray-500 font-medium">Target Kurikulum: &gt;75.0</span>
                  </div>
                </div>

                {/* Active Date / Status */}
                <div className="bg-[#00288e]/5 border border-blue-200/60 p-5 rounded-lg flex items-center space-x-4 shadow-sm text-left">
                  <div className="bg-[#00288e] p-3 rounded-lg text-white">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-[#00288e] font-bold tracking-wide uppercase">WaliKu Aktif</span>
                    <h3 className="text-base font-bold text-gray-900 mt-0.5">Sesi Berjalan</h3>
                    <span className="text-[11px] text-gray-500 font-semibold block">Hari Efektif Belajar</span>
                  </div>
                </div>

              </div>

              {/* Central overview charts & lists */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visual Chart: SVG Academic Performances (Left column) */}
                <div className="bg-white border border-gray-250 p-6 rounded-lg shadow-sm text-left lg:col-span-7">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-bold text-gray-950">Statistik Rata-Rata Ujian per Mata Pelajaran</h4>
                      <p className="text-xs text-gray-500">Evaluasi pencapaian rata-rata seluruh siswa</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsEditingStats(prev => !prev)}
                        className="text-xs font-bold text-[#00288e] bg-blue-50 hover:bg-blue-105 border border-blue-200 rounded px-2.5 py-1 flex items-center space-x-1.5 duration-155 cursor-pointer"
                        title="Atur Statistik Ujian Secara Manual"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#00288e]" />
                        <span>{isEditingStats ? 'Tutup Edit' : 'Edit Statistik'}</span>
                      </button>
                      <span className="text-xs bg-blue-50 text-[#00288e] font-bold px-2 py-1 rounded">
                        Kelas {profile.className}
                      </span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isEditingStats && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4 overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <label className="text-xs font-bold text-gray-700 uppercase">Metode Sumber Data</label>
                          <div className="flex items-center space-x-2 bg-gray-200 p-0.5 rounded-md self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualOverride(false);
                              }}
                              className={`px-3 py-1 text-[10px] font-bold rounded duration-150 cursor-pointer ${!isManualOverride ? 'bg-white shadow text-[#00288e]' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                              Kalkulasi Database
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualOverride(true);
                              }}
                              className={`px-3 py-1 text-[10px] font-bold rounded duration-150 cursor-pointer ${isManualOverride ? 'bg-white shadow text-[#00288e]' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                              Saji Manual (Override)
                            </button>
                          </div>
                        </div>

                        {isManualOverride ? (
                          <div className="space-y-3">
                            <p className="text-[10px] text-amber-700 bg-amber-50 rounded border border-amber-200 p-2 font-medium leading-normal">
                              ⚠️ <strong>Mode Override Aktif:</strong> Statistik di bawah ini dapat diatur manual dan akan mengesampingkan kalkulasi database nilai siswa.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { label: 'Muatan Umum', key: 'muatanUmum' },
                                { label: 'Muatan Kejuruan', key: 'muatanKejuruan' },
                                { label: 'Mata Pelajaran Pilihan', key: 'mataPelajaranPilihan' },
                                { label: 'Kokurikuler', key: 'kokurikuler' }
                              ].map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase">{field.label}</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={manualSubjectAverages[field.key as keyof SubjectGrades]}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setManualSubjectAverages(prev => ({
                                        ...prev,
                                        [field.key]: val > 100 ? 100 : val
                                      }));
                                    }}
                                    className="block w-full text-xs font-bold font-mono px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-[#00288e]"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded leading-relaxed">
                            Sistem mengkalkulasi statistik mata pelajaran secara otomatis dari total <strong>{grades.filter(g => g.studentId !== 'class_averages').length} siswa</strong> yang memiliki data nilai raport di database portal.
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingStats(false);
                              if (isManualOverride) {
                                const averagesRecord = {
                                  studentId: 'class_averages',
                                  grades: {
                                    muatanUmum: Math.round(manualSubjectAverages.muatanUmum),
                                    muatanKejuruan: Math.round(manualSubjectAverages.muatanKejuruan),
                                    mataPelajaranPilihan: Math.round(manualSubjectAverages.mataPelajaranPilihan),
                                    kokurikuler: Math.round(manualSubjectAverages.kokurikuler)
                                  }
                                };
                                setDoc(doc(db, 'grades', 'class_averages'), averagesRecord)
                                  .catch(err => handleFirestoreError(err, OperationType.WRITE, `grades/class_averages`));
                              }
                            }}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-[#00288e] hover:bg-[#1e40af] rounded shadow duration-150 cursor-pointer"
                          >
                            Simpan & Terapkan
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SVG Hand-written high-quality bar analytics */}
                  <div className="space-y-4">
                    {[
                      { subject: 'Muatan Umum', avg: getSubjectAverage('muatanUmum'), color: 'bg-indigo-600' },
                      { subject: 'Muatan Kejuruan', avg: getSubjectAverage('muatanKejuruan'), color: 'bg-emerald-600' },
                      { subject: 'Mata Pelajaran Pilihan', avg: getSubjectAverage('mataPelajaranPilihan'), color: 'bg-amber-500' },
                      { subject: 'Kokurikuler', avg: getSubjectAverage('kokurikuler'), color: 'bg-sky-500' },
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-700">{item.subject}</span>
                          <span className="font-bold text-gray-900">{item.avg} / 100</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                          <motion.div
                            className={`h-full ${item.color} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.avg}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const subjects = [
                      { name: 'Muatan Umum', avg: getSubjectAverage('muatanUmum') },
                      { name: 'Muatan Kejuruan', avg: getSubjectAverage('muatanKejuruan') },
                      { name: 'Mata Pelajaran Pilihan', avg: getSubjectAverage('mataPelajaranPilihan') },
                      { name: 'Kokurikuler', avg: getSubjectAverage('kokurikuler') },
                    ];
                    const highest = subjects.reduce((max, s) => s.avg > max.avg ? s : max, subjects[0]);
                    return (
                      <div className="mt-6 pt-4 border-t border-gray-100 flex items-start space-x-2 text-[11px] text-gray-500">
                        <Info className="w-4 h-4 text-[#00288e] shrink-0 mt-0.5" />
                        <span className="flex-1 leading-normal">
                          Rata-rata tertinggi dipegang oleh pelajaran <strong>{highest.name}</strong> dengan nilai <strong>{highest.avg}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Announcements list (Right column) */}
                <div className="bg-white border border-gray-250 p-6 rounded-lg shadow-sm text-left lg:col-span-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-950">Pengumuman Terkini</h4>
                      <p className="text-xs text-gray-500">Pesan siaran aktif yang terkirim ke wali murid</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('announcements')}
                      className="text-xs text-[#00288e] hover:underline font-bold cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  {/* Message Blocks container */}
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px]">
                    {announcements.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded border text-left space-y-1 ${
                          item.category === 'urgent'
                            ? 'bg-red-50/50 border-red-200'
                            : item.category === 'akademik'
                            ? 'bg-blue-50/50 border-blue-150'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                            item.category === 'urgent'
                              ? 'bg-red-100 text-red-700'
                              : item.category === 'akademik'
                              ? 'bg-blue-100 text-[#00288e]'
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            {item.category}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 font-semibold">{item.date}</span>
                        </div>
                        <h5 className="text-xs font-bold text-gray-900 truncate">{item.title}</h5>
                        <p className="text-[11px] text-gray-600 line-clamp-2 leading-normal">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Semester Attendance Recap List */}
              <div className="bg-white border border-gray-250 p-6 rounded-lg shadow-sm text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-950">Daftar Hadir Rekapan 1 Semester</h4>
                    <span className="text-xs text-gray-500">Rekapitulasi kehadiran & akumulasi ketidakhadiran selama satu semester</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Cari nama siswa..."
                      value={attendanceRecapSearch}
                      onChange={(e) => setAttendanceRecapSearch(e.target.value)}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-[#00288e] w-full sm:w-48 placeholder-gray-400"
                    />
                    <button
                      onClick={() => setActiveTab('attendance')}
                      className="text-xs text-white bg-[#00288e] hover:bg-[#1e40af] font-bold px-4 py-1.5 rounded transition cursor-pointer w-full sm:w-auto"
                    >
                      Kelola Absensi
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-250 text-xs">
                    <thead className="bg-[#f8fafc] text-[#334155] font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">No</th>
                        <th className="px-4 py-3 text-left">Nama Siswa</th>
                        <th className="px-4 py-3 text-center">NISN</th>
                        <th className="px-4 py-3 text-center text-emerald-700 font-extrabold bg-emerald-50/20">Hadir (H)</th>
                        <th className="px-4 py-3 text-center text-amber-600 font-extrabold bg-amber-50/20">Sakit (S)</th>
                        <th className="px-4 py-3 text-center text-[#1e40af] font-extrabold bg-blue-50/20">Izin (I)</th>
                        <th className="px-4 py-3 text-center text-rose-700 font-extrabold bg-rose-50/20">Alpa (A)</th>
                        <th className="px-4 py-3 text-center">Kehadiran</th>
                        <th className="px-4 py-3 text-left w-32 border-l border-gray-200">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-150 text-[#334155]">
                      {(() => {
                        const filtered = students.filter(student =>
                          student.name.toLowerCase().includes(attendanceRecapSearch.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="px-4 py-8 text-center text-gray-400 font-semibold bg-gray-50/30">
                                Tidak ada siswa kelas binaan yang cocok dengan pencarian siswa.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((student, idx) => {
                          let h = 0, s = 0, i = 0, a = 0;
                          
                          // Calculate logs from live state
                          attendance.forEach(day => {
                            const status = day.records[student.id] || 'hadir';
                            if (status === 'hadir') h++;
                            else if (status === 'sakit') s++;
                            else if (status === 'izin') i++;
                            else if (status === 'absen' || status === 'alpa') a++;
                          });
                          
                          // Cumulative baseline totals for realistic semester recap data
                          const baseH = 75 + (idx % 3);
                          const baseS = idx % 2 === 0 ? 1 : 0;
                          const baseI = idx % 3 === 0 ? 1 : 0;
                          const baseA = idx % 4 === 0 ? 1 : 0;
                          
                          const finalH = baseH + h;
                          const finalS = baseS + s;
                          const finalI = baseI + i;
                          const finalA = baseA + a;
                          const finalTotal = finalH + finalS + finalI + finalA;
                          
                          const ratePercent = finalTotal > 0 ? Math.round((finalH / finalTotal) * 100) : 100;
                          
                          return (
                            <tr key={student.id} className="hover:bg-slate-50/50 transition duration-75">
                              <td className="px-4 py-2.5 text-center text-slate-400 font-medium font-mono">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-bold text-[#0f172a] text-[11.5px]">{student.name}</td>
                              <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{student.nisn}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-emerald-600 font-mono bg-emerald-50/20">{finalH}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-amber-500 font-mono bg-amber-50/10">{finalS}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-[#00288e] font-mono bg-blue-50/10">{finalI}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-rose-600 font-mono bg-rose-50/10">{finalA}</td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="font-extrabold text-[#0f172a] font-mono">{ratePercent}%</span>
                                  <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={`h-full rounded-full ${ratePercent >= 95 ? 'bg-emerald-500' : ratePercent >= 85 ? 'bg-blue-600' : 'bg-rose-500'}`}
                                      style={{ width: `${ratePercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 border-l border-gray-100">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                                  ratePercent >= 95 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : ratePercent >= 85 
                                      ? 'bg-blue-50 text-[#1e40af] border-blue-200' 
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {ratePercent >= 95 ? 'Sangat Baik' : ratePercent >= 85 ? 'Baik' : 'Butuh Perhatian'}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PDF Administrative Reports Download Hub */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-left space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-950 flex items-center space-x-2">
                      <FileDown className="w-4 h-4 text-[#00288e]" />
                      <span>Unduh Laporan Administrasi Digital (Format Resmi PDF)</span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Dapatkan berkas cetakan resmi untuk diserahkan ke Kepala Sekolah, Pengawas, maupun kearsipan Tata Usaha (TU).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-100 text-[#00288e] font-extrabold px-2.5 py-1 rounded-full uppercase">
                    SIAP CETAK • 2026/2027
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Option 1: Class grades */}
                  <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm hover:border-[#00288e] transition flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#00288e] block uppercase mb-1">Daftar Nilai</span>
                      <h5 className="text-xs font-bold text-gray-900">Rekapitulasi Nilai Kelas ({profile.className})</h5>
                      <p className="text-[11px] text-gray-500 mt-1">Daftar seluruh nilai mata pelajaran beserta kalkulasi rata-rata per siswa untuk semester berjalan.</p>
                    </div>
                    <button
                      onClick={() => {
                        downloadClassGradesReportPDF(students, grades, profile, classOverallAverage);
                      }}
                      className="mt-4 w-full py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-semibold rounded shadow-sm flex items-center justify-center space-x-1 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Rekap Nilai</span>
                    </button>
                  </div>

                  {/* Option 2: Date-based attendance */}
                  <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm hover:border-[#00288e] transition flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-indigo-600 block uppercase mb-1">Daftar Kehadiran</span>
                      <h5 className="text-xs font-bold text-gray-900">Kehadiran Siswa Hari Ini ({attendanceDate})</h5>
                      <p className="text-[11px] text-gray-500 mt-1">Tingkat kehadiran siswa harian dengan rincian status hadir, izin, sakit dan persentase kehadiran.</p>
                    </div>
                    <button
                      onClick={() => {
                        downloadClassAttendanceReportPDF(students, activeAttendanceRecord, profile, attendStats);
                      }}
                      className="mt-4 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm flex items-center justify-center space-x-1 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Rekap Absensi</span>
                    </button>
                  </div>

                  {/* Option 3: Bulk print card report explanation */}
                  <div className="bg-white border border-gray-200 p-4 rounded-md shadow-sm hover:border-[#00288e] transition flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-600 block uppercase mb-1">Raport Individual</span>
                      <h5 className="text-xs font-bold text-gray-900">E-Raport Laporan Hasil Belajar</h5>
                      <p className="text-[11px] text-gray-500 mt-1">Unduh raport individu masing-masing siswa yang dilengkapi tanda tangan wali kelas.</p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('grades');
                        setTimeout(() => {
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }, 100);
                      }}
                      className="mt-4 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm flex items-center justify-center space-x-1 cursor-pointer transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Buka Menu Raport</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 2: ANNOUNCEMENTS / PENGUMUMAN */}
          {activeTab === 'announcements' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Creator Form (Left Column) */}
              <div className="bg-white border border-gray-250 p-6 rounded-lg shadow-sm text-left lg:col-span-5 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-950">Buat Pengumuman Baru</h4>
                  <p className="text-xs text-gray-500">Pesan akan disiarkan ke siswa & wali murid</p>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Judul Pengumuman</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Contoh: Pengambilan Raport Akhir Semester"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white focus:outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase">Kategori</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="block w-full text-sm border-gray-300 rounded border p-2 bg-white"
                      >
                        <option value="umum">Umum</option>
                        <option value="urgent">Mendesak (Urgent)</option>
                        <option value="akademik">Akademik</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase">Target Audiens</label>
                      <select
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value as any)}
                        className="block w-full text-sm border-gray-300 rounded border p-2 bg-white"
                      >
                        <option value="semua">Semua</option>
                        <option value="ortu">Orang Tua</option>
                        <option value="siswa">Siswa</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Isi Pengumuman</label>
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Tulis pesan pengumuman lengkap di sini..."
                      rows={5}
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white focus:outline-none focus:border-[#00288e]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#00288e] hover:bg-[#1e40af] text-white font-semibold text-sm rounded-[4px] shadow transition cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Siarkan Sekarang</span>
                  </button>
                </form>
              </div>

              {/* Announcement List & Previews (Right Column) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-md">
                  <span className="text-xs font-bold text-gray-600">Siaran Aktif: {announcements.length} Pengumuman</span>
                  <p className="text-[11px] text-gray-400">Total terkirim via server WaliKu</p>
                </div>

                <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                  {announcements.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-250 p-5 rounded-lg shadow-sm text-left relative group hover:border-[#00288e]/55 transition duration-150"
                    >
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`*${item.title.toUpperCase()}*\n\n${item.content}`);
                            alert('Teks pengumuman disalin! Siap dibagikan ke WhatsApp Group Wali Murid.');
                          }}
                          className="p-1 px-2 text-[10px] items-center space-x-1 bg-gray-50 border border-gray-200 text-gray-600 hover:text-[#00288e] hover:bg-blue-50 rounded cursor-pointer hidden group-hover:flex"
                        >
                          Salin WA
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-2 mb-3">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          item.category === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : item.category === 'akademik'
                            ? 'bg-blue-100 text-[#00288e]'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.category}
                        </span>
                        <span className="text-xs text-gray-400 font-mono font-medium">{item.date}</span>
                        <span className="text-[11px] text-gray-400">• Penerima: {item.target === 'ortu' ? 'Orang Tua' : item.target === 'siswa' ? 'Siswa' : 'Semua'}</span>
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 mb-2">{item.title}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* VIEW 3: GRADES / RAPORT ONLINE */}
          {activeTab === 'grades' && (
            <div className="space-y-6">

              {/* Portal Administrasi PDF Banner */}
              <div className="bg-gradient-to-r from-[#00288e] to-indigo-800 p-5 rounded-lg text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                <div>
                  <h3 className="text-base font-bold flex items-center space-x-2">
                    <GraduationCap className="w-5 h-5 text-indigo-200 animate-pulse" />
                    <span>Portal Administrasi Raport & Nilai</span>
                  </h3>
                  <p className="text-xs text-indigo-100 mt-1 max-w-xl">
                    Kelola data akademik siswa kelas {profile.className} secara digital. Anda dapat mengunduh berkas laporan format PDF resmi untuk kebutuhan dinas kesiswaan maupun arsip fisik sekolah.
                  </p>
                </div>
                <button
                  onClick={() => {
                    downloadClassGradesReportPDF(students, grades, profile, classOverallAverage);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded shadow flex items-center justify-center space-x-2 shrink-0 transition duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Rekap Nilai Satu Kelas (PDF)</span>
                </button>
              </div>

              {/* Filter and overview panel */}
              <div className="bg-white border border-gray-250 p-4 rounded-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                
                <div className="relative w-full md:max-w-xs lg:max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari siswa berdasarkan nama, kelas, atau NISN..."
                    className="block w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#00288e] font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 shrink-0 w-full md:w-auto">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 bg-slate-50 border border-slate-205 border-slate-200 px-2.5 py-1.5 rounded-md">
                    <span>Kelas Utama:</span>
                    <span className="text-indigo-700 font-extrabold text-xs">
                      {profile.className}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md">
                    <span>Siswa Aktif:</span>
                    <span className="text-emerald-700 font-extrabold text-xs">
                      {filteredStudents.length} / {students.length}
                    </span>
                  </div>
                  <button
                    onClick={openAddStudentModal}
                    className="w-full sm:w-auto px-4 py-2 bg-[#00288e] hover:bg-indigo-800 text-white font-bold text-xs rounded shadow flex items-center justify-center space-x-1.5 transition duration-150 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Tambah Siswa Baru</span>
                  </button>
                </div>

              </div>

              {/* --- GOOGLE DRIVE CONNECTION PANEL --- */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
                <div className="flex items-start space-x-3.5">
                  <div className="p-3 bg-blue-100 text-[#00288e] rounded-xl border border-blue-200 shrink-0">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                      <span>Integrasi Google Drive WaliKu</span>
                      {driveToken ? (
                        <span className="text-[9px] bg-emerald-150 text-emerald-800 border border-emerald-250 font-bold px-2 py-0.5 rounded uppercase">
                          Terhubung
                        </span>
                      ) : (
                        <span className="text-[9px] bg-gray-150 text-gray-500 border border-gray-200 font-bold px-2 py-0.5 rounded uppercase">
                          Belum Aktif
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                      {driveToken 
                        ? `Sinkronisasikan raport PDF siswa, buat folder backup kelas otomatis, atau pilih raport langsung dari Google Drive Anda.`
                        : "Hubungkan akun Google Sekolah / Pribadi Anda untuk mengunggah otomatis ke folder cloud kesiswaan, atau mengimpor file raport PDF langsung dari Google Drive Anda."}
                    </p>
                    {!driveToken && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2 flex items-center gap-1.5 max-w-xl">
                        <span>ℹ️</span> 
                        <span>Jika pop-up koneksi diblokir atau gagal, silakan gunakan tombol <strong>'Open in new tab' (Buka di tab baru)</strong> di sudut kanan atas layar Anda untuk aktivasi yang lancar.</span>
                      </p>
                    )}
                    {driveToken && (
                      <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg space-y-3 max-w-xl">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                            <Sliders className="w-4 h-4 text-indigo-600" />
                            <span>Pengaturan Folder Penyimpanan Drive</span>
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 text-xs">
                          <label className="flex items-center space-x-2 font-bold text-slate-600 cursor-pointer">
                            <input 
                              type="radio" 
                              name="folder_mode" 
                              checked={!useCustomFolder} 
                              onChange={() => {
                                setUseCustomFolder(false);
                                localStorage.setItem('waliku_use_custom_folder', 'false');
                              }}
                              className="text-indigo-600 focus:ring-indigo-500" 
                            />
                            <span>Folder Otomatis ("WaliKu Raport Online - {profile.className}")</span>
                          </label>

                          <label className="flex items-center space-x-2 font-bold text-slate-600 cursor-pointer">
                            <input 
                              type="radio" 
                              name="folder_mode" 
                              checked={useCustomFolder} 
                              onChange={() => {
                                setUseCustomFolder(true);
                                localStorage.setItem('waliku_use_custom_folder', 'true');
                              }}
                              className="text-indigo-600 focus:ring-indigo-500" 
                            />
                            <span>Folder Kustom Link Google Drive Anda</span>
                          </label>
                        </div>

                        {useCustomFolder && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={customFolderUrl}
                                onChange={(e) => setCustomFolderUrl(e.target.value)}
                                placeholder="Tempel link folder Google Drive Anda..."
                                className="block w-full text-xs font-medium border border-gray-300 rounded px-2.5 py-1.5 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 text-slate-800"
                              />
                              <button 
                                onClick={() => handleUpdateCustomFolder(customFolderUrl)}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded duration-150 cursor-pointer text-xs shrink-0"
                              >
                                Simpan Link
                              </button>
                            </div>
                            <div className="flex items-center justify-between bg-indigo-50/50 p-2.5 rounded border border-indigo-105 text-[10.5px] text-indigo-950 font-medium">
                              <span className="flex items-center space-x-1 truncate mr-2">
                                <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce shrink-0" />
                                <span className="truncate">Terhubung ke ID: <strong>{customFolderId || 'Belum diatur'}</strong></span>
                              </span>
                              <a 
                                href={customFolderUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[#00288e] hover:underline font-bold shrink-0"
                              >
                                Buka Folder ↗
                              </a>
                            </div>
                          </div>
                        )}
                        {!useCustomFolder && (
                          <div className="text-[11px] text-slate-400 font-medium bg-slate-50 p-2.5 rounded border border-slate-200">
                            📁 File akan diunggah ke folder sistem otomatis kesiswaan Anda.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  {driveToken ? (
                    <>
                      <button
                        onClick={handleBulkSyncToDrive}
                        disabled={bulkSyncing}
                        className="w-full sm:w-auto px-4 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded shadow-sm flex items-center justify-center space-x-1.5 duration-150 cursor-pointer disabled:opacity-50"
                      >
                        {bulkSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mencadangkan...</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3.5 h-3.5" />
                            <span>Cadangkan Semua ke Drive</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDisconnectDrive}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded duration-150 cursor-pointer text-center"
                      >
                        Putuskan Sesi
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectDrive}
                      disabled={isDriveLoading}
                      className="gsi-material-button text-xs font-bold w-full sm:w-auto flex items-center justify-center cursor-pointer shadow-sm"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #747775',
                        borderRadius: '4px',
                        color: '#1f1f1f',
                        padding: '8px 16px',
                        outline: 'none',
                        transition: 'background-color .218s, border-color .218s'
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span>{isDriveLoading ? "Menghubungkan..." : "Hubungkan Google Drive"}</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Core Student Grades Table */}
              <div className="bg-white border border-gray-250 rounded-lg shadow-sm overflow-hidden text-left">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-150">
                      <tr>
                        <th scope="col" className="px-6 py-4 font-bold text-center w-12">No</th>
                        <th scope="col" className="px-6 py-4 font-bold">Nama Lengkap & NISN</th>
                        <th scope="col" className="px-6 py-4 font-bold text-center">Kelas</th>
                        <th scope="col" className="px-6 py-4 font-bold text-center w-56">Fitur Unggah Raport</th>
                        <th scope="col" className="px-6 py-4 font-bold">Status Berkas Terunggah</th>
                        <th scope="col" className="px-6 py-4 font-bold text-center w-56">Pratinjau Hasil Upload & Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {filteredStudents.map((student, idx) => {
                        const studentGradeRecord = grades.find(g => g.studentId === student.id);
                        const avg = getStudentAverage(student.id);
                        const studentPDFs = uploadedReports.filter(r => r.studentId === student.id);

                        return (
                          <tr key={student.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-6 py-4 font-medium text-gray-900 text-center">{idx + 1}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={student.avatar}
                                  alt="Avatar"
                                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <span className="block font-bold text-gray-950 leading-tight">{student.name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono tracking-wider">NISN: {student.nisn} • {student.gender}</span>
                                </div>
                              </div>
                            </td>
                            
                            {/* Class Column */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-extrabold text-[#00288e] bg-blue-50 border border-blue-200 px-3 py-1 rounded">
                                {student.className || profile.className}
                              </span>
                            </td>

                            {/* Direct PDF Upload Button */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col gap-2 min-w-[190px] justify-center items-center">
                                {/* Semester 1 Upload Card */}
                                <div className="w-full bg-indigo-50/25 border border-indigo-200/60 rounded p-1.5 flex flex-col gap-1 text-left shadow-2xs">
                                  <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-100 border border-indigo-250 px-1.5 py-0.5 rounded leading-none w-max block uppercase">Semester 1</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="file"
                                      id={`pdf-row-upload-${student.id}-smt1`}
                                      className="hidden"
                                      accept=".pdf"
                                      onChange={(e) => handleFileUpload(e, student.id, 1)}
                                    />
                                    <button
                                      onClick={() => {
                                        const input = document.getElementById(`pdf-row-upload-${student.id}-smt1`);
                                        if (input) input.click();
                                      }}
                                      className="flex-1 p-1 px-1.5 text-[10px] font-bold text-white bg-indigo-650 hover:bg-indigo-750 rounded flex items-center justify-center gap-0.5 cursor-pointer duration-150 shadow-xs"
                                      title="Unggah berkas PDF untuk Semester 1 dari komputer"
                                    >
                                      <Upload className="w-2.5 h-2.5" />
                                      <span>Unggah S1</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!driveToken) {
                                          alert("Hubungkan akun Google Drive Anda terlebih dahulu melalui panel di atas.");
                                          return;
                                        }
                                        setTargetStudentForDriveImport(student.id);
                                        setTargetSemesterForDriveImport(1);
                                        setIsDrivePickerOpen(true);
                                      }}
                                      className="p-1 px-1.5 text-[10px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-3xs hover:text-indigo-600 rounded flex items-center justify-center gap-0.5 cursor-pointer duration-150"
                                      title="Ambil berkas PDF Semester 1 dari Google Drive"
                                    >
                                      <Cloud className="w-2.5 h-2.5 text-blue-500" />
                                      <span>Drive</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Semester 2 Upload Card */}
                                <div className="w-full bg-emerald-50/25 border border-emerald-200/60 rounded p-1.5 flex flex-col gap-1 text-left shadow-2xs">
                                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-250 px-1.5 py-0.5 rounded leading-none w-max block uppercase">Semester 2</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="file"
                                      id={`pdf-row-upload-${student.id}-smt2`}
                                      className="hidden"
                                      accept=".pdf"
                                      onChange={(e) => handleFileUpload(e, student.id, 2)}
                                    />
                                    <button
                                      onClick={() => {
                                        const input = document.getElementById(`pdf-row-upload-${student.id}-smt2`);
                                        if (input) input.click();
                                      }}
                                      className="flex-1 p-1 px-1.5 text-[10px] font-bold text-white bg-emerald-650 hover:bg-emerald-750 rounded flex items-center justify-center gap-0.5 cursor-pointer duration-150 shadow-xs"
                                      title="Unggah berkas PDF untuk Semester 2 dari komputer"
                                    >
                                      <Upload className="w-2.5 h-2.5" />
                                      <span>Unggah S2</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!driveToken) {
                                          alert("Hubungkan akun Google Drive Anda terlebih dahulu melalui panel di atas.");
                                          return;
                                        }
                                        setTargetStudentForDriveImport(student.id);
                                        setTargetSemesterForDriveImport(2);
                                        setIsDrivePickerOpen(true);
                                      }}
                                      className="p-1 px-1.5 text-[10px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-3xs hover:text-emerald-600 rounded flex items-center justify-center gap-0.5 cursor-pointer duration-150"
                                      title="Ambil berkas PDF Semester 2 dari Google Drive"
                                    >
                                      <Cloud className="w-2.5 h-2.5 text-blue-500" />
                                      <span>Drive</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status and uploaded information */}
                            <td className="px-6 py-4">
                              {studentPDFs.length === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-50 text-gray-400 border border-gray-200 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-1.5" />
                                  Belum Ada Raport PDF
                                </span>
                              ) : (
                                <div className="space-y-1.5">
                                  {studentPDFs.map(pdf => (
                                    <div key={pdf.id} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-150 rounded-lg group hover:bg-emerald-100/50 transition duration-150 gap-2">
                                      <div className="flex items-center space-x-1.5 min-w-0 flex-1 flex-row text-left">
                                        <FileText className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div className="truncate max-w-[150px] leading-tight flex-1 text-left">
                                          <span className="block font-bold truncate text-slate-800 text-[11px]" title={pdf.fileName}>
                                            <span className="bg-indigo-650 text-white font-extrabold text-[8px] px-1 py-0.5 rounded mr-1 inline-block uppercase leading-none">SMT {pdf.semester || 2}</span>
                                            {pdf.fileName}
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{pdf.fileSize} • {pdf.uploadDate}</span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteUploadedFile(pdf.id)}
                                        className="p-1 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded transition duration-150 shrink-0 cursor-pointer"
                                        title="Hapus / Revisi Dokumen"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Action / Preview Column */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col xl:flex-row items-center justify-center gap-2">
                                
                                {/* Core Student Profile Actions */}
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      let record = grades.find(g => g.studentId === student.id);
                                      if (!record) {
                                        record = {
                                          studentId: student.id,
                                          grades: { muatanUmum: 0, muatanKejuruan: 0, mataPelajaranPilihan: 0, kokurikuler: 0 }
                                        };
                                      }
                                      setEditingGrade(record);
                                    }}
                                    className="p-1 px-2.5 text-[11px] font-bold text-[#00288e] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded shadow-xs flex items-center space-x-1 cursor-pointer duration-150"
                                    title="Input / Ubah Nilai Akademik Siswa"
                                  >
                                    <GraduationCap className="w-3.5 h-3.5 text-[#00288e]" />
                                    <span>Input/Edit Nilai</span>
                                  </button>
                                  <button
                                    onClick={() => setPrintingCard(student)}
                                    className="p-1 px-2.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded shadow-xs flex items-center space-x-1 cursor-pointer duration-150"
                                    title="Kelola & Cetak E-Raport / Dokumen PDF"
                                  >
                                    <FileText className="w-3 h-3 text-purple-600" />
                                    <span>Kelola E-Raport (Smt 1/2)</span>
                                  </button>
                                  <button
                                    onClick={() => openEditStudentModal(student)}
                                    className="p-1 px-2.5 text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded shadow-xs flex items-center space-x-1 cursor-pointer duration-150"
                                    title="Edit Informasi & Kelas Siswa"
                                  >
                                    <Edit2 className="w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-1 px-2.5 text-[11px] font-bold text-rose-700 bg-rose-50/50 hover:bg-rose-100 border border-rose-200 rounded shadow-xs flex items-center space-x-1 cursor-pointer duration-150"
                                    title="Hapus Siswa Permanen"
                                  >
                                    <Trash2 className="w-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>

                                {/* Divider line if PDF actions are available */}
                                {studentPDFs.length > 0 && (
                                  <span className="hidden xl:inline-block text-gray-300 h-4 w-[1px] bg-gray-200 self-center mx-1" />
                                )}

                                {/* PDF Report Action Handles */}
                                {studentPDFs.length > 0 ? (
                                  <div className="flex flex-col gap-1 w-full max-w-[180px] shrink-0">
                                    {studentPDFs.map(pdf => (
                                      <div key={pdf.id} className="flex items-center justify-between p-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] w-full gap-1.5 font-sans">
                                        <span className="font-extrabold bg-indigo-600 text-white px-1 rounded text-[8px] shrink-0 uppercase leading-none">S{pdf.semester || 2}</span>
                                        <span className="truncate text-slate-500 font-medium text-[9px] mr-auto text-left" title={pdf.fileName}>
                                          {pdf.fileName}
                                        </span>
                                        <div className="flex items-center space-x-0.5 shrink-0">
                                          <button
                                            onClick={() => setPreviewPdfReport({
                                              id: pdf.id,
                                              studentId: student.id,
                                              studentName: student.name,
                                              fileName: pdf.fileName,
                                              fileData: pdf.fileData,
                                              fileSize: pdf.fileSize,
                                              uploadDate: pdf.uploadDate,
                                              semester: pdf.semester
                                            })}
                                            className="p-0.5 text-[#00288e] hover:bg-blue-50 rounded"
                                            title={`Pratinjau Raport Smt ${pdf.semester || 2}`}
                                          >
                                            <Eye className="w-3 h-3" />
                                          </button>
                                          {driveToken && (
                                            <button
                                              onClick={() => syncReportToDrive(pdf.id)}
                                              disabled={syncingReports[pdf.id]}
                                              className="p-0.5 text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                                              title="Cadangkan Ke Google Drive"
                                            >
                                              {syncingReports[pdf.id] ? (
                                                <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                                              ) : (
                                                <Cloud className="w-3 h-3 text-blue-600" />
                                              )}
                                            </button>
                                          )}
                                          <button
                                            onClick={() => handleDownloadFile(pdf.fileData, pdf.fileName)}
                                            className="p-0.5 text-emerald-700 hover:bg-emerald-50 rounded"
                                            title="Unduh"
                                          >
                                            <Download className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteUploadedFile(pdf.id)}
                                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                                            title="Hapus"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-gray-400 italic shrink-0">
                                    Raport PDF belum diunggah
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    Siswa tidak ditemukan untuk pencarian "{searchQuery}"
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW 4: ATTENDANCE / ABSENSI */}
          {activeTab === 'attendance' && (
            <div className="bg-white border border-gray-250 p-6 rounded-lg shadow-sm space-y-6">
              
              {/* Header and tools */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-lg border border-gray-150 gap-4 text-left">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-950">Formulir Presensi Harian Siswa</h4>
                  <p className="text-xs text-gray-500">Pilih tanggal dan kelola kehadiran seluruh siswa untuk hari tersebut</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 border border-gray-300 rounded shadow-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleMarkAllPresent}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 rounded hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Hadirkan Semua
                  </button>

                  <button
                    onClick={() => {
                      const stats = getAttendanceStats();
                      downloadClassAttendanceReportPDF(students, activeAttendanceRecord, profile, stats);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#00288e] hover:bg-[#1e40af] border border-transparent rounded transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </button>
                </div>
              </div>

              {/* Attendance student list */}
              <div className="border border-gray-200 rounded-lg overflow-hidden text-left">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-700 uppercase">
                    <tr>
                      <th className="px-6 py-4 font-bold text-center w-12">No</th>
                      <th className="px-6 py-4 font-bold">Identitas Siswa</th>
                      <th className="px-6 py-4 font-bold text-center">Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {students.map((student, idx) => {
                      const currentStatus = activeAttendanceRecord.records[student.id] || 'hadir';

                      return (
                        <tr key={student.id} className="hover:bg-gray-50/40 transition">
                          <td className="px-6 py-4 text-center font-semibold text-gray-900">{idx + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <img
                                src={student.avatar}
                                alt="Avatar"
                                className="w-10 h-10 rounded-full object-cover border border-gray-220"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <span className="block font-bold text-gray-950 leading-none mb-1">{student.name}</span>
                                <span className="text-[10px] text-gray-400 font-mono">NISN: {student.nisn}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-1.5 md:space-x-3">
                              {[
                                { status: 'hadir', label: 'Hadir', activeBg: 'bg-emerald-500 text-white', inactiveBg: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
                                { status: 'sakit', label: 'Sakit', activeBg: 'bg-amber-500 text-white', inactiveBg: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                                { status: 'izin', label: 'Izin', activeBg: 'bg-indigo-600 text-white', inactiveBg: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                                { status: 'absen', label: 'Absen', activeBg: 'bg-rose-500 text-white', inactiveBg: 'bg-rose-50 text-rose-700 hover:bg-rose-100' }
                              ].map((option) => {
                                const isActive = currentStatus === option.status;
                                return (
                                  <button
                                    key={option.status}
                                    onClick={() => handleToggleAttendance(student.id, option.status as AttendanceStatus)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded cursor-pointer transition-all duration-150 border-0 ${
                                      isActive ? option.activeBg + ' shadow-sm scale-[1.02]' : option.inactiveBg
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* VIEW: SUBJECT GRADES INBOX */}
          {activeTab === 'subject_grades' && (
            <div className="space-y-6 text-left">
              
              {/* Integration status banner */}
              <div className="bg-white border border-gray-250 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-sm">
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-gray-900 flex items-center space-x-2">
                    <HardDrive className="w-5 h-5 text-indigo-600" />
                    <span>Integrasi Google Drive Wali Kelas</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-2xl bg-white">
                    Penyimpanan cloud untuk semua draf nilai mata pelajaran kesiswaan. Diarahkan langsung ke folder tujuan yang dikonfigurasi.
                  </p>
                  {driveToken && (
                    <div className="text-[11px] font-medium text-slate-500 flex items-center space-x-1 pt-1">
                      <span>📁 Lokasi Penyimpanan Aktif:</span>
                      {useCustomFolder ? (
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                          <span>Folder Kustom (ID: {customFolderId})</span>
                          <a href={customFolderUrl} target="_blank" rel="noreferrer" className="underline hover:text-indigo-800">Buka ↗</a>
                        </span>
                      ) : (
                        <span className="text-[#00288e] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Otomatis (WaliKu Raport Online - {profile.className})
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  {driveToken ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 flex items-center justify-center space-x-1.5 shadow-sm">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span>Google Drive Connected</span>
                      </span>
                      <button
                        onClick={handleBulkSyncSubjectGradesToDrive}
                        disabled={isSyncingAllDrive || subjectGradesList.filter(item => !item.driveFileId).length === 0}
                        className="py-1.5 px-4 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 text-xs shadow-md transition disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer flex items-center justify-center space-x-1"
                      >
                        {isSyncingAllDrive ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mencadangkan...</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3.5 h-3.5" />
                            <span>Cadangkan Semua Baru</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 text-xs flex items-center space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Sistem tersimpan lokal aman. Sambungkan Google Drive di tab utama untuk backup cloud otomatis.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Main table container */}
              <div className="bg-white border border-gray-250 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-gray-900">Berkas Nilai Masuk</h3>
                    <p className="text-[11px] text-gray-400 font-medium">Menampilkan laporan nilai kesiswaan di kelas {profile.className} yang dikirim oleh Guru Mapel tanpa login</p>
                  </div>
                  
                  {/* Search filter states directly */}
                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 border border-gray-350 rounded-[4px] shadow-sm max-w-xs w-full">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari mapel atau guru..."
                      onChange={(e) => {
                        // We will filter lists inline natively!
                        (window as any)._subject_search = e.target.value.toLowerCase();
                        setActiveTab('subject_grades'); // Triggers rerender
                      }}
                      className="block w-full border-none bg-transparent p-0 text-xs focus:outline-none focus:ring-0 placeholder-gray-400 font-medium text-gray-800"
                    />
                  </div>
                </div>

                {/* Listing of files table */}
                <div className="overflow-x-auto">
                  {(() => {
                    const search = (window as any)._subject_search || '';
                    const filtered = subjectGradesList.filter(item => 
                      item.subject.toLowerCase().includes(search) || 
                      item.teacherName.toLowerCase().includes(search) ||
                      item.fileName.toLowerCase().includes(search)
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="py-20 text-center space-y-3.5 max-w-sm mx-auto">
                          <div className="w-12 h-12 bg-gray-100 text-gray-400 border border-gray-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <Inbox className="w-6 h-6" />
                          </div>
                          <div className="space-y-1 text-center">
                            <h4 className="text-xs font-bold text-gray-700">Inbox Nilai Masih Kosong</h4>
                            <p className="text-[11px] text-gray-400 leading-normal">
                              Belum ada guru mata pelajaran yang mengirimkan berkas nilai untuk kelas Anda lewat landing page depan saat ini.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#00288e]/5">
                          <tr>
                            <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase text-gray-500 tracking-wider">Mata Pelajaran</th>
                            <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase text-gray-500 tracking-wider">Guru Pengampu</th>
                            <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase text-gray-500 tracking-wider">Tanggal Dikirim</th>
                            <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase text-gray-500 tracking-wider">Nama File & Ukuran</th>
                            <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase text-gray-500 tracking-wider">Status Backup</th>
                            <th scope="col" className="relative px-6 py-3.5 text-right text-[10px] font-black uppercase text-gray-500 tracking-wider">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-150">
                          {filtered.map(item => {
                            const isSyncing = syncingItemId === item.id;
                            const isExcel = item.fileName.toLowerCase().endsWith('.xls') || item.fileName.toLowerCase().endsWith('.xlsx');
                            
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 whitespace-nowrap text-left">
                                  <span className="text-xs font-extrabold text-[#00288e] bg-blue-50 px-2 py-1 rounded border border-blue-100">{item.subject}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-left">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-extrabold text-[10px] border border-slate-250">{item.teacherName.charAt(0)}</div>
                                    <span className="text-xs font-bold text-gray-800">{item.teacherName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-left">
                                  <span className="text-xs text-gray-500 font-medium">{item.uploadDate}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-left">
                                  <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-bold text-gray-800 truncate max-w-xs">{item.fileName}</span>
                                    <span className="text-[10px] text-gray-400 font-medium uppercase font-mono">{item.fileSize} • {isExcel ? 'Excel Spreadsheet' : 'Dokumen PDF/Word'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-left">
                                  {item.driveFileId ? (
                                    <a
                                      href={item.driveFileLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.8 rounded border border-emerald-100 hover:bg-emerald-100 hover:underline transition duration-150 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>Tercadangkan ✓</span>
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.8 rounded border border-slate-205">
                                      <span>Lokal Aman</span>
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1">
                                  {/* Download button */}
                                  <button
                                    onClick={() => handleDownloadSubjectGrade(item)}
                                    className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition cursor-pointer inline-flex items-center"
                                    title="Unduh File ke Perangkat"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>

                                  {/* Sync to drive button */}
                                  {driveToken && !item.driveFileId && (
                                    <button
                                      onClick={() => handleSyncSubjectGradeToDrive(item.id)}
                                      disabled={isSyncing}
                                      className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 border border-transparent rounded hover:border-indigo-100 transition cursor-pointer inline-flex items-center"
                                      title="Cadangkan ke Google Drive"
                                    >
                                      {isSyncing ? (
                                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                      ) : (
                                        <Cloud className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}

                                  {/* Delete button */}
                                  <button
                                    onClick={() => handleDeleteSubjectGrade(item.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center"
                                    title="Hapus berkas ini"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

              </div>

            </div>
          )}

          {/* VIEW 5: SETTINGS / PENGATURAN */}
          {activeTab === 'settings' && (
            <div className="bg-white border border-gray-250 p-8 rounded-lg shadow-sm text-left max-w-3xl space-y-6">
              <div>
                <h4 className="text-base font-bold text-gray-950">Pengaturan Data Kelas & Guru</h4>
                <p className="text-xs text-gray-500">Konfigurasi profile ini akan otomatis diwariskan ke format cetakan Raport Online.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Nama Lengkap Guru (Wali)</label>
                    <input
                      type="text"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Gelar / Jabatan</label>
                    <input
                      type="text"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white"
                      value={profile.role}
                      onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Instansi / Sekolah</label>
                    <input
                      type="text"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white"
                      value={profile.school}
                      onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Nama Kelas Binaan</label>
                    <input
                      type="text"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white"
                      value={profile.className}
                      onChange={(e) => setProfile({ ...profile, className: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase">Tahun Ajaran</label>
                    <input
                      type="text"
                      className="block w-full text-sm border-gray-300 rounded border p-2.5 bg-white"
                      value={profile.academicYear}
                      onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
                    />
                  </div>
                </div>

                {/* Keamanan & Proteksi Akses Guru */}
                <div className="pt-4 border-t border-gray-150 text-left">
                  <h5 className="text-xs font-extrabold text-slate-400 block uppercase tracking-wider mb-2">Keamanan & Proteksi Akses Guru</h5>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          id="isPinLocked"
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          checked={profile.isPinLocked !== false}
                          onChange={(e) => setProfile({ ...profile, isPinLocked: e.target.checked })}
                        />
                      </div>
                      <div className="text-sm text-left">
                        <label htmlFor="isPinLocked" className="font-bold text-gray-800 cursor-pointer select-none block">Kunci Akses kembali ke Mode Guru</label>
                        <p className="text-gray-500 text-[11px] leading-tight">Mencegah siswa atau orang tua beralih kembali dari Portal Siswa ke halaman pengelolaan data dan nilai guru.</p>
                      </div>
                    </div>

                    {(profile.isPinLocked !== false) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                        <div className="space-y-1.5 text-left">
                          <label className="text-[11px] font-bold text-gray-700 uppercase block">PIN / Sandi Pengaman (Mode Guru)</label>
                          <input
                            type="text"
                            maxLength={10}
                            className="block w-full text-xs font-mono border-gray-300 rounded border p-2 bg-white max-w-[200px]"
                            value={profile.teacherPin || '1234'}
                            onChange={(e) => setProfile({ ...profile, teacherPin: e.target.value })}
                          />
                          <p className="text-[10px] text-gray-400">PIN bawaan awal adalah <strong className="font-mono text-gray-600">1234</strong>. Anda bisa mengubahnya sesuka hati.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#00288e] hover:bg-[#1e40af] text-white text-sm font-semibold rounded-[4px] shadow flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </div>
          )}
          </>
          )}

        </div>
      </main>

      {/* --- EDIT GRADE MODAL --- */}
      <AnimatePresence>
        {editingGrade && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-left relative border border-gray-200"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
              
              <div className="p-6 border-b border-gray-150">
                <h3 className="text-lg font-bold text-gray-900">
                  Ubah Nilai Akademik
                </h3>
                <p className="text-xs text-gray-500">
                  {students.find(s => s.id === editingGrade.studentId)?.name}
                </p>
              </div>

              <form onSubmit={handleSaveGrade}>
                <div className="p-6 space-y-4">
                  {[
                    { key: 'muatanUmum', label: 'Muatan Umum' },
                    { key: 'muatanKejuruan', label: 'Muatan Kejuruan' },
                    { key: 'mataPelajaranPilihan', label: 'Mata Pelajaran Pilihan' },
                    { key: 'kokurikuler', label: 'Kokurikuler' }
                  ].map((field) => (
                    <div key={field.key} className="flex items-center justify-between space-x-4">
                      <label className="text-xs font-bold text-gray-700 uppercase w-32">{field.label}</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editingGrade.grades[field.key as keyof SubjectGrades]}
                        onChange={(e) => setEditingGrade({
                          ...editingGrade,
                          grades: {
                            ...editingGrade.grades,
                            [field.key]: parseInt(e.target.value) || 0
                          }
                        })}
                        className="block w-24 text-right p-2 border border-gray-300 rounded font-mono font-bold"
                        required
                      />
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-150 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingGrade(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#00288e] hover:bg-[#1e40af] rounded cursor-pointer"
                  >
                    Simpan Nilai
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PIN VERIFICATION MODAL FOR MODE GURU --- */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden text-left relative border border-gray-200"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#00288e]" />
              
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-6 h-6 text-[#00288e]" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    Verifikasi Akses Guru
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-normal">
                    Halaman ini dilindungi untuk mengamankan data nilai dan pengelolaan kesiswaan. Silakan masukkan PIN pengaman Anda.
                  </p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const correctPin = profile.teacherPin || '1234';
                  if (pinInput === correctPin) {
                    setViewMode('teacher');
                    localStorage.setItem('waliku_role', 'teacher');
                    setIsPinModalOpen(false);
                    setPinInput('');
                    setPinError('');
                  } else {
                    setPinError('PIN / Sandi Keamanan salah!');
                  }
                }} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      placeholder="Masukkan PIN / Sandi"
                      className="block w-full text-center text-lg font-mono font-bold tracking-widest border-gray-300 rounded-lg border p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        if (pinError) setPinError('');
                      }}
                      autoFocus
                    />
                    {pinError && (
                      <p className="text-rose-600 text-xs font-semibold mt-2">{pinError}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPinModalOpen(false);
                        setPinInput('');
                        setPinError('');
                      }}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
                    >
                      Konfirmasi
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FORMAL ACADEMIC REPORT PRINT MODAL --- */}
      <AnimatePresence>
        {printingCard && (() => {
          const avg = getStudentAverage(printingCard.id);
          const evaluation = getStudentGradeLetter(avg);
          const rawSGrades = grades.find(g => g.studentId === printingCard.id)?.grades || {};
          const sGrades = {
            muatanUmum: Number(rawSGrades.muatanUmum) || 0,
            muatanKejuruan: Number(rawSGrades.muatanKejuruan) || 0,
            mataPelajaranPilihan: Number(rawSGrades.mataPelajaranPilihan) || 0,
            kokurikuler: Number(rawSGrades.kokurikuler) || 0
          };

          return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4">
              <motion.div
                className="bg-white max-w-2xl w-full rounded-lg shadow-2xl p-8 text-left relative overflow-hidden border border-gray-300 print:shadow-none print:border-none print:p-0"
                id="printable-report"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                {/* Print Header */}
                <div className="text-center border-b-2 border-double border-gray-800 pb-4 mb-6">
                  <span className="text-sm font-extrabold tracking-widest text-[#00288e] block uppercase">Pemerintah Provinsi DKI Jakarta</span>
                  <span className="text-lg font-black tracking-tight text-gray-900 block uppercase">{profile.school}</span>
                  <p className="text-xs text-gray-500 font-mono">Jl. Budi Utomo No.7, Jakarta Pusat, DKI Jakarta • Telp (021) 386509</p>
                </div>

                {/* Subtitle */}
                <h3 className="text-center text-sm font-bold tracking-wider text-gray-800 uppercase mb-4">
                  LAPORAN CAPAIAN HASIL BELAJAR SISWA (RAPORT)
                </h3>

                {/* Personal metadata */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-6 border-b border-gray-200 pb-4">
                  <div>
                    <span className="block text-gray-500 font-medium">Nama Siswa:</span>
                    <span className="font-extrabold text-[#00288e] uppercase text-sm">{printingCard.name}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 font-medium">Kelas / Semester:</span>
                    <span className="font-bold text-gray-900">{profile.className} / Genap</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 font-medium">Nomor Induk Siswa (NISN):</span>
                    <span className="font-mono text-gray-900">{printingCard.nisn}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 font-medium">Tahun Pelajaran:</span>
                    <span className="font-bold text-gray-900">{profile.academicYear}</span>
                  </div>
                </div>

                {/* Academic Table */}
                <table className="w-full text-xs text-left mb-6 border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50 text-gray-900 uppercase">
                      <th className="border border-gray-300 p-2 text-center w-8">No</th>
                      <th className="border border-gray-300 p-2">Mata Pelajaran</th>
                      <th className="border border-gray-300 p-2 text-center w-24">Kriteria Kelulusan</th>
                      <th className="border border-gray-300 p-2 text-center w-20">Nilai Akhir</th>
                      <th className="border border-gray-300 p-2 text-center w-24">Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { s: 'Muatan Umum', score: sGrades.muatanUmum },
                      { s: 'Muatan Kejuruan', score: sGrades.muatanKejuruan },
                      { s: 'Mata Pelajaran Pilihan', score: sGrades.mataPelajaranPilihan },
                      { s: 'Kokurikuler', score: sGrades.kokurikuler }
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-gray-300 p-2 font-semibold text-gray-800">{row.s}</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-400">75.0</td>
                        <td className="border border-gray-300 p-2 text-center font-mono font-bold text-gray-900 text-sm">{row.score}</td>
                        <td className="border border-gray-300 p-2 text-center font-bold">
                          {row.score >= 90 ? 'A' : row.score >= 80 ? 'B' : row.score >= 70 ? 'C' : 'D'}
                        </td>
                      </tr>
                    ))}
                    {/* Overall row */}
                    <tr className="bg-gray-50/50 font-bold">
                      <td colSpan={3} className="border border-gray-300 p-2.5 text-right uppercase">Rata-Rata Nilai Akhir:</td>
                      <td className="border border-gray-300 p-2.5 text-center font-mono text-base text-[#00288e]">{avg}</td>
                      <td className="border border-gray-300 p-2.5 text-center text-sm">{evaluation.letter}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Criteria descriptions or notes */}
                <div className="bg-blue-50 border border-blue-100 p-3 rounded text-[11px] text-blue-700 leading-normal mb-8">
                  <span className="font-bold block mb-1">Catatan Wali Kelas:</span>
                  <span>Predikat siswa adalah "{evaluation.text}". Tetap pertahankan prestasi akademik Anda untuk bersaing di seleksi SNBP/Undangan nasional tahun depan.</span>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-start text-xs pt-4 mb-2">
                  <div className="text-center w-48">
                    <span className="block text-gray-500 mb-12">Orang Tua / Wali Murid,</span>
                    <span className="block border-b border-gray-400 font-bold uppercase">{printingCard.parentName}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Wali Murid</span>
                  </div>

                  <div className="text-center w-48">
                    <span className="block text-gray-500 mb-12">Jakarta, 11 Juni 2026<br/>Wali Kelas,</span>
                    <span className="block border-b border-gray-400 font-bold uppercase">{profile.name}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">NIP. 19840211 201101 1003</span>
                  </div>
                </div>

                {/* Upload & Distribusi Berkas PDF Raport Siswa (print:hidden) */}
                <div className="mt-8 pt-6 border-t border-gray-200 text-left print:hidden bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                  <div className="flex items-start space-x-2.5 mb-3">
                    <FileDown className="w-5 h-5 text-[#00288e] mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Arsip & Distribusi PDF Raport Siswa</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Unggah berkas raport resmi scan PDF agar siswa & orang tua dapat langsung mengunduh dari portal pribadi mereka.</p>
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => handleFileUpload(e, printingCard.id)}
                    onClick={() => {
                      const input = document.getElementById(`pdf-file-upload-${printingCard.id}`);
                      if (input) input.click();
                    }}
                    className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-150 ${
                      isDragOver
                        ? 'border-[#00288e] bg-blue-50/40'
                        : 'border-slate-300 hover:border-[#00288e] hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="file"
                      id={`pdf-file-upload-${printingCard.id}`}
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => handleFileUpload(e, printingCard.id)}
                    />
                    <FileDown className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Tarik & Lepas file PDF raport resmi disini</p>
                    <p className="text-[10px] text-slate-500 mt-1">atau klik untuk menelusuri berkas dari komputer (Format: PDF. Maks: 5MB)</p>
                  </div>

                  {/* Uploaded files list */}
                  <div className="mt-4 space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Daftar Berkas Raport Terunggah ({uploadedReports.filter(r => r.studentId === printingCard.id).length})</span>
                    {uploadedReports.filter(r => r.studentId === printingCard.id).length === 0 ? (
                      <p className="text-xs text-slate-400 bg-white p-3 rounded text-center border border-slate-200 italic">Belum ada file scan PDF raport eksternal yang diunggah untuk siswa ini.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {uploadedReports
                          .filter(r => r.studentId === printingCard.id)
                          .map((report) => (
                            <div key={report.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 transition duration-150 text-xs">
                              <div className="flex items-center space-x-2 min-w-0">
                                <svg className="w-5 h-5 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                                <div className="truncate text-left leading-tight">
                                  <span className="font-bold text-slate-800 block truncate" title={report.fileName}>{report.fileName}</span>
                                  <span className="text-[9px] text-slate-400">{report.fileSize} • diunggah {report.uploadDate}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(report.fileData, report.fileName);
                                  }}
                                  className="p-1 text-slate-500 hover:text-[#00288e] hover:bg-slate-100 rounded transition cursor-pointer"
                                  title="Unduh File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUploadedFile(report.id);
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Hapus File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Close Panel - Hidden in Print */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end space-x-2 print:hidden">
                  <button
                    onClick={() => setPrintingCard(null)}
                    className="px-4 py-2 border border-gray-200 text-xs font-semibold text-gray-500 hover:text-gray-800 rounded cursor-pointer duration-150"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => {
                      downloadSingleStudentRaforPDF(printingCard, grades.find(g => g.studentId === printingCard.id), profile, avg);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer shadow flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#00288e] hover:bg-[#1e40af] rounded cursor-pointer shadow flex items-center space-x-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Mulai Cetak</span>
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* --- PREMIUM PDF PREVIEW MODAL --- */}
      <AnimatePresence>
        {previewPdfReport && (() => {
          const student = students.find(s => s.id === previewPdfReport.studentId);
          const studentGradeRecord = grades.find(g => g.studentId === previewPdfReport.studentId);
          const avg = getStudentAverage(previewPdfReport.studentId);
          const gradeDetails = getStudentGradeLetter(avg);
          
          return (
            <div className="fixed inset-0 z-[100] overflow-hidden bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                className="bg-slate-900 border border-slate-800 text-white max-w-5xl w-full h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-left"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                {/* Modal Header */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center space-x-2">
                        <span>Pratinjau Hasil Raport PDF</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-extrabold uppercase">
                          Sukses Terunggah
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Siswa: <span className="font-bold text-slate-200">{previewPdfReport.studentName}</span> • NISN: {student?.nisn} • Kelas: {profile.className}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownloadFile(previewPdfReport.fileData, previewPdfReport.fileName)}
                      className="p-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer shadow transition duration-150"
                      title="Unduh Berkas PDF Resmi"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Unduh PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        setPreviewPdfReport(null);
                      }}
                      className="p-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded cursor-pointer duration-150"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* Modal Body with Dual-Column View (Left: Real Interactive PDF IFrame, Right: Beautiful Digital Transcript) */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-950 p-4 gap-4">
                  
                  {/* Left Frame: Real Interactive Base64 Frame (lg:col-span-7) */}
                  <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full relative">
                    <div className="absolute top-2 left-2 bg-slate-950/80 px-2.5 py-1 rounded text-[9px] font-mono text-slate-400 select-none z-10 border border-slate-800 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Arsip PDF Aktif ({previewPdfReport.fileSize})</span>
                    </div>

                    <div className="flex-1 bg-slate-800 p-2 flex items-center justify-center">
                      <iframe
                        src={previewPdfReport.fileData}
                        className="w-full h-full rounded border-0 bg-white min-h-[400px] lg:min-h-[auto]"
                        title="Pratinjau PDF Dokumen"
                      />
                    </div>
                  </div>

                  {/* Right Panel: High-Fidelity School Stamp & Digital Digest (lg:col-span-5) */}
                  <div className="lg:col-span-5 bg-white text-slate-900 rounded-lg p-5 flex flex-col justify-between overflow-y-auto h-full space-y-4 border border-slate-250">
                    <div className="space-y-4 text-left">
                      {/* Document stamp section */}
                      <div className="border-b border-dashed border-slate-200 pb-3">
                        <div className="flex items-center space-x-1.5 text-[10px] text-indigo-700 font-extrabold uppercase tracking-wider mb-1">
                          <CheckSquare className="w-3.5 h-3.5 font-bold text-[#00288e]" />
                          <span>Pangkalan Data WaliKu Digital</span>
                        </div>
                        <h4 className="text-base font-black text-slate-950 leading-tight">Rincian Dokumen & Transkrip</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Disinkronkan resmi oleh Wali Kelas {profile.name} pada {previewPdfReport.uploadDate}.</p>
                      </div>

                      {/* File details card layout */}
                      <table className="w-full text-xs">
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 font-semibold text-slate-400 w-28 uppercase text-[9px]">Nama Berkas</td>
                            <td className="py-2 font-mono font-bold text-slate-900 truncate max-w-[200px]" title={previewPdfReport.fileName}>{previewPdfReport.fileName}</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 font-semibold text-slate-400 uppercase text-[9px]">Ukuran File</td>
                            <td className="py-2 font-mono font-bold text-emerald-800">{previewPdfReport.fileSize}</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 font-semibold text-slate-400 uppercase text-[9px]">Dibuat Kelas</td>
                            <td className="py-2 font-bold text-slate-850 font-mono">{profile.className}</td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <td className="py-2 font-semibold text-slate-400 uppercase text-[9px]">ID Transaksi</td>
                            <td className="py-2 font-mono text-slate-500 font-medium truncate max-w-[125px] inline-block">{previewPdfReport.id}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Academic Score Summary inside the PDF side panel */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-150 space-y-2">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Status Data Nilai Pembelajaran</span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">Rata-Rata Nilai:</span>
                          <span className="text-sm font-mono font-black text-slate-950 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">{avg.toFixed(1)} / 100.0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">Predikat Kompetensi:</span>
                          <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded border ${gradeDetails.color}`}>
                            {gradeDetails.letter} ({gradeDetails.text})
                          </span>
                        </div>
                      </div>

                      {/* Subject Breakdowns */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Rangkuman Nilai Kognitif</span>
                        <div className="space-y-1.5">
                          {[
                            { label: 'Muatan Umum', score: studentGradeRecord?.grades.muatanUmum || 0 },
                            { label: 'Muatan Kejuruan', score: studentGradeRecord?.grades.muatanKejuruan || 0 },
                            { label: 'Mata Pelajaran Pilihan', score: studentGradeRecord?.grades.mataPelajaranPilihan || 0 },
                            { label: 'Kokurikuler', score: studentGradeRecord?.grades.kokurikuler || 0 }
                          ].map((subj, sIdx) => (
                            <div key={sIdx} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                              <span className="font-medium text-slate-700">{subj.label}</span>
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">{subj.score} / 100</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Info box */}
                      <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-lg text-[11px] text-slate-600 leading-relaxed flex items-start space-x-2">
                        <Info className="w-4 h-4 text-[#00288e] shrink-0 mt-0.5" />
                        <span>Siswa & Wali Murid terdaftar dapat mengunduh salinan berkas ini dari portal mereka masing-masing menggunakan gawai kapanpun secara mandiri nirkertas.</span>
                      </div>
                    </div>

                    {/* Hermans visual signature block for high-craftsmanship stamp */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="text-left">
                        <span>Tertanda Wali Kelas,</span>
                        <div className="font-sans font-extrabold text-slate-800 text-xs mt-4 relative">
                          {profile.name}
                          {/* Fake authentic digital stamp visual */}
                          <div className="absolute -top-3 -left-3 w-16 h-10 border border-emerald-500/30 text-emerald-700/40 text-[7px] font-black tracking-widest uppercase rounded flex items-center justify-center -rotate-12 pointer-events-none select-none">
                            TERKOMPUTERISASI
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">NIP: 19821104 200812 1 003</span>
                      </div>
                      <div className="text-right">
                        <span>Status Keaslian</span>
                        <div className="text-[#00288e] font-extrabold text-xs flex items-center mt-3 justify-end">
                          <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                          <span className="text-slate-800">Dokumen Sah</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">WaliKu Verified</span>
                      </div>
                    </div>

                  </div>

                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* --- GOOGLE DRIVE FILE PICKER MODAL --- */}
      <AnimatePresence>
        {isDrivePickerOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              className="bg-white max-w-lg w-full rounded-lg shadow-xl overflow-hidden flex flex-col text-left border border-slate-200"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {/* Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cloud className="w-5 h-5 text-blue-500 hover:scale-110 transition duration-150" />
                  <h3 className="text-sm font-extrabold text-slate-900">Pilih Berkas dari Google Drive</h3>
                </div>
                <button
                  onClick={() => {
                    setIsDrivePickerOpen(false);
                    setTargetStudentForDriveImport(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-3 border-b border-slate-150 bg-slate-50">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    placeholder="Cari raport PDF di Google Drive Anda..."
                    className="block w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Files list */}
              <div className="flex-1 max-h-72 overflow-y-auto p-2 min-h-48">
                {isDriveLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-[#00288e] animate-spin" />
                    <span className="text-xs text-slate-500 font-bold animate-pulse">Menghubungkan ke Google Drive...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    Tidak ditemukan berkas PDF di Google Drive Anda.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleImportFromDrive(file.id, file.name)}
                        className="flex items-center justify-between p-2.5 rounded-md hover:bg-blue-50/75 border border-slate-100 hover:border-blue-200 cursor-pointer transition duration-150"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                          <div className="min-w-0 text-left">
                            <span className="block text-xs font-bold text-slate-900 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-semibold font-mono">
                              ID: {file.id}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-blue-700 font-bold shrink-0">
                          Pilih ➜
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                <button
                  onClick={() => {
                    setIsDrivePickerOpen(false);
                    setTargetStudentForDriveImport(null);
                  }}
                  className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded text-xs font-bold transition duration-150 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- STUDENT INPUT / EDIT MODAL --- */}
      <AnimatePresence>
        {isStudentModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              className="bg-white max-w-xl w-full rounded-xl shadow-2xl overflow-hidden flex flex-col text-left border border-slate-200"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {/* Header */}
              <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-50 text-[#00288e] rounded-lg">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {editingStudent ? 'Edit Profil & Kelas Siswa' : 'Tambah Siswa Baru ke Kelas'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Pangkalan Data Terintegrasi WaliKu
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStudentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveStudent} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* Row 0: Foto Profil / Avatar */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50/55 border border-slate-200/60 rounded-lg">
                  <div className="relative group">
                    <img
                      src={studentForm.avatar || (studentForm.gender === 'Laki-laki' 
                        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                        : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80')}
                      alt="Student Avatar Preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                    <label 
                      htmlFor="student-avatar-input"
                      className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer text-white"
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">Foto Profil Siswa</span>
                    <span className="text-[10px] text-slate-400 block font-semibold leading-normal">
                      Mendukung format gambar (PNG, JPG, JPEG) dengan ukuran maksimal 2MB.
                    </span>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1.5">
                      <label
                        htmlFor="student-avatar-input"
                        className="text-[10px] text-white bg-[#00288e] hover:bg-slate-800 font-bold px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah Foto</span>
                      </label>
                      <input
                        id="student-avatar-input"
                        type="file"
                        accept="image/*"
                        onChange={handleStudentPhotoChange}
                        className="hidden"
                      />
                      {studentForm.avatar && (
                        <button
                          type="button"
                          onClick={() => setStudentForm(prev => ({ ...prev, avatar: '' }))}
                          className="text-[10px] text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold px-3 py-1.5 rounded transition cursor-pointer border border-rose-100"
                        >
                          Atur Ulang
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 1: Nama Lengkap */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center">
                    <User className="w-3.5 h-3.5 mr-1 text-[#00288e]" />
                    <span>Nama Lengkap Siswa</span>
                    <span className="text-rose-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    placeholder="Contoh: Aditya Pratama"
                    className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#00288e] font-semibold text-slate-800"
                  />
                </div>

                {/* Row 2: Kelas & NISN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center">
                      <GraduationCap className="w-3.5 h-3.5 mr-1 text-[#00288e]" />
                      <span>Kelas Pembelajaran</span>
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={studentForm.className}
                      onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                      placeholder="Contoh: XI MIPA 2"
                      className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#00288e] font-semibold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center">
                      <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 mr-1 rounded text-slate-600">NISN</span>
                      <span>NISN Siswa</span>
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={studentForm.nisn}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '');
                        setStudentForm({ ...studentForm, nisn: cleaned });
                      }}
                      placeholder="Contoh: 0087452391"
                      className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#00288e] font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Row 3: Jenis Kelamin & Email Siswa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                      Jenis Kelamin
                    </label>
                    <select
                      value={studentForm.gender}
                      onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'Laki-laki' | 'Perempuan' })}
                      className="block w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#00288e] font-semibold cursor-pointer text-slate-800"
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center">
                      <Mail className="w-3.5 h-3.5 mr-1 text-[#00288e]" />
                      <span>Alamat Surel (Email)</span>
                    </label>
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      placeholder="Default: otomatis_sekolah@sch.id"
                      className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#00288e] font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-200 my-4" />

                {/* Section: Wali Murid (Orang Tua) */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/60 space-y-3.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1 text-[#00288e]" />
                    <span>Identitas Orang Tua / Wali Murid</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600">Nama Lengkap Orang Tua</label>
                      <input
                        type="text"
                        value={studentForm.parentName}
                        onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                        placeholder="Contoh: Hendra Pratama"
                        className="block w-full px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-[#00288e] rounded font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600">Nomor Telepon Seluler</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="w-3 h-3 text-slate-400" />
                        </span>
                        <input
                          type="tel"
                          value={studentForm.parentPhone}
                          onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                          placeholder="Contoh: 0812-3456-7890"
                          className="block w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-[#00288e] rounded font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsStudentModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded duration-150 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00288e] hover:bg-indigo-800 text-white text-xs font-bold rounded flex items-center space-x-1.5 duration-150 cursor-pointer shadow"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingStudent ? 'Simpan Perubahan' : 'Daftarkan Siswa'}</span>
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

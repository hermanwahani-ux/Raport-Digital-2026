import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (handle firestoreDatabaseId if exists, fallback to custom applet database ID)
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-c2707df8-85e8-443b-8944-45fd6ef72350");
export const auth = getAuth(app);

// Ensures there is always an authenticated session with Firebase
export async function ensureSignedInUser(): Promise<any> {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const res = await signInAnonymously(auth);
          resolve(res.user);
        } catch (error) {
          console.warn("Firebase Anonymous Auth fallback is restricted (requires enabling " +
                       "Anonymous Auth in the Firebase Console):", error);
          // Gently resolve null so the application can still fall back to public/guest operation
          resolve(null);
        }
      }
    });
  });
}

// Operational and Error definitions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = 
    errMsg.toLowerCase().includes('quota') || 
    errMsg.toLowerCase().includes('limit') || 
    errMsg.toLowerCase().includes('exceeded') || 
    errMsg.toLowerCase().includes('kuota') || 
    errMsg.toLowerCase().includes('dibatasi') ||
    errMsg.toLowerCase().includes('terlampaui');
  
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaExceeded) {
    console.warn(
      `Firestore Quota Exceeded Warn: Operasi '${operationType}' pada '${path}' ditangguhkan karena batasan kuota Firestore Spark Free Plan terlampaui.\n` +
      `Sistem secara aman beralih ke Mode Penyimpanan Lokal (LocalStorage & IndexedDB) secara transparan agar aplikasi tetap dapat digunakan secara optimal.\n` +
      `Catatan: Kuota baca/tulis gratis harian Firebase Spark akan otomatis di-reset besok.`
    );
    if (operationType === OperationType.GET || operationType === OperationType.LIST) {
      throw new Error(`Koneksi cloud dibatasi oleh kuota gratis Firebase (Spark Plan). Penyimpanan lokal telah diaktifkan secara aman.`);
    }
    return;
  } else {
    console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
}

// Test Connection Helper on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration: the client is offline.");
    }
  }
}

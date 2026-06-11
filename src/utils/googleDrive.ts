/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse firebase instance if already initialized, or initialize it
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// We use the full drive scope as requested by user
provider.addScope('https://www.googleapis.com/auth/drive');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('waliku_drive_token');

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedToken = localStorage.getItem('waliku_drive_token');
      if (savedToken) {
        cachedAccessToken = savedToken;
        if (onAuthSuccess) onAuthSuccess(user, savedToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('waliku_drive_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in flow
export const connectGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth Provider');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('waliku_drive_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase OAuth error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Disconnect from Google Drive
export const disconnectGoogleDrive = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('waliku_drive_token');
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Utilities to convert DataURL to Blob
export function dataURLToBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Convert Blob/File to Base64 String
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = (e) => {
      reject(e);
    };
    reader.readAsDataURL(blob);
  });
}

// Google Drive API Helpers

/**
 * Creates a folder in Google Drive
 */
export async function createDriveFolder(token: string, folderName: string): Promise<string> {
  // First, check if a folder with the same name already exists
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
      return listData.files[0].id;
    }
  }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Uploads a file (base64 Data URL or file string) to Google Drive in a specific folder
 */
export async function uploadFileToDrive(
  token: string,
  fileName: string,
  fileDataUrl: string,
  folderId?: string
): Promise<{ id: string; webViewLink?: string }> {
  const fileBlob = dataURLToBlob(fileDataUrl);
  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: folderId ? [folderId] : undefined
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload file to Google Drive: ${errText}`);
  }

  return await uploadRes.json();
}

/**
 * Deletes a file from Google Drive (Requires user confirmation at API caller level)
 */
export async function deleteFileFromDrive(token: string, fileId: string): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}

/**
 * Lists PDF files in Google Drive
 */
export async function listPdfFilesFromDrive(token: string, queryText?: string): Promise<{ id: string; name: string; size?: string; createdTime?: string }[]> {
  let q = "mimeType='application/pdf' and trashed=false";
  if (queryText) {
    q += ` and name contains '${encodeURIComponent(queryText)}'`;
  }
  
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,createdTime)&orderBy=modifiedTime desc&pageSize=30`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    throw new Error('Failed to retrieve PDF files from Google Drive');
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Downloads a file by ID and converts it to a base64 Data URL
 */
export async function downloadFileAsBase64(token: string, fileId: string): Promise<{ fileData: string; sizeString: string }> {
  // First fetch metadata to get size and filename
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  let size = 0;
  if (metaRes.ok) {
    const meta = await metaRes.json();
    size = parseInt(meta.size || '0');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to download media file from Google Drive');
  }

  const blob = await res.blob();
  const fileData = await blobToDataURL(blob);
  const sizeString = (size / (1024 * 1024)).toFixed(2) + ' MB';

  return { fileData, sizeString };
}

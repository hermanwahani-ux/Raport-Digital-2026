/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraduationCap } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="footer" className="bg-gray-50 border-t border-gray-150 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0 text-left">
          
          {/* Logo Brand / Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="bg-[#00288e] text-white p-1 rounded flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="font-sans text-base font-bold tracking-tight text-[#00288e]">WaliKu</span>
            </div>
            <p className="font-sans text-xs text-gray-500 max-w-sm leading-relaxed">
              &copy; 2024-{currentYear} WaliKu. Membantu Guru Wali Kelas Mengelola Masa Depan.
            </p>
          </div>

          {/* Quick Legal Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button
              onClick={() => alert('Kebijakan Privasi: Semua data siswa terenkripsi aman di cloud server sekolah.')}
              className="text-xs text-gray-500 hover:text-[#00288e] hover:underline font-medium cursor-pointer"
            >
              Kebijakan Privasi
            </button>
            <button
              onClick={() => alert('Syarat & Ketentuan: Penggunaan eksklusif untuk pendidik dan lembaga berlisensi.')}
              className="text-xs text-gray-500 hover:text-[#00288e] hover:underline font-medium cursor-pointer"
            >
              Syarat & Ketentuan
            </button>
            <button
              onClick={() => alert('Pusat Bantuan: Silakan email support@waliku.sch.id atau call center 24/7.')}
              className="text-xs text-gray-500 hover:text-[#00288e] hover:underline font-medium cursor-pointer"
            >
              Bantuan
            </button>
            <button
              onClick={() => {
                const nav = document.getElementById('navbar');
                if (nav) nav.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs text-gray-500 hover:text-[#00288e] hover:underline font-medium cursor-pointer"
            >
              Kontak Kami
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
}

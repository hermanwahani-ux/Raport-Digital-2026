/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bell, BarChart2, CheckSquare } from 'lucide-react';
import { motion } from 'motion/react';

export default function Features() {
  const cards = [
    {
      icon: <Bell className="w-6 h-6 text-white" />,
      iconBg: 'bg-[#2563eb]', // Blue
      title: 'Pengumuman Digital',
      description: 'Kirim pengumuman penting ke orang tua dan siswa secara instan melalui aplikasi. Pastikan semua pihak mendapatkan informasi terbaru tepat waktu.',
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-white" />,
      iconBg: 'bg-[#14b8a6]', // Teal
      title: 'Raport Online',
      description: 'Akses dan kelola nilai siswa secara digital dengan keamanan tingkat tinggi. Cetak dan bagikan laporan kemajuan siswa hanya dengan beberapa klik.',
    },
    {
      icon: <CheckSquare className="w-6 h-6 text-white" />,
      iconBg: 'bg-[#1e3a8a]', // Dark Blue
      title: 'Manajemen Absensi',
      description: 'Lacak kehadiran siswa setiap hari dengan mudah. Dapatkan rekapitulasi otomatis untuk laporan bulanan tanpa perlu input manual.',
    }
  ];

  return (
    <section id="features" className="py-20 bg-gray-50/50 border-t border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Header Title */}
        <div className="max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-sans text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Solusi Lengkap untuk Administrasi Kelas
          </h2>
          <p className="font-sans text-base text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Kami merancang setiap fitur untuk memudahkan beban kerja administratif Anda, memberikan lebih banyak waktu untuk fokus pada perkembangan siswa.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={index}
              className="bg-white border border-gray-200/80 p-8 rounded-lg shadow-sm text-left flex flex-col space-y-5 hover:shadow-md hover:border-gray-300 transition-all duration-300 relative group overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00288e] opacity-0 group-hover:opacity-100 transition-all duration-300" />
              
              {/* Custom Icon Box */}
              <div className={`${card.iconBg} w-11 h-11 rounded-[6px] flex items-center justify-center shadow-sm`}>
                {card.icon}
              </div>

              {/* Card Meta */}
              <div className="space-y-2">
                <h3 className="font-sans text-lg font-bold text-gray-900 group-hover:text-[#00288e] transition-colors duration-200">
                  {card.title}
                </h3>
                <p className="font-sans text-sm text-gray-500 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

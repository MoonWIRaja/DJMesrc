# PRODUCT REQUIREMENTS DOCUMENT (PRD): DJMesrc

| Maklumat Dokumen | Butiran |
| :--- | :--- |
| **Nama Projek** | **DJMesrc** |
| **Jenis Aplikasi** | Aplikasi Desktop Native Windows (`.exe`) |
| **Stack Utama** | Rust (Tauri v2 + Rodio/Symphonia) + Vite (React, TypeScript, Tailwind CSS, shadcn/ui) |
| **Gaya Reka Bentuk** | Bright white event audio console with pink and matcha-green deck accents; no dark mode or promotional hero |
| **Status Dokumen** | v0.5.4 membuang kawalan VINYL SPIN dan memastikan piring berputar setiap kali dek memainkan audio; v0.5.3 menambah tekstur putaran yang lebih jelas serta menu konteks untuk trek dan SFX; v0.5.2 memastikan platter kekal berputar semasa fade-out dan menambah gerakan susunan Queue ketika drag serta penanda dek aktif; v0.5.1 membesarkan empty state Queue supaya memenuhi ruang panel seperti Sound FX; v0.5.0 menyamakan ikon DJ hijau matcha pada aplikasi, installer dan uninstaller serta platter vinil bertekstur |

---

> **Implementation status (23 October 2026):** The desktop MVP has been built in the monorepo with Tauri v2, React/TypeScript/Vite and a Rust audio engine. A successful compile is not runtime audio acceptance. Playback on Windows with an output device, representative audio files, and installer launch still need to be recorded before acceptance criteria can be marked passed. The original stack and roadmap below are proposals; the as-built notes in Sections 2 and 7 describe the current implementation.

## 1. Ringkasan Eksekutif & Visi Produk
*(Disediakan oleh: Ejen Strategi Produk)*

**DJMesrc** ialah sebuah aplikasi dek DJ dan papan kesan bunyi (*soundboard*) desktop untuk sistem operasi Windows (`.exe`) yang direka khusus untuk kepantasan, ketepatan, dan kemudahan penggunaan tanpa serabut (*zero-bloat*).

### 1.1 Pengguna Utama dan Senario Penggunaan

Pengguna utama ialah staf syarikat kecil yang mengendalikan muzik untuk acara kecil tanpa pengalaman menggunakan perisian DJ yang kompleks. Antara muka perlu mudah difahami dan membolehkan staf bertindak pantas tanpa latihan DJ khusus.

Senario utama ialah memainkan muzik latar pada satu dek pada volum yang sesuai, kemudian memainkan lagu acara pada dek satu lagi dengan volum lebih tinggi. Staf mengawal lagu yang lebih kedengaran menggunakan kawalan volum berasingan bagi setiap dek. Muzik boleh terus bermain serentak. Tiada dek yang ditetapkan khusus untuk muzik latar atau lagu acara; staf menentukan sendiri peranan setiap dek.

### 1.2 Tingkah Laku Campuran, Stop dan SFX

* **Kawalan dek bebas:** Setiap dek mempunyai kawalan volum sendiri. Menukar volum satu dek tidak mengubah tetapan dek lain.
* **Pause dengan fade:** Apabila dek sedang bermain, `Pause` memudarkan audio dek sasaran selama **2 saat**, kemudian menjedanya sambil mengekalkan posisi semasa dan kedudukan playlist.
* **Stop dengan fade:** Apabila dek sedang bermain, `Stop` memudarkan audio dek sasaran selama **2 saat**, kemudian menetapkan posisi ke `00:00`. Tingkah laku ini sama sama ada dek lain sedang bermain atau tidak.
* Fade hanya menukar gain sementara dan tidak mengubah fader pilihan pengguna atau output dek yang satu lagi. Jika pengguna menekan `Play` semasa fade, batalkan fade, pulihkan gain, dan sambung dari posisi semasa.
* **SFX dengan ducking:** Semasa satu atau lebih SFX berbunyi, volum output muzik bagi setiap dek yang sedang bermain diturunkan sementara. Jika kedua-dua dek bermain, kedua-duanya di-duck; jika satu dek bermain, dek itu sahaja. SFX berjalan serentak; SFX kedua dan seterusnya tidak menunggu SFX terdahulu tamat. Muzik kekal di-duck sehingga SFX aktif yang terakhir tamat, kemudian output kembali mengikut nilai fader semasa.
* Jika pengguna mengubah fader dek semasa ducking, simpan nilai baharu itu sebagai tahap volum pilihan pengguna; selepas SFX terakhir tamat, pulihkan output mengikut nilai baharu tersebut, bukan nilai fader lama.

**Bahasa UI:** Semua teks yang dipaparkan dalam aplikasi—label, butang, mesej, dialog, petunjuk papan kekunci dan keadaan ralat—mesti dalam bahasa Inggeris.

**Kriteria penerimaan UX awal:** (1) dua dek boleh dimainkan serentak dengan tahap volum berasingan; (2) Pause dan Stop memudarkan dek sasaran sahaja selama 2 saat sebelum bertindak, tanpa mengira keadaan dek lain; (3) Pause mengekalkan posisi, manakala Stop kembali ke `00:00`; (4) Play boleh membatalkan fade dan menyambung playback; (5) SFX merendahkan output semua dek yang sedang bermain dan memulihkannya selepas SFX terakhir tamat; (6) fader pilihan pengguna kekal sama selepas fade/ducking; (7) semua teks UI dipaparkan dalam bahasa Inggeris.

### 1.3 Aliran Skrin Utama dan Interaksi

1. **Pilih atau tambah lagu:** Dua playlist kekal berasingan dan sentiasa kelihatan pada dek masing-masing. Staf memilih lagu daripada playlist atau menambah fail audio ke dek yang dikehendaki.
2. **Mainkan dek:** Setiap dek menunjukkan nama lagu semasa, masa/kemajuan, `Play/Pause`, `Stop`, `Restart`, volum, `Mute` dan `Loop`. Kedua-dua dek boleh dimainkan serentak.
   * Setiap dek memaparkan status playback bahasa Inggeris yang jelas: `PLAYING`, `PAUSED`, `FADING`, `STOPPED`, atau `MISSING FILE`.
   * Setiap dek mempunyai meter level audio ringkas yang menunjukkan signal output sebenar dek itu; meter bukan waveform hiasan. Meter memberi amaran visual apabila signal menghampiri clipping/limiter, tanpa menggantikan limiter audio.
3. **Kawal apa yang kedengaran:** Staf melaras fader volum dek secara bebas. Label `LEFT/RIGHT` dan huruf dek mengenal pasti saluran; aksen warna yang terkawal menunjukkan status dan tidak menetapkan dek sebagai background atau lagu acara.
4. **Jeda atau hentikan dek:** `Pause` dan `Stop` menunjukkan keadaan `FADING` dan memudarkan dek sasaran selama 2 saat. `Pause` mengekalkan posisi; `Stop` kembali ke `00:00`. Tingkah laku sama apabila satu atau dua dek sedang bermain.
5. **Mainkan SFX:** Pad SFX berada di kawasan khusus yang mudah dicapai. Semasa SFX aktif, indikator menunjukkan muzik sedang direndahkan; tahap asal dipulihkan selepas SFX terakhir selesai.

**Prinsip interaksi:** Susun atur desktop mengutamakan dua dek bersebelahan dan SFX di bawahnya. Kawalan Play/Stop dan fader perlu jelas serta mudah dicapai oleh operator baru. Tindakan kekunci pantas memberi maklum balas keadaan serta-merta. Piring berputar setiap kali dek memainkan audio, termasuk semasa fade-out, sebagai petunjuk status; playback yang dijeda atau dihentikan membekukan orientasi piring. Putaran berlaku automatik tanpa kawalan ON/OFF dan tidak dimatikan oleh tetapan `prefers-reduced-motion`. Klik-kanan pada baris trek menyediakan `Play Now`, `Remove from Queue` dan, untuk fail hilang, `Locate File`. Klik-kanan pada pad SFX menyediakan `Play Sound`, `Edit Name`, `Remove Sound` dan `Locate File` untuk fail hilang. Ruang kosong serta kawalan lain tidak membuka menu konteks. Fade audio ialah transisi fungsi, bukan animasi UI.

### 1.4 Tutorial Penggunaan Kali Pertama

* Paparkan popup pilihan tutorial tepat sekali sahaja pada penggunaan pertama aplikasi, di atas skrin utama, dengan pilihan `Start Tutorial` dan `Skip`.
* Jika pengguna memilih `Start Tutorial`, jalankan panduan langkah demi langkah yang menerangkan setiap fungsi utama dan meminta pengguna mencuba sendiri: tambah lagu ke setiap dek, pilih dan mainkan lagu, laras volum, pause/stop/restart, susun semula playlist dengan drag-and-drop, gunakan `Play Now` dan `Remove`, toggle Loop, tambah serta mainkan SFX, fahami ducking, dan tetapkan shortcut key.
* Tutorial bersifat interaktif: setiap langkah menyerlahkan kawalan berkaitan, memberi arahan dalam bahasa Inggeris, dan menunggu tindakan pengguna sebelum meneruskan. Sediakan `Back` dan `Next`; pengguna boleh mencuba tindakan dengan fail audio mereka sendiri.
* Selepas pengguna memilih `Start Tutorial`, tutorial mesti dilengkapkan hingga langkah terakhir. Tiada `Skip`, `Exit Tutorial`, atau jalan keluar melalui `Esc` selepas tutorial bermula. Jika aplikasi ditutup atau dimulakan semula sebelum selesai, tutorial bermula semula dari awal pada pelancaran berikutnya.
* Urutan tutorial: (1) tambah lagu ke Dek Kiri dan Kanan; (2) cuba Play, Pause/resume, Restart dan Stop; (3) laras volum kedua-dua dek; (4) susun playlist, cuba `Play Now`, dan buang lagu; (5) cuba Loop ON/OFF dan perhatikan giliran playlist; (6) tambah/mainkan SFX dan perhatikan ducking; (7) tetapkan dan cuba shortcut key.
* Langkah yang memerlukan fail audio mesti boleh dilangkau jika pengguna belum mempunyai fail. Pengguna boleh meneruskan ke fungsi lain dan membuka semula tutorial kemudian.
* Sebaik sahaja pengguna memilih `Start Tutorial` atau `Skip`, simpan pilihan itu. Jangan paparkan popup pilihan itu lagi pada pelancaran seterusnya. Pilihan yang disimpan tidak menghalang pengguna daripada membuka tutorial secara manual melalui `Help > Tutorial`.
* Tutorial boleh dibuka semula kemudian melalui `Help > Tutorial`.
* Semua kandungan tutorial dan dialog menggunakan bahasa Inggeris, selaras dengan keperluan bahasa UI.

**Kriteria penerimaan tutorial:** (1) popup hanya muncul pada pelancaran pertama sebelum pilihan dibuat; (2) `Skip` sebelum tutorial bermula membuka skrin utama dan pilihan itu diingati; (3) selepas `Start Tutorial`, tutorial perlu diselesaikan hingga akhir dan tidak boleh ditutup/dilangkau dengan butang atau `Esc`; (4) tutorial memerlukan percubaan pengguna untuk fungsi utama dan tidak hanya memaparkan teks; (5) langkah audio boleh dilangkau apabila tiada fail tersedia; (6) pengguna boleh undur dan maju; (7) tutorial boleh dibuka semula melalui Help.

### 1.5 Fail Audio Tidak Tersedia atau Tidak Sah

* Semasa memuatkan sesi, jika fail playlist tiada pada laluan tersimpan, kekalkan item dalam playlist dan tandakannya `Missing file`; jangan buang item atau hentikan dek lain.
* DJMesrc merujuk fail muzik dan SFX di lokasi asalnya dan tidak menyalin fail audio ke dalam library aplikasi. Nyatakan bahawa pengguna perlu mengekalkan fail pada lokasi itu; jika ia dipindah atau dipadam, gunakan pemulihan `Missing file` dan `Locate File`.
* Jika pengguna cuba memainkan fail yang hilang atau tidak disokong/rosak, jangan ubah keadaan playback dek lain. Paparkan mesej bahasa Inggeris yang menerangkan masalah dan tindakan seterusnya.
* Sediakan tindakan `Locate File` untuk memilih fail pengganti. Selepas berjaya, kemas kini laluan fail item playlist tersebut dan kekalkan kedudukan serta metadata lain yang boleh digunakan.
* Jika fail tidak dapat dinyahkod, tunjuk sebab yang dapat dikenal pasti (contohnya format tidak disokong atau fail rosak) dan kekalkan item supaya pengguna boleh membetulkan atau membuangnya.
* Kegagalan SFX hanya menjejaskan pad SFX yang berkenaan; playback dek muzik dan pad SFX lain diteruskan.

**Kriteria penerimaan pemulihan fail:** (1) fail hilang kekal kelihatan selepas aplikasi dibuka semula; (2) mesej ralat menyatakan item dan tindakan pemulihan; (3) `Locate File` memulihkan item tanpa mengubah susunan playlist; (4) ralat pada satu dek atau pad SFX tidak menghentikan audio lain.

Berbeza dengan perisian DJ tradisional yang terlalu rumit dengan ratusan tombol yang jarang digunakan, **DJMesrc** memfokuskan kepada **3 Bahagian Utama**:
1. **Dek Muzik Kiri (Deck A)** bersama senarai main (*playlist*) tersendiri.
2. **Dek Muzik Kanan (Deck B)** bersama senarai main (*playlist*) tersendiri yang terpisah sepenuhnya daripada dek kiri.
3. **Papan Kesan Bunyi (SFX Soundboard)** di bahagian bawah yang membolehkan pengguna menambah fail audio secara dinamik dan memetakan setiap butang dalam aplikasi kepada papan kekunci (*custom shortcut keys* seperti `Numpad 1`, `Numpad 2`, dsb.).

---

## 2. Senibina Teknikal & Stack Teknologi
*(Disediakan oleh: Ejen Arkitek Sistem Rust & Frontend Lead)*

### As-built: implementation in the monorepo

The current implementation uses `apps/ui` for React 19, TypeScript, Vite, Tailwind CSS and local shadcn/ui components; `apps/desktop` for the Tauri v2 shell and Rust backend; and `packages/domain` for shared domain types and helpers. The UI uses React hooks and `localStorage` for session persistence, not Next.js, Zustand or Tauri Store. The audio bridge is in `apps/ui/src/lib/audio.ts`; UI components are separated under `apps/ui/src/components`; session/audio state is in `apps/ui/src/hooks/useAudioDesk.ts`; and audio engine/IPC commands are in `apps/desktop/src/audio`.

The current operator screen follows a compact two-turntable console layout: a shortcut control above two independent deck panels, a narrow center mixer, and a soundboard below. The separate branding/status title bar and decorative deck identity/status rows are removed to free workspace height. Help lives in the soundboard toolbar; operation notices appear briefly only when needed, without a persistent ready message. The deck area and soundboard each receive half of the remaining workspace height. Promotional headline/footer copy is omitted. The app frame fills the available window; queues and the soundboard handle overflow within their own panels so the page itself does not scroll. The Windows app icon uses a matcha-green-and-black DJ monogram for the executable, window and taskbar, and the same ICO is configured for NSIS setup and uninstallers. Each deck has a layered lacquer-vinyl SVG with concentric grooves, rotating groove reflections, a colored center label and a spindle. The record rotates at 33⅓ RPM only while audio plays; pause and stop preserve the current angle. Vinyl rotation is automatic while a deck is active, including when Windows has reduced-motion enabled; no ON/OFF control is shown. Track and sound-effect context menus expose the actions relevant to each item; empty regions and other controls suppress browser menus.

The engine mixes both decks and SFX on a shared audio bus, applies a crossfader and master limiter, and measures deck signal levels. Short SFX that fit the memory limit are predecoded; large or unknown-duration effects stream from their source file. Missing files can be relinked from their original locations. The UI accepts MP3, WAV, FLAC, OGG, AAC and M4A; successful decoding depends on the actual file content.

**Evidence boundary:** TypeScript checking and Rust compilation are build checks, not runtime acceptance. Physical playback, SFX response, output-device loss behavior and installation on a clean Windows machine still need verification.

Untuk menghasilkan fail `.exe` Windows yang pantas, ringan, dan mempunyai antaramuka React/TypeScript yang cantik, **DJMesrc** menggunakan seni bina hibrid **Tauri v2**.

### 2.1. Komponen Stack
* **Pembungkus Aplikasi Desktop (Core Shell):** **Tauri v2** (Menghasilkan binari `.exe` asli menggunakan WebView2 Windows tanpa beban memori tinggi seperti Electron).
* **Frontend (UI & State):**
  * **Framework:** Next.js (dikonfigurasikan dengan `output: 'export'` untuk penjanaan statik penuh dalam Tauri).
  * **Bahasa:** TypeScript (Strict Mode).
  * **Styling:** Tailwind CSS (dikonfigurasikan khas untuk tema Neo-Brutalism).
  * **State Management:** Zustand (untuk menguruskan senarai lagu Kiri/Kanan, status audio, dan pemetaan *Shortcut Key*).
* **Backend & Enjin Audio (Rust):**
  * **Enjin Audio:** Crate `rodio` atau `kira` di dalam Rust (memberikan kawalan *multi-track mixing* dengan masa pendam rendah / *ultra-low latency*, menyokong mainan serentak Dek Kiri + Dek Kanan + berbilang bunyi SFX tanpa *stuttering*).
  * **Dekoder Audio:** `symphonia` (menyokong pelbagai format: `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`, `.m4a`).
  * **Penyimpanan Data Tempatan:** `tauri-plugin-store` / JSON tempatan (menyimpan susunan playlist, butang SFX, dan tetapan *shortcut key* secara automatik).

### 2.2. Aliran Komunikasi (IPC Bridge)
1. **Pengguna Tekan kekunci (contoh: `Numpad 1`) atau Klik Butang UI.**
2. **Next.js Event Listener** menangkap aksi tersebut dengan serta-merta dan menghantar arahan `invoke('play_sfx', { id: 'sfx_1' })` ke backend Rust.
3. **Rust Audio Thread** memainkan strim audio daripada memori (*pre-buffered RAM* untuk SFX supaya tiada *delay* bacaan cakera) dan menghantar status terkini kembali ke UI.

---

## 3. Sistem Reka Bentuk UI/UX: Neo-Brutalism & Manifesto "Anti-AI Slop"
*(Disediakan oleh: Ejen Reka Bentuk UI/UX)*

### Arah visual semasa

Paparan operasi mengikuti rujukan konsol DJ profesional: dua turntable dengan piring vinil beralur yang berputar semasa playback, queue pada setiap dek, meter signal sebenar, crossfader di tengah dan soundboard padat di bawah. Tiada tajuk promosi, tagline atau footer pemasaran. Gunakan latar putih cerah, teks gelap yang mudah dibaca, dan aksen pink untuk Deck A serta hijau matcha untuk Deck B. Warna status hanya digunakan pada keadaan berkaitan. Soundboard menggunakan kad tersendiri untuk setiap SFX; kawalan volum, warna, rename dan delete kekal di dalam kad. Bahagian dek dan soundboard masing-masing mendapat separuh ruang kerja menegak. Bingkai aplikasi dimaksimumkan; overflow queue dan soundboard kekal dalam panel masing-masing. Nama DJMesrc dipaparkan sebagai wordmark teks tanpa imej logo. Aplikasi kekal dalam tema cerah tanpa mod gelap.

Komponen kawalan diimplementasikan secara lokal mengikuti shadcn/ui dengan primitive Radix untuk button, slider, tooltip dan scroll area. Motion terhad kepada maklum balas keadaan: piring berputar semasa audio dimainkan atau fade-out, dan berhenti selepas playback dijeda atau dihentikan; penanda dek aktif berubah lembut; susunan queue bergerak 180 ms selepas drag tetikus sahaja. Gerakan queue dimatikan untuk `prefers-reduced-motion` dan tidak berjalan untuk arahan papan kekunci. Tiada pulse hiasan atau animasi berulang pada kawalan yang kerap digunakan.

### 3.1. Polisi Ketat "Anti-AI Slop"
Pembangunan UI **DJMesrc** **DILARANG KERAS** menggunakan elemen generik AI berikut:
* ❌ **Tiada** kecerunan ungu/biru neon (*purple/cyan glowing gradients*) dengan latar belakang kabur (*glassmorphism*).
* ❌ **Tiada** bucu bulat berlebihan (`rounded-3xl`) yang kelihatan seperti templat laman web SaaS generik.
* ❌ **Tiada** bayang-bayang lembut (*soft drop shadows*).
* ❌ **Tiada** graf palsu, gelombang audio hiasan yang tidak berfungsi, atau ikon generik yang mengelirukan.

### 3.2. Prinsip Konsol Audio yang Jelas
Reka bentuk diinspirasikan oleh perkakasan audio fizikal dengan keutamaan pada kebolehbacaan dan penggunaan pantas:
* **Sempadan Jelas:** Gunakan garis nipis berkontras lembut untuk memisahkan panel dan kawalan.
* **Maklum Balas Kawalan:** Butang, fader dan shortcut menunjukkan keadaan aktif, fokus papan kekunci dan disabled dengan jelas.
* **Kod Warna Berfungsi:**
  * **Latar Belakang Utama:** Putih cerah dengan permukaan neutral berona matcha yang sangat lembut.
  * **Deck A dan Deck B:** Pink dan hijau matcha mengenal pasti dek secara konsisten.
  * **Soundboard:** Pad mudah dicapai dengan saiz yang mengisi ruang soundboard tanpa memanjangkan kad secara berlebihan; warna pilihan menjadi penanda dan status aktif tidak mewarnakan keseluruhan kad.
* **Tipografi:** Gunakan Segoe UI untuk nama dan kawalan serta Consolas untuk masa, volum dan shortcut key agar nombor sejajar dan mudah dibaca.

### 3.3. Lakaran Susun Atur 3-Bahagian (Wireframe Layout)

```text
+-----------------------------------------------------------------------------------+
| [DJMesrc v1.0]            [MASTER VOL: =======||==]        [MOD EDIT KEYBIND: OFF]|
+-----------------------------------------+-----------------------------------------+
| DEK KIRI (DECK A)                       | DEK KANAN (DECK B)                      |
| --------------------------------------- | --------------------------------------- |
| Lagu: 01_Intro_Beat.mp3       [01:24/03:10] | Lagu: 02_Bass_Drop.wav    [00:45/02:50] |
| [==================|------------------] | [=========|---------------------------] |
|                                         |                                         |
| [▶ PLAY/PAUSE] [⏹ STOP] [⏮ MULA AWAL] | [▶ PLAY/PAUSE] [⏹ STOP] [⏮ MULA AWAL] |
| [Key: Q]       [Key: W]  [Key: E]       | [Key: U]       [Key: I]  [Key: O]       |
|                                         |                                         |
| [🔁 LOOP: ON ]   VOL: [========||===]80%| [🔁 LOOP: OFF]   VOL: [==========||=]90%|
| [Key: R]         [Key: A / Z]           | [Key: P]         [Key: K / M]           |
|                                         |                                         |
| --- PLAYLIST KIRI (BEBAS) ------------- | --- PLAYLIST KANAN (BEBAS) ------------ |
| [+ Tambah Fail Muzik Kiri]              | [+ Tambah Fail Muzik Kanan]             |
| 1. ▶ 01_Intro_Beat.mp3       [03:10][X] | 1.   Vocal_Sample.flac       [01:15][X] |
| 2.   Synth_Wave_Loop.wav     [04:02][X] | 2. ▶ 02_Bass_Drop.wav        [02:50][X] |
| 3.   Chill_Transition.mp3    [02:45][X] | 3.   Outro_Theme.mp3         [03:30][X] |
+-----------------------------------------+-----------------------------------------+
|                        CROSSFADER: [ KIRI <=====[||]=====> KANAN ]                |
+-----------------------------------------------------------------------------------+
| PAPAN KESAN BUNYI (SFX SOUNDBOARD)         [⏹ HENTI SEMUA SFX (Esc)] [+ ADD SFX] |
| --------------------------------------------------------------------------------- |
| +---------------+ +---------------+ +---------------+ +---------------+ +-------+ |
| | 🔊 AIRHORN    | | 🥁 DRUM ROLL  | | 💥 EXPLOSION  | | 👏 APPLAUSE   | |   +   | |
| |  [NUMPAD 1]   | |  [NUMPAD 2]   | |  [NUMPAD 3]   | |  [NUMPAD 4]   | | TAMBAH| |
| +---------------+ +---------------+ +---------------+ +---------------+ +-------+ |
+-----------------------------------------------------------------------------------+
```

---

## 4. Spesifikasi Fungsi Teras (Core Features)
*(Disediakan oleh: Ejen Pakar Produk Audio)*

### 4.1. Bahagian 1 & 2: Dek Muzik Berkembar (Kiri & Kanan)
Kedua-dua dek mempunyai fungsi yang simetri tetapi beroperasi di atas saluran (*channel*) dan keadaan (*state*) yang **100% terpisah**:

1. **Import Pelbagai Format Audio:**
   * Pengguna boleh menekan butang `+ Tambah Fail Muzik` atau *Drag & Drop* fail terus ke dalam kotak Playlist Kiri atau Playlist Kanan.
   * Menyokong pemilihan banyak fail serentak (*multi-file import*) dalam format `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`, dan `.m4a`.
   * Semasa multi-file import atau drag-and-drop, import semua fail yang sah dan boleh dibaca; kegagalan satu fail tidak membatalkan fail lain yang berjaya.
   * Jika fail tidak disokong atau gagal dibaca, abaikan fail tersebut dan tunjuk laporan bahasa Inggeris yang menyenaraikan nama fail serta sebab kegagalan, bersama bilangan fail berjaya dan gagal.
   * Cegah fail pendua dalam playlist dek yang sama berdasarkan laluan fail kanonik. Abaikan pendua dan tunjuk pemberitahuan ringkas; playlist dek lain dinilai berasingan dan boleh mengandungi fail yang sama.
   * Jika playlist kosong, tunjuk empty state bahasa Inggeris `No track selected. Add music to this deck to get started.` dengan butang `Add Music`.
   * Jika `Play` ditekan ketika tiada trek dipilih atau playlist kosong, jangan mulakan audio atau tunjuk dialog ralat; kekalkan dek berhenti dan tunjuk empty state tersebut.
2. **Kawalan Main Balik (Playback Controls):**
   * **Play / Pause:** Memulakan atau menjeda lagu yang sedang dipilih pada dek tersebut.
   * **Stop:** Menghentikan lagu sepenuhnya dan menetapkan semula posisi ke `00:00`.
   * **Pause:** Menjeda lagu dan mengekalkannya di kedudukan pertama playlist. Apabila Play ditekan semula, lagu bersambung dari posisi jeda.
   * **Stop dan barisan:** Selepas Stop, lagu kekal di kedudukan pertama playlist dan boleh dimainkan semula dari `00:00`; ia tidak diturunkan ke bawah. Giliran playlist hanya bergerak automatik apabila lagu tamat dengan Loop OFF.
   * **Mula Dari Awal (Restart / Instant Cue):** Apabila ditekan semasa lagu sedang berjalan, lagu akan serta-merta melompat kembali ke saat `00:00` dan terus bermain tanpa henti (sangat berguna untuk gaya *retrigger* DJ).
   * **Replay / Loop (Toggle):** Butang suis hidup/mati. Jika **ON** (berwarna terang), lagu pada dek tersebut akan diulang secara automatik tanpa henti sebaik sahaja ia tamat.
   * **Bar Kemajuan Interaktif (Seek Bar):** Memaparkan masa semasa dan jumlah masa lagu. Pengguna boleh klik pada mana-mana bahagian bar untuk melompat ke minit/saat tersebut.
3. **Kawalan Volum Terpisah:**
   * Setiap dek mempunyai pelaras volum (*Volume Fader*) tersendiri dari `0%` hingga `100%` serta butang *Mute* pantas.
   * Mengubah volum Dek Kiri tidak akan menjejaskan volum Dek Kanan.
4. **Senarai Main (Playlist) Terpisah:**
   * Senarai lagu di Dek Kiri hanya terikat pada Dek Kiri. Senarai lagu di Dek Kanan hanya terikat pada Dek Kanan.
   * Playlist ialah barisan berputar bagi dek itu: lagu di kedudukan pertama ialah lagu semasa dan dibezakan dengan jelas daripada lagu menunggu.
   * Jika `Loop` OFF, apabila lagu semasa tamat ia turun ke bahagian paling bawah playlist, dan lagu yang kini di kedudukan pertama menjadi lagu semasa seterusnya serta dimainkan secara automatik. Playlist dikemas kini mengikut giliran ini.
   * Jika `Loop` ON, lagu semasa diulang secara berterusan. Ia kekal di kedudukan pertama dan tiada lagu lain mengambil alih sehingga pengguna mematikan Loop atau memilih tindakan lain.
   * Pengguna boleh drag-and-drop lagu yang masih menunggu dengan menyeret terus baris lagu menggunakan pointer; ikon pemegang dan butang anak panah tidak diperlukan. Contoh: alihkan lagu nombor 3 ke kedudukan 2 supaya ia dimainkan selepas lagu semasa. Baris playlist mempunyai sasaran jatuh yang jelas dan ruang tekan yang sesuai.
   * Menekan baris lagu atau tindakan `Play Now` pada lagu menunggu memainkan lagu pilihan serta-merta pada dek itu. Lagu pilihan menjadi lagu semasa di kedudukan pertama; lagu semasa yang lama bergerak ke kedudukan kedua dan lagu lain mengekalkan susunan relatifnya. Dek sebelah tidak terjejas.
   * Setiap baris lagu termasuk lagu semasa mempunyai tindakan `Remove` yang jelas untuk membuang lagu itu daripada playlist dek berkenaan. Selepas pengesahan, lagu semasa yang sedang dimainkan fade out selama 2 saat; lagu seterusnya dimuatkan dan dimainkan. Jika dek berhenti atau pause, lagu seterusnya dimuatkan dalam keadaan berhenti. Jika tiada lagu seterusnya, dek dikosongkan. Semua tindakan hanya mengubah dek berkenaan.
   * Susun semula dan tindakan `Play Now` hanya mengubah playlist dek berkaitan, bukan playlist dek satu lagi.

   **Kriteria penerimaan playlist:** (1) menyeret baris lagu terus mengubah susunan lagu menunggu; (2) dengan Loop OFF, lagu tamat turun ke bawah dan trek teratas seterusnya dimainkan automatik; (3) dengan Loop ON, lagu semasa berulang tanpa mengubah susunan playlist; (4) menekan baris atau butang Play memainkan lagu itu serta-merta dan mengalihkannya ke kedudukan pertama; (5) lagu lama kekal di playlist pada kedudukan kedua; (6) Pause mengekalkan posisi dan kedudukan pertama; (7) Stop menetapkan posisi ke `00:00` dan mengekalkan kedudukan pertama; (8) lagu semasa boleh dibuang selepas pengesahan, fade out jika sedang dimainkan dan pilih lagu seterusnya tanpa mengubah dek lain; (9) operasi playlist tidak mengubah dek lain.

### 4.2. Bahagian 3: Papan Kesan Bunyi Dinamik (Bottom SFX Soundboard)
Terletak di bahagian bawah aplikasi untuk akses pantas:

1. **Penambahan SFX Secara Dinamik (`+ Add Sound`):**
   * Apabila pengguna klik `+ Add SFX`, tetingkap pemilihan fail dibuka.
   * Setiap fail audio yang dipilih akan menjana sebuah **Butang Pad SFX baharu** secara automatik di dalam grid bawah.
2. **Kelakuan Mainan SFX (Instant Retrigger / Polyphonic):**
   * Kerana kesan bunyi biasanya pendek, menekan butang SFX (atau *shortcut key* berkaitan) akan memainkan bunyi tersebut serta-merta di atas muzik Dek Kiri/Kanan yang sedang berjalan.
   * Beberapa SFX berbeza boleh berbunyi serentak (polyphonic); setiap SFX yang ditekan bermula serta-merta tanpa menunggu bunyi lain tamat.
   * Jika butang SFX yang sama ditekan berkali-kali dengan pantas (contoh: tekan `Numpad 1` tiga kali berturut-turut), setiap tekanan menghasilkan mainan/retrigger baharu yang bertindih. Jangan hentikan atau gantikan bunyi SFX terdahulu secara automatik.
   * Ducking muzik kekal aktif sehingga semua instance SFX tamat. `Stop All SFX` menghentikan semua instance aktif dan muzik pulih mengikut nilai fader semasa.
3. **Pengurusan Butang SFX:**
   * Setiap butang SFX memaparkan nama yang boleh ditukar, indikator bar kemajuan mini, pelaras volum individu, pilihan warna, butang padam, dan lencana **Shortcut Key**. Edit nama membuka popover pada kad dan tidak menambah baris atau tinggi kad.
   * **Butang Kecemasan (`Stop All SFX`):** Satu butang khas untuk mematikan semua kesan bunyi yang sedang berbunyi secara serentak jika tersalah tekan.

### 4.3. Sistem Pemetaan Kekunci Menyeluruh (Universal Shortcut Key Mapper)
Ini adalah ciri utama **DJMesrc** di mana **semua elemen yang boleh diklik boleh ditetapkan kepada papan kekunci**:

1. **Mod Tetapan Kekunci (`Keybind Learn Mode`):**
   * Terdapat suis utama `KEYBIND MODE: ON/OFF` yang jelas di bar atas. Apabila ON, pengguna memilih butang sasaran dan sistem meminta mereka menekan kekunci yang dikehendaki.
   * Tunjukkan keadaan belajar pada sasaran yang dipilih dan mesej `Press a key...`; jangan buat semua kawalan berkelip berterusan.
   * Sediakan `Cancel` untuk keluar daripada proses belajar tanpa mengubah binding sedia ada, dan `Clear Binding` untuk membuang binding sasaran.
   * Jika pengguna menekan `Esc` semasa proses belajar, kosongkan/unbind key bagi kawalan sasaran dan tamatkan proses belajar. Di luar proses belajar, `Esc` tidak mengosongkan keybind atau mengubah kawalan; ia tidak boleh dipetakan sebagai key tindakan biasa.
   * Keybind disimpan bagi setiap kawalan dan dipulihkan melalui auto-save. Paparkan keycap pada kawalan yang terikat.
2. **Sokongan Kekunci Penuh:**
   * Menyokong pemetaan berbeza antara nombor biasa (`Digit1`) dan nombor Numpad (`Numpad1` hingga `Numpad9`, `Numpad0`, `NumpadAdd`, `NumpadEnter`), kekunci fungsi (`F1` - `F12`), dan abjad (`A` - `Z`).
3. **Pencegahan Konflik Pintar:**
   * Satu kekunci hanya boleh terikat pada satu tindakan di seluruh aplikasi. Duplicate binding dilarang dan tidak boleh dipaksa melalui aliran UI.
   * Jika pengguna menekan key yang sudah digunakan semasa proses belajar, tolak binding baharu, kekalkan binding asal, dan paparkan mesej bahasa Inggeris yang menyatakan kawalan pemilik key tersebut. Pengguna perlu memilih key lain.
4. **Keselamatan input dan keadaan aktif:**
   * Kekunci tindakan tidak mencetuskan playback semasa pengguna menaip dalam medan teks, menamakan semula SFX, atau mengedit input.
   * Keybind tindakan hanya aktif apabila tetingkap DJMesrc fokus. Apabila tetingkap tidak fokus, kekunci tidak mengawal aplikasi; sokongan global hotkey di luar tetingkap bukan sebahagian daripada skop semasa.
   * Kekunci yang ditekan semasa mod belajar tidak melaksanakan tindakan terikat sedia ada; ia hanya direkod sebagai calon binding.
5. **Paparan Lencana Kekunci (Keycap Badge):**
   * Setiap butang pada skrin sentiasa memaparkan lencana kecil berbentuk kekunci fizikal (contoh: `[NUM 1]`, `[SPACE]`, `[Q]`) supaya DJ tidak lupa kekunci mana yang perlu ditekan.

### 4.4. Ciri Tambahan Penting DJ (Minimum & Tidak Mengganggu)
Untuk memastikan pengalaman DJ lebih lengkap tanpa merumitkan antaramuka:
1. **Crossfader (Kawalan Tambahan):**
   * Kawalan fader volum individu pada setiap dek ialah kawalan utama dan kekal sebagai tahap volum pilihan pengguna.
   * Crossfader ialah kawalan tambahan untuk mengubah imbangan output relatif antara Dek Kiri dan Dek Kanan. Posisi tengah ialah neutral secara lalai dan tidak mengurangkan output salah satu dek berbanding fader individunya.
   * Menggerakkan crossfader ke kiri/kanan mengurangkan output relatif dek bertentangan dan mengutamakan dek pada arah yang dipilih. Ia tidak menulis semula nilai fader individu.
   * Sediakan `Reset Center` untuk mengembalikan crossfader ke posisi neutral tanpa mengubah fader individu. Pergerakan crossfader hendaklah lancar dan tidak menghentikan atau memulakan playback.
2. **Simpanan Sesi Automatik (Auto-Save Persistence):**
   * Pengguna tidak perlu menambah semula lagu atau menetapkan semula tetapan setiap kali membuka aplikasi. Simpan secara automatik playlist dan susunan setiap dek, laluan fail, tetapan volum dan mute, keadaan Loop, senarai/nama/warna/volum SFX, pemetaan shortcut key, serta rekod bahawa popup tutorial kali pertama telah dijawab (dan pilihan `Start Tutorial` atau `Skip`). Popup pilihan tutorial hanya muncul sekali; tutorial boleh dibuka semula manual melalui Help.
   * Apabila `DJMesrc.exe` dibuka semula, pulihkan sesi dan tetapan tersebut tetapi jangan sambung playback secara automatik. Kedua-dua dek dan semua SFX bermula dalam keadaan berhenti untuk mengelakkan audio berbunyi tanpa tindakan pengguna.
   * Kegagalan memulihkan laluan fail ikut peraturan `Missing file` pada Seksyen 1.5; jangan buang playlist atau tetapan yang lain.
   * **Kriteria penerimaan:** (1) perubahan sesi tersimpan tanpa tindakan Save manual; (2) selepas tutup/buka semula, playlist, susunan, volum/mute, Loop, SFX dan keybind dipulihkan; (3) tiada dek atau SFX mula bermain sendiri; (4) item fail hilang kekal kelihatan dan boleh dipautkan semula.
3. **Normalisasi & Perlindungan Audio Pecah (Hard Limiter):**
   * Di dalam enjin Rust, satu *soft-clipper / limiter* automatik dipasang pada output utama supaya apabila Dek Kiri + Dek Kanan + 3 bunyi SFX dimainkan serentak pada volum 100%, bunyi speaker tidak pecah (*distortion*).

---

## 5. Struktur Data & Kontrak API (TypeScript <-> Rust)
*(Disediakan oleh: Ejen Jurutera Perisian)*

Berikut adalah skema data utama yang akan dikongsi antara Next.js dan Rust:

```typescript
// types/djmesrc.ts

export type DeckId = 'LEFT' | 'RIGHT';

export interface TrackItem {
  id: string;
  title: string;
  filePath: string;      // Laluan fail tempatan di Windows (C:\Music\...)
  durationMs: number;    // Jumlah masa lagu dalam milisaat
  format: string;        // mp3 | wav | flac | ogg
}

export interface DeckState {
  deckId: DeckId;
  currentTrackId: string | null;
  isPlaying: boolean;
  isLooping: boolean;    // Fungsi Replay / Loop
  volume: number;        // 0.0 hingga 1.0
  isMuted: boolean;
  positionMs: number;    // Posisi semasa lagu
  playlist: TrackItem[]; // Playlist berasingan untuk setiap dek
}

export interface SfxButton {
  id: string;
  name: string;
  filePath: string;
  volume: number;        // 0.0 hingga 1.0
  colorHex: string;      // Warna kad Neo-Brutalist (#FFE600, #00FF66, dll.)
  isPlaying: boolean;
}

export interface KeybindMap {
  // Key ialah kod kekunci papan kekunci (contoh: "Numpad1", "KeyQ")
  // Value ialah ID tindakan (contoh: "SFX_ play_id123", "DECK_LEFT_PLAY", "DECK_RIGHT_RESTART")
  [keyCode: string]: string;
}
```

### Senarai Arahan Tauri (Rust Commands)
* `cmd_load_track(deck_id: String, file_path: String) -> Result<TrackMetadata, String>`
* `cmd_deck_control(deck_id: String, action: "PLAY" | "PAUSE" | "STOP" | "RESTART") -> Result<(), String>`
* `cmd_set_deck_loop(deck_id: String, is_looping: bool) -> Result<(), String>`
* `cmd_set_deck_volume(deck_id: String, volume: f32) -> Result<(), String>`
* `cmd_seek_deck(deck_id: String, position_ms: u64) -> Result<(), String>`
* `cmd_register_sfx(id: String, file_path: String) -> Result<(), String>` *(Memuatkan SFX ke dalam RAM untuk masa pendam 0ms)*
* `cmd_trigger_sfx(id: String) -> Result<(), String>`
* `cmd_stop_all_sfx() -> Result<(), String>`

---

## 6. Struktur Direktori Projek

```text
djmesrc/
├── src/                          # Kod Sumber Frontend (Next.js + React + TS)
│   ├── app/
│   │   ├── layout.tsx            # Konfigurasi Font Space Grotesk & JetBrains Mono
│   │   ├── page.tsx              # Paparan Utama 3-Bahagian (Kiri, Kanan, Bawah)
│   │   └── globals.css           # Kelas Utiliti Neo-Brutalist Tailwind
│   ├── components/
│   │   ├── deck/
│   │   │   ├── DeckContainer.tsx # Komponen Dek (Digunakan untuk Kiri & Kanan)
│   │   │   ├── TransportBar.tsx  # Butang Play, Stop, Mula Awal, Loop
│   │   │   ├── VolumeFader.tsx   # Pelaras Volum Neo-Brutalist
│   │   │   └── PlaylistBox.tsx   # Senarai Lagu Berasingan + Import Fail
│   │   ├── soundboard/
│   │   │   ├── SfxGrid.tsx       # Bahagian Bawah untuk Kesan Bunyi
│   │   │   ├── SfxPadButton.tsx  # Butang SFX Dinamik + Lencana Numpad
│   │   │   └── AddSfxModal.tsx   # Dialog Tambah Bunyi Baharu
│   │   └── keybind/
│   │       ├── KeybindManager.tsx# Pendengar Papan Kekunci Global (Numpad/Key)
│   │       └── KeycapBadge.tsx   # Visual Tag Kekunci (contoh: [NUM 1])
│   ├── store/
│   │   └── useDjStore.ts         # Zustand Store + Auto-save ke Tauri Store
│   └── lib/
│       └── tauriBridge.ts        # Pembalut (Wrapper) arahan invoke() ke Rust
├── src-tauri/                    # Kod Sumber Backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Titik Mula Aplikasi Windows
│   │   ├── audio_engine.rs       # Enjin Audio Rodio/Kira (2 Dek + Multi-SFX)
│   │   ├── commands.rs           # Pengendali Arahan IPC dari Next.js
│   │   └── state.rs              # Pengurusan Memori Audio Thread-safe
│   ├── Cargo.toml                # Kebergantungan Rust (tauri, rodio, symphonia)
│   └── tauri.conf.json           # Konfigurasi Pembinaan Installer .exe Windows
├── package.json
├── next.config.mjs               # output: 'export' untuk integrasi Tauri
└── tailwind.config.ts
```

---

## 7. Pelan Pembangunan Berfasa (Implementation Roadmap)

### Status fasa semasa (MVP built; runtime acceptance not verified)

| Fasa | Keadaan semasa | Baki sebelum penerimaan |
| :--- | :--- | :--- |
| 1. Asas aplikasi dan UI | Monorepo Tauri/React dibina dengan komponen dan domain dipisahkan. | Semakan visual dan penggunaan pada Windows sebenar. |
| 2. Dek dan enjin audio | Dua dek, kawalan playback, playlist, seek, loop, fader, crossfader, meter dan limiter telah dilaksanakan. | Sahkan gabungan, fade Pause/Stop, seek, loop dan output dengan peranti audio sebenar. |
| 3. SFX dan shortcut | Pad dinamik, retrigger bertindih, ducking, Stop All dan pengikatan kekunci telah dilaksanakan. | Sahkan tindak balas SFX dan semua input yang disokong pada aplikasi desktop. |
| 4. Sesi dan edaran | Pemulihan sesi, tutorial, pemulihan fail dan konfigurasi Tauri tersedia. | Bina installer dan sahkan pemasangan/pelancaran pada mesin Windows bersih. |

Roadmap empat minggu di bawah dikekalkan sebagai cadangan asal dan bukan senarai kerja yang semuanya masih belum bermula.

### Fasa 1: Penyediaan Asas & UI Neo-Brutalist (Minggu 1)
* Inisialisasi projek **Next.js + TypeScript + Tailwind CSS** bersama **Tauri v2**.
* Membina susun atur 3-bahagian (Dek Kiri, Dek Kanan, Papan SFX Bawah) dengan gaya **Neo-Brutalism** (sempadan hitam tebal, bayang keras, tiada elemen AI generik).
* Menyediakan *state* Zustand untuk menguruskan playlist berasingan Kiri dan Kanan.

### Fasa 2: Enjin Audio Rust & Kawalan Dek (Minggu 2)
* Membina modul `audio_engine.rs` menggunakan `rodio` untuk menyokong dua saluran muzik bebas (Kiri & Kanan).
* Menghubungkan butang **Play**, **Stop**, **Mula Dari Awal (Restart)**, **Loop (Replay)**, **Seek Bar**, dan **Volum** daripada UI React ke backend Rust.
* Menguji import pelbagai jenis fail audio (`.mp3`, `.wav`, `.flac`, `.ogg`).

### Fasa 3: Papan SFX Dinamik & Sistem Shortcut Key (Minggu 3)
* Membina fungsi `+ Add Sound` di bahagian bawah yang memuatkan audio pendek terus ke dalam memori RAM untuk cetusan segera (*zero-latency*).
* Membina sistem **Universal Keybind Mapper** supaya pengguna boleh menetapkan `Numpad 1`, `Numpad 2`, atau sebarang kekunci kepada mana-mana butang SFX dan butang kawalan dek.

### Fasa 4: Kemasan Akhir & Pembungkusan `.exe` (Minggu 4)
* Mengaktifkan simpanan sesi automatik (*auto-save*) supaya playlist, SFX, dan *keybind* tidak hilang selepas aplikasi ditutup.
* Menjalankan `cargo tauri build` untuk menghasilkan pemasang `.exe` / `.msi` asli untuk Windows.

---

## 8. Kriteria Penerimaan (Definition of Done)
1. Aplikasi boleh dibuka sebagai fail `.exe` pada Windows tanpa memerlukan pelayar web.
2. Lagu di Dek Kiri dan Dek Kanan boleh dimainkan secara serentak atau berasingan dengan senarai main (*playlist*) yang tidak bercampur.
3. Kedua-dua dek mempunyai kawalan **Play/Pause, Stop, Mula Dari Awal, Loop (Replay), dan Volum** yang berfungsi tanpa sela masa (*lag*).
4. Pengguna boleh menambah fail kesan bunyi baharu di bahagian bawah, dan butang baharu akan terpapar serta-merta.
5. Semua butang yang boleh diklik dalam aplikasi boleh ditetapkan dengan *shortcut key* (termasuk kekunci `Numpad`), dan menekan kekunci tersebut memberikan tindak balas audio serta animasi tekan butang secara langsung.

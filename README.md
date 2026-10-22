# order-of-service

A modern, professional church order-of-service planning application with real-time on-screen paper preview, direct inline editing, liturgy blueprint management, and vector-accurate print/PDF publishing.

---

## ✨ Features

- **Classic Liturgical Modern Aesthetics:**
  - Pristine white and soft slate design with dignified deep navy liturgical accents (`#1E3A8A`).
  - Zero neon or loud gradients; crafted specifically for dignified church services and worship assemblies.

- **Interactive Live Paper Preview:**
  - **Click-to-Edit Directly on Paper:** Click on church name, service theme, date, liturgy item titles, ministers, or scripture notes directly inside the live A4 preview sheet.
  - **Instant Two-Way Synchronization:** Edits typed on the paper document instantly sync to the left-hand form inputs and automatically persist to the database.

- **Liturgy Blueprints & Per-Sunday Customization:**
  - Build and customize reusable templates (e.g., Sunday Worship, Thanksgiving, Communion, Youth Celebration).
  - Add custom items on-the-fly for any specific Sunday without altering global templates.
  - Reorder items via drag-and-drop.

- **High-Precision Vector PDF Export & Isolated Print:**
  - Built-in jsPDF engine formatted for standard A4 programs with automated line wrapping (`splitTextToSize`) to prevent text overflow.
  - Dedicated `@media print` rules ensure clean, isolated printing directly from your browser.

- **Unique Mobile Experience:**
  - Touch-friendly layout with responsive paper sizing that fits mobile screens without awkward horizontal panning.
  - Signature elevated center action button (`+ Plan`) in the bottom navigation for instant access to planning.
  - Mobile top bar with quick actions and responsive slide-out drawer.

- **Offline-First & Local Persistence:**
  - Powered by Dexie.js (IndexedDB) with complete offline support.
  - Full JSON backup and restore capabilities under Account & Data.

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (or Node.js 18+)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/taiwoade-hub/order-of-service.git
   cd order-of-service
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Generate the database client:
   ```bash
   bun run db:generate
   ```

4. Start the development server (configured on port **3008**):
   ```bash
   bun run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3008
   ```

---

## 🛠️ Tech Stack
- **Framework:** Next.js (App Router)
- **Runtime:** Bun
- **Database / Storage:** SQLite (Prisma) & Dexie.js (IndexedDB for offline client-side storage)
- **Styling:** Vanilla CSS design tokens & Tailwind CSS
- **Icons & Libraries:** Lucide Icons, jsPDF, Flatpickr, SortableJS, SweetAlert2

---

## 📄 License
MIT License

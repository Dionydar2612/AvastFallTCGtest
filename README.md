<div align="center">

# AvastFall TCG

### A Digital Trading Card Game Platform

แพลตฟอร์มเกมการ์ดที่พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การเล่น การจัดการการ์ด และการสร้างเด็คไว้ในระบบเดียว

[Features](#-key-features) · [Tech Stack](#-technology-stack) · [Getting Started](#-getting-started) · [Project Structure](#-project-structure)

</div>

---

## About the Project

**AvastFall TCG** เป็นโปรเจกต์พัฒนาแพลตฟอร์มสำหรับเกมการ์ดสะสม (Trading Card Game: TCG) ที่รวมระบบทดลองเล่น เกมออนไลน์กับเพื่อน รายการการ์ด เครื่องมือสร้างเด็ค และ API สำหรับจัดการข้อมูลการ์ดไว้ในแอปพลิเคชันเดียว

โปรเจกต์นี้มุ่งเน้นการออกแบบระบบให้แยกส่วนชัดเจน ดูแลรักษาและต่อยอดได้ง่าย พร้อมมีเครื่องมือสำหรับผู้ดูแลในการเพิ่มและอัปเดตข้อมูลการ์ดโดยไม่ต้องแก้ไขข้อมูลในหลายจุด

### Project Highlights

- **Unified platform** — รวมหน้าเล่นเกม Card List, Deckbuilder, Card API และ Admin Dashboard ไว้ในเซิร์ฟเวอร์เดียว
- **Interactive playtesting** — ทดลองเล่นกับบอทหรือเปิดห้องเล่นกับผู้เล่นอื่นผ่านระบบออนไลน์
- **Data-driven card system** — จัดเก็บข้อมูลการ์ดและเด็คในรูปแบบ JSON พร้อมให้เกมและเครื่องมืออื่นเรียกใช้งานผ่าน API
- **Administration tools** — นำเข้าการ์ดจาก Excel/CSV อัปโหลดภาพ สำรองข้อมูล และกู้คืนข้อมูลได้
- **Deckbuilding workflow** — สร้างเด็ค ตรวจสอบรายการการ์ด และแชร์เด็คผ่านข้อความหรือลิงก์
- **Maintainable architecture** — แยกส่วน engine, card effects, API, data store และ UI เพื่อให้พัฒนาและแก้ไขแต่ละส่วนได้สะดวก

## ✨ Key Features

| Module | Description |
|---|---|
| **Playtest** | ทดลองเล่นกับบอท และสร้างห้องเพื่อทดสอบเกมกับเพื่อน |
| **Card List** | เรียกดูรายการการ์ดและข้อมูลการ์ดจากระบบกลาง |
| **Deckbuilder** | สร้าง จัดการ ส่งออก และแชร์เด็ค |
| **Card API** | API สำหรับเข้าถึงข้อมูลการ์ด เด็ค และธาตุ พร้อมหน้าเอกสาร API |
| **Admin Dashboard** | จัดการข้อมูลการ์ด นำเข้าไฟล์ อัปโหลดรูป และสำรอง/กู้คืนข้อมูล |
| **Pack Opening** | จำลองการเปิดซองและเก็บคอลเลกชันไว้ในเบราว์เซอร์ |
| **Update Notes** | เผยแพร่บันทึกการอัปเดตให้ผู้เล่นเห็นจากหน้าเกม |

## 🧰 Technology Stack

- **Runtime:** Node.js 18+
- **Backend:** Express.js
- **Frontend:** HTML, CSS, JavaScript
- **Data:** JSON files and browser local storage
- **Import/Export:** Excel (`.xlsx`) and CSV
- **Deployment:** Docker-ready configuration and hosting configuration files

### Architecture Overview

```text
Browser
  ├── Playtest UI
  │     ├── Game Engine
  │     ├── Bot
  │     └── Card Effects
  ├── Card List / Deckbuilder
  └── Admin Dashboard
          │
          ▼
     Express Server
          ├── Card API
          ├── Playtest / Room API
          ├── Card & Deck Store
          ├── Import / Export
          └── Backup / Restore
                  │
                  ▼
           Persistent Data
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
git clone <your-repository-url>
cd AvastFallTCG
npm install
```

### Run the Application

กำหนดรหัสสำหรับเข้า Admin Dashboard และเริ่มเซิร์ฟเวอร์

**Linux / macOS**
```bash
ADMIN_PASSWORD="your-secure-password" ADMIN_KEY="your-feedback-key" npm start
```

**Windows PowerShell**
```powershell
$env:ADMIN_PASSWORD="your-secure-password"
$env:ADMIN_KEY="your-feedback-key"
npm start
```

จากนั้นเปิดใช้งานผ่านเบราว์เซอร์:

| Path | Purpose |
|---|---|
| `/` | Playtest |
| `/cards/` | Card List และ Deckbuilder |
| `/admin` | Admin Dashboard |
| `/api/docs` | API Documentation |
| `/api/health` | Health Check |

ค่าเริ่มต้นของเซิร์ฟเวอร์คือ `http://localhost:3000` หากไม่ได้กำหนด `PORT` เป็นค่าอื่น

## ⚙️ Configuration

ตั้งค่าผ่าน Environment Variables โดยไม่ต้องฝังค่าลับไว้ใน source code

| Variable | Purpose |
|---|---|
| `PORT` | พอร์ตของเซิร์ฟเวอร์ |
| `ADMIN_PASSWORD` | รหัสผ่านสำหรับ Admin Dashboard; หากไม่กำหนด ระบบจะปิดการเข้าใช้งานส่วนนี้ |
| `ADMIN_SECRET` | คีย์สำหรับเซ็น session ของผู้ดูแล |
| `ADMIN_KEY` | คีย์สำหรับเข้าถึงหน้าข้อเสนอแนะที่จำกัดสิทธิ์ |
| `DATA_DIR` | ตำแหน่งจัดเก็บข้อมูลที่ต้องคงอยู่หลังรีสตาร์ตหรือ deploy |
| `RESEND_API_KEY` | API key สำหรับส่งอีเมลแจ้งเตือนผ่าน Resend |
| `NOTIFY_EMAIL` | อีเมลปลายทางสำหรับการแจ้งเตือน |
| `MAIL_FROM` | อีเมลผู้ส่งสำหรับการแจ้งเตือน |

> **Deployment note:** หากแพลตฟอร์มที่ใช้ deploy มี filesystem แบบชั่วคราว ควรกำหนด `DATA_DIR` ให้ชี้ไปยัง persistent disk หรือ volume เพื่อป้องกันข้อมูลที่แก้ไขผ่าน Admin Dashboard สูญหายเมื่อรีสตาร์ตหรือ deploy ใหม่

**Security note:** ใช้รหัสผ่านและ secret ที่คาดเดายาก และอย่า commit ค่า secret จริงลง repository

## 🗂️ Project Structure

```text
.
├── admin/              # Admin Dashboard
├── data/               # Initial card, deck, and element data
├── lib/                # API logic, storage, import/export, playtest services
├── public/              # Card List, Deckbuilder, docs, and card images
├── web/                 # Playtest application
│   ├── js/engine/        # Core game engine
│   ├── js/effects/       # Card effect implementations
│   ├── js/ui/            # User interface modules
│   └── css/              # Application styles
├── Dockerfile
├── MANUAL.md             # Detailed project manual
├── package.json
└── server.js             # Express application entry point
```

## 🃏 Card Data & Game Logic

ระบบแยก **ข้อมูลการ์ด** ออกจาก **การทำงานของเอฟเฟกต์ในเกม** โดยข้อมูลการ์ดเริ่มต้นอยู่ใน `data/` ส่วนการทำงานของเอฟเฟกต์อยู่ใน `web/js/effects/`

แนวทางนี้ช่วยให้สามารถปรับข้อมูลการ์ดผ่าน Admin Dashboard และพัฒนาพฤติกรรมของการ์ดในเกมแยกจากกันได้ อ่านขั้นตอนและรายละเอียดเพิ่มเติมได้จาก [MANUAL.md](MANUAL.md)

## 📚 Documentation

- [Project Manual](MANUAL.md) — คู่มือการใช้งานและการจัดการข้อมูล
- `/api/docs` — เอกสาร API เมื่อเซิร์ฟเวอร์กำลังทำงาน

## 🛣️ Future Development

แนวทางที่สามารถต่อยอดได้ ได้แก่ การเพิ่มระบบทดสอบกติกาอัตโนมัติ การเพิ่ม observability สำหรับการใช้งานจริง และการปรับปรุงระบบจัดเก็บข้อมูลให้เหมาะกับการขยายตัวของจำนวนผู้เล่นและข้อมูลการ์ด

## 👤 Maintainer

พัฒนาและดูแลโดย **AvastFall TCG Project**.

---

<p align="center">
  <sub>Built to support card game development, playtesting, and deck construction in one place.</sub>
</p>

# AvastFall TCG (เว็บรวม)

เซิร์ฟเวอร์ตัวเดียวที่รวม 2 โปรเจกต์เดิม: **AvastFallTCGsim** (เกมทดลองเล่น) + **CARDLIST** (Card List / Deckbuilder / card-api / หลังบ้าน)

| ที่อยู่ | คืออะไร | โค้ดอยู่ที่ |
|---|---|---|
| `/` | เกมทดลองเล่น (เล่นกับบอท / ออนไลน์กับเพื่อน) | `web/` |
| `/cards/` | Card List + Deckbuilder | `public/` |
| `/api/...` | card-api สาธารณะ (`/api/docs` = เอกสาร) | `server.js`, `lib/` |
| `/admin` | หลังบ้าน นำเข้า Excel / รูป / สำรอง-กู้คืน | `admin/` |
| `/recommece?key=...` | อ่านข้อเสนอแนะจากผู้เล่น (`/recommend` ใช้ได้เหมือนกัน) | `lib/playtest.js` |
| `/api/feedback`, `/api/room/*` | รับข้อเสนอแนะ / ห้องออนไลน์ (SSE) | `lib/playtest.js` |
| `/api/updates` | Update Note ที่แอดมินเขียนใน `/admin` (แท็บ 📣 Update Note) เกมดึงไปแสดงให้ผู้เล่นทุกคน เก็บใน `data/updates.json` บนดิสก์ถาวร | `lib/updates.js` |

**แถบเมนูเดียว:** หน้าแรกมีแถบบนสุดเดียว Playtest / Card List / Deckbuilder (`web/js/site.js`, `web/css/site.css`) Card List กับ Deckbuilder โหลดใน iframe `/cards/?embed=1` ตอนกดครั้งแรก (ตัดเมนูของตัวเองทิ้งเมื่อฝังอยู่) สลับแล้วเกมที่ค้างอยู่ไม่หาย · เปิดตรงด้วย `/#cards`, `/#deckbuilder` · `/cards/` ยังเปิดแบบหน้าเดี่ยวได้ · ธีมของเกมให้ตรงกับ Card List อยู่ที่ตัวแปรสีใน `web/css/style.css` (`:root`) และ `web/css/theme.css`

เกมดึงการ์ดและรูปจาก `/api` บนเซิร์ฟเวอร์เดียวกันโดยอัตโนมัติ (ไม่ต้องตั้งที่อยู่ card-api อีก) แก้การ์ดผ่าน `/admin` แล้วเกมเห็นทันทีที่โหลดหน้าใหม่

## รันในเครื่อง
```
npm install
ADMIN_PASSWORD=รหัสผ่านหลังบ้าน ADMIN_KEY=รหัสอ่านข้อเสนอแนะ npm start
```
เปิด http://localhost:3000/ (เกม) · http://localhost:3000/cards/ (Card List) · http://localhost:3000/admin

## ตัวแปรสภาพแวดล้อม
| ชื่อ | คำอธิบาย |
|---|---|
| `ADMIN_PASSWORD` | รหัสเข้า `/admin` (ไม่ตั้ง = หลังบ้านปิด) แนะนำยาว 12 ตัวขึ้นไป |
| `ADMIN_SECRET` | คีย์เซ็น session ของ `/admin` (ไม่จำเป็น) |
| `ADMIN_KEY` | รหัสเปิด `/recommece?key=...` (ไม่ตั้ง = ใครรู้ลิงก์ก็อ่านได้ แต่ลบไม่ได้) แยกจาก `ADMIN_PASSWORD` เพราะ key นี้อยู่ใน URL |
| `DATA_DIR` | โฟลเดอร์ดิสก์ถาวร เก็บ `data/` (การ์ด เด็ค ธาตุ) `images/` `backups/` และ `feedback.json` |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `MAIL_FROM` | อีเมลสำเนาข้อเสนอแนะ (ไม่ตั้ง RESEND_API_KEY = ไม่ส่งอีเมล) |
| `PORT` | โฮสต์ส่วนใหญ่ตั้งให้เอง |

> ⚠ ถ้าไม่ตั้ง `DATA_DIR` ข้อมูลที่แก้ผ่าน /admin และข้อเสนอแนะจะเขียนลงโฟลเดอร์โค้ด ซึ่งบนโฮสต์ที่ดิสก์ชั่วคราว (Render ฟรี ฯลฯ) **จะหายเมื่อ deploy ใหม่/รีสตาร์ต** ต้องผูก Persistent Disk แล้วชี้ `DATA_DIR` ไปที่ดิสก์นั้น ครั้งแรกระบบคัดลอกข้อมูลเริ่มต้นไปไว้ที่ `DATA_DIR` ให้เอง

## Deploy บน Render
ใช้ `render.yaml` (Blueprint) เป็น Web Service ตัวเดียว: `npm install` / `npm start`, health check `/api/health`, ผูกดิสก์ 1GB ที่ `/var/data` (`DATA_DIR`) ใช้แพ็กเกจ `starter` ขึ้นไป (ดิสก์ถาวรใช้ไม่ได้กับ Free)
1. push ขึ้น GitHub → Render: New → Blueprint
2. ตั้ง `ADMIN_PASSWORD` (และ `RESEND_API_KEY` ถ้าต้องการอีเมล) · `ADMIN_KEY`/`ADMIN_SECRET` ระบบสุ่มให้
3. ถ้าเคยมี 2 service เดิม (`avastfalltcgsim`, `avastfalltcglist`) ให้ย้ายข้อมูลการ์ดที่แก้ผ่าน /admin มาก่อน (ส่งออกการ์ดจากแท็บนำเข้า Excel ของ service เดิม แล้วนำเข้าใน service ใหม่ พร้อมรูป) จากนั้นค่อยปิด service เดิม

## โครงสร้าง
```
server.js              เซิร์ฟเวอร์รวม (Express) + card-api สาธารณะ
lib/playtest.js        ส่วนของเกม: ข้อเสนอแนะ, /recommece, ห้องออนไลน์ (SSE) — วางก่อน compression/json ใน server.js
lib/store.js ...       โหลด/บันทึกการ์ด รูป ข้อมูลสำรอง · importer/xlsx/csv
admin/                 หลังบ้าน /admin
data/*.json            ข้อมูลการ์ดเริ่มต้น (cards, decks, elements)
public/                Card List + Deckbuilder + docs (เสิร์ฟที่ /cards/) + images/ รูปเริ่มต้น
web/                   เกมทดลองเล่น (เสิร์ฟที่ /)  — index.html, css/, js/, assets/
```

## เกมทดลองเล่น (web/)
```
web/js/engine/engine.js        กติกาเกม (ไม่แตะ DOM)
web/js/effects/_kit.js         ตัวช่วยร่วมของสคริปต์การ์ด
web/js/effects/sd01..06, bt01  เอฟเฟกต์การ์ดแยกตามชุด  FX['SD04-012'] = {...} + NOTES['SD04-012'] = '...'
web/js/bot.js                  บอท
web/js/data/cards-api.js       ชั้นดึงข้อมูล: card-api, สำเนาในเบราว์เซอร์, URL รูป, ตรวจการ์ดใหม่/ข้อความเปลี่ยน
web/js/data/snapshot.js        ชุดการ์ดสำรอง และเป็น "ข้อความที่สคริปต์เขียนไว้ตามนั้น"
web/js/ui/*.js                 หน้าจอ
```

### แก้/เพิ่มเอฟเฟกต์การ์ด
1. เปิดเกม → ชิป "ข้อมูลการ์ด" ด้านบน แสดง "ยังไม่มีสคริปต์" และ "ข้อความต่างจากที่สคริปต์เขียนไว้" (กด "ดูส่วนที่ต่าง" เทียบข้อความเดิมกับข้อความใน card-api)
2. แก้ `FX[รหัสการ์ด]` ในไฟล์ชุดนั้นใน `web/js/effects/` และถ้าตีความไม่ตรงตัวให้เขียน `NOTES[รหัสการ์ด]` ไว้ข้างกัน
3. ถ้าข้อความการ์ดเปลี่ยนแต่ **พฤติกรรมในเกมไม่เปลี่ยน** (แค่เขียนให้ชัดเจนขึ้น) ไม่ต้องแก้ `FX` แก้รายการการ์ดนั้นใน `web/js/data/snapshot.js` ให้เหมือนข้อความล่าสุดใน card-api (ใช้ข้อความจาก `data/cards.json` หรือ `/api/cards/<รหัส>`) ป้าย "ข้อความเปลี่ยน" จะหาย แล้วเพิ่มบรรทัดใน Update Note (`web/js/ui/notes.js`)

### เชื่อมกับ card-api
- ค่าเริ่มต้น = เซิร์ฟเวอร์เดียวกับหน้าเว็บ (`location.origin`) เปลี่ยนได้ที่ชิป "ข้อมูลการ์ด" หรือ `?api=https://...` ถ้าเบราว์เซอร์เคยจำที่อยู่เดิม (`avastfalltcglist.onrender.com`) ระบบย้ายมาใช้เซิร์ฟเวอร์นี้ให้เอง
- ดึง `/api/cards` `/api/decks` `/api/elements` ทุกครั้งที่เปิดหน้า และเมื่อกลับมาที่แท็บหลังผ่านไปเกิน 90 วินาที เก็บสำเนาในเบราว์เซอร์ ถ้าต่อไม่ได้ใช้สำเนา หรือ `snapshot.js`
- รูปการ์ดดึงจาก API (`/images/<รหัส>.jpg?v=...`) ถ้าโหลดไม่ได้จะเห็นลายหลังการ์ดแทน

### ออนไลน์กับเพื่อน
สร้างห้อง → ส่งรหัส 5 ตัวหรือลิงก์ `?room=รหัส` → ทั้งคู่เลือกเด็คแล้วกด "พร้อม" · แบบ lockstep: ทั้งสองเบราว์เซอร์รัน engine เดียวกันด้วย seed เดียวกัน เซิร์ฟเวอร์ส่งต่อแค่ตัวเลือกที่กด · ห้องเก็บในหน่วยความจำ (รีสตาร์ตแล้วหาย) · ยังไม่กันโกง (เหมาะกับ Open Test)

### เปิดซอง (BT01)
ปุ่ม "เปิดซอง" บนแถบเมนู → หน้าต่างซ้อนโหลด `web/packs.html` (`web/js/packs.js`, `web/css/packs.css`) · ดึงการ์ดชุด BT01 จาก `/api/cards?deck=BT01` (เพิ่มการ์ดผ่าน /admin แล้วเข้าซองเอง) · ปรับกติกาที่ค่าคงที่ `PACK` ต้นไฟล์ `packs.js` (ขนาดซอง, ช่อง Common, น้ำหนัก R/SR) · คอลเลกชันเก็บใน localStorage `af-collection-v1`

### กฎการจัดเด็คตามธาตุ Avatar
- Avatar กำหนดธาตุของเด็ค ใส่ได้เฉพาะการ์ดธาตุนั้น (Avatar 2 สีใส่ได้ทั้งสองธาตุ) การ์ดที่ไม่ระบุธาตุใส่ได้ทุกเด็ค
- Unit ลงสนามต้องจ่าย Element ตรงสี · Spell/Enchant/Equipment/Domain/Ultimate จ่ายด้วยสีอะไรก็ได้
- เด็คต้อง 60 ใบ (รวม Avatar), ชื่อซ้ำ ≤ 4, Element Deck 8 ใบ (Avatar 2 สีแบ่ง 4/4), Domain 3 ใบต่อฝั่ง

## Card List / card-api / หลังบ้าน
คู่มือฉบับเต็มอยู่ใน [MANUAL.md](MANUAL.md) · เอกสาร API ที่ `/api/docs`

**เพิ่มการ์ดผ่าน /admin:** เข้า `/admin` → แท็บ *นำเข้า Excel* (ดาวน์โหลดต้นแบบ/ส่งออกการ์ดปัจจุบัน) → เลือก `.xlsx`/`.csv` (+ รูปตั้งชื่อตาม id เช่น `SD01-001.jpg`, สูงสุด 99 รูป/รอบ, ≤ 5MB/รูป) → *ตรวจสอบก่อน* → *บันทึกเข้าระบบ* · หรือเพิ่มทีละใบที่แท็บ *+ เพิ่มการ์ด 1 ใบ* · ข้อมูลสำรองอัตโนมัติก่อนแก้ทุกครั้ง (กู้คืนได้ในแท็บ *สำรอง/กู้คืน*) · กฎ Excel: 1 แถว = 1 ใบ, ต้องมี deck, no, name, type, ชีท `decks` (ถ้ามี) ใช้เป็นข้อมูลเด็ค

**Deckbuilder (`/cards/` แท็บ Deckbuilder):** แชร์/คัดลอกข้อความ (นำไปวางที่ *เด็คของฉัน → นำเข้าจากข้อความ* ในเกม) · ลิงก์แชร์ `/cards/#deck=...` · ดาวน์โหลด .txt · เด็คที่บันทึกเก็บใน localStorage ของเบราว์เซอร์

# SBA Data Dictionary

เว็บ React + Vite ใช้ Supabase สำหรับสมาชิกและข้อมูลแก้ไข พร้อม Deploy บน Vercel

## ตั้งค่า Supabase

1. เปิด Supabase SQL Editor และรัน `supabase/schema.sql`
2. ไปที่ Project Settings → API
3. คัดลอก Project URL และ Publishable/anon key ลงไฟล์ `.env.local`

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_KEY
```

บัญชีที่สมัครเป็นคนแรกจะได้สิทธิ์ `admin` อัตโนมัติ บัญชีถัดไปเริ่มเป็น `viewer`

## รันในเครื่อง

```bash
npm install
npm run dev
```

## Deploy ด้วย Vercel

เชื่อม GitHub repository นี้กับ Vercel แล้วเพิ่ม Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Build command ใช้ `npm run build` และ Output directory ใช้ `dist`

> ห้ามนำ Database password หรือ `service_role` key ใส่ใน GitHub/Vite frontend

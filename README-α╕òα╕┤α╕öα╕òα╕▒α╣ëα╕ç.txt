SBA Query Generator v1 — ฟรี 100%

ชุดนี้สร้างจากไฟล์ Data Dictionary ที่แป้งอัปโหลดจริง
- 31 ตาราง
- 841 ฟิลด์
- ไม่ใช้ OpenAI
- ไม่ใช้ API Key
- ไม่มีค่าใช้จ่าย API

ไฟล์ที่ต้องนำเข้า GitHub
1. public/ai-assistant.html
2. public/search-index.json
3. public/alias.json
4. public/business-knowledge.json

ขั้นตอนแก้ผ่านหน้า GitHub (ไม่ต้อง Clone)

A. อัปโหลดไฟล์ใน public
1. เปิด https://github.com/phichanok/sba-datadict-web
2. กดโฟลเดอร์ public
3. กด Add file > Upload files
4. ลากไฟล์ทั้ง 4 ไฟล์จากโฟลเดอร์ public ใน ZIP นี้
5. ถ้า GitHub เตือนว่า ai-assistant.html มีอยู่แล้ว ให้ลบไฟล์เดิมก่อน หรือเปิดไฟล์เดิม กด Edit แล้ววางโค้ดใหม่
6. Commit message: Add advanced free SBA query generator
7. กด Commit changes

B. เพิ่มปุ่มเข้า Query Generator (ทำเฉพาะถ้ายังไม่มีปุ่ม)
1. เปิด src/App.tsx
2. กดปุ่มดินสอ Edit
3. ค้นหา <div className="actions">
4. วางโค้ดนี้ไว้ใต้บรรทัดนั้น:

<a href="/ai-assistant.html" className="action primary">
  SBA Query Generator
</a>

5. Commit changes

C. รอ Vercel Deploy
1. เข้า Vercel > โปรเจกต์ sba-datadict-web
2. เปิด Deployments
3. รอ Status = Ready
4. เปิดเว็บแล้วกด SBA Query Generator

ไม่ต้องเพิ่มสิ่งเหล่านี้
- OPENAI_API_KEY
- Environment Variable
- Package ใหม่
- npm install เพิ่ม

ความสามารถ
- SELECT / WHERE
- DISTINCT
- COUNT / COUNT DISTINCT
- SUM / AVG / MAX / MIN
- GROUP BY
- HAVING
- ORDER BY ASC/DESC
- FIRST N
- เลือก Table จาก Description และ Business Rule
- แสดง Query Plan ก่อน SQL
- ปฏิเสธ UPDATE/DELETE/INSERT/DROP/ALTER

โจทย์ทดสอบ
1. หา order ย้อนหลังก่อนแก้ไขของ CustCode 123124
2. รวม CashBalance แยกตาม CustCode เรียงจากมากไปน้อย 10 อันดับ
3. นับจำนวนลูกค้าแยกตาม Branch
4. แสดง ShareCode ไม่ซ้ำจาก MCSM
5. หา 5 ลูกค้าที่มี CashBalance มากที่สุด
6. รวม PositiveUnit แยกตาม ShareCode เรียงจากมากไปน้อย 10 อันดับ
7. แสดง ShareCode ที่มียอด PositiveUnit รวมมากกว่า 100000

ข้อจำกัด
- ระบบไม่รัน SQL จริง
- JOIN ยังไม่เปิด เพราะ Data Dictionary ยังไม่ได้ยืนยันความสัมพันธ์ทุกคู่
- หากคำถามกำกวม ระบบจะแสดงหลาย Table ให้เลือก

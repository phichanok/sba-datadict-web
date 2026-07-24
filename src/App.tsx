"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { appFetch, onAuthChange, signIn, signOut, signUp } from "./api";

type Field = { name: string; type: string; key: string; description: string; rule: string };
type TableDef = { name: string; sheetName: string; thaiName: string; description: string; notes: string[]; fields: Field[] };
type Dictionary = { source: string; tableCount: number; fieldCount: number; tables: TableDef[] };
type SearchResult = Field & { table: string; thaiName: string };
type CustomData = {
  tables: Array<{ id: number; name: string; thaiName: string; description: string }>;
  fields: Array<Field & { id: number; tableName: string }>;
  tableEdits: Array<{ tableName: string; thaiName: string; description: string }>;
  fieldEdits: Array<Field & { tableName: string; fieldName: string }>;
  removedTables: Array<{ tableName: string }>;
  removedFields: Array<{ tableName: string; fieldName: string }>;
};
type AdminSession = {
  authenticated: boolean;
  role: "admin" | "editor" | "viewer" | null;
  canEdit: boolean;
  canManageUsers: boolean;
  displayName: string | null;
  email: string | null;
};
type ManagedUser = { id?: number; email: string; role: "admin" | "editor" | "viewer"; protected?: boolean };
type Modal = "table" | "field" | "theme" | "editTable" | "editField" | "users" | "login" | null;
const emptyCustom: CustomData = { tables: [], fields: [], tableEdits: [], fieldEdits: [], removedTables: [], removedFields: [] };
const emptySession: AdminSession = { authenticated: false, role: null, canEdit: false, canManageUsers: false, displayName: null, email: null };

const themes = [
  { id: "ocean", name: "Ocean Mint", colors: ["#22c9a7", "#1677ff", "#f5f8fc"] },
  { id: "violet", name: "Violet Bloom", colors: ["#8b5cf6", "#ec4899", "#faf8ff"] },
  { id: "sunset", name: "Coral Sunset", colors: ["#f97360", "#f59e0b", "#fffaf5"] },
  { id: "midnight", name: "Midnight Pro", colors: ["#40e0bd", "#60a5fa", "#09111d"] },
];

function Icon({ type }: { type: "search" | "database" | "plus" | "palette" }) {
  const paths = {
    search: <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    palette: <path d="M12 3a9 9 0 0 0 0 18h1.4a1.6 1.6 0 0 0 1.2-2.65 1.6 1.6 0 0 1 1.2-2.65H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3ZM7.5 11h.01M9.5 7.5h.01M14 7h.01M17 10h.01" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

export default function Home() {
  const [base, setBase] = useState<Dictionary | null>(null);
  const [custom, setCustom] = useState<CustomData>(emptyCustom);
  const [query, setQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedField, setSelectedField] = useState<SearchResult | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [theme, setTheme] = useState("ocean");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<AdminSession>(emptySession);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);

  async function reloadCustom() {
    const response = await appFetch("/api/custom-dictionary");
    if (response.ok) setCustom(await response.json());
  }

  async function reloadSession() {
    const response = await appFetch("/api/auth-status");
    if (response.ok) setSession(await response.json());
  }

  useEffect(() => {
    Promise.all([
      appFetch("/data-dictionary.json").then((response) => response.json()),
      appFetch("/api/custom-dictionary").then((response) => response.ok ? response.json() : emptyCustom),
      appFetch("/api/auth-status", { cache: "no-store" }).then((response) => response.ok ? response.json() : emptySession),
    ]).then(([dictionary, customData, authSession]) => {
      setBase(dictionary);
      setCustom(customData);
      setSession(authSession);
      const saved = localStorage.getItem("sba-theme");
      if (saved) setTheme(saved);
    });
    const subscription = onAuthChange(() => void reloadSession());
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sba-theme", theme);
  }, [theme]);

  const dictionary = useMemo<Dictionary | null>(() => {
    if (!base) return null;
    const removedTables = new Set((custom.removedTables ?? []).map((item) => item.tableName));
    const removedFields = new Set((custom.removedFields ?? []).map((item) => `${item.tableName}:${item.fieldName}`));
    const map = new Map(base.tables
      .filter((table) => !removedTables.has(table.name))
      .map((table) => [table.name, {
        ...table,
        fields: table.fields.filter((field) => !removedFields.has(`${table.name}:${field.name}`)),
      }]));
    custom.tables.forEach((table) => {
      if (!removedTables.has(table.name) && !map.has(table.name)) map.set(table.name, { ...table, sheetName: `custom-${table.id}`, notes: [], fields: [] });
    });
    custom.fields.forEach((field) => {
      const table = map.get(field.tableName);
      if (table && !removedFields.has(`${field.tableName}:${field.name}`)) table.fields.push(field);
    });
    custom.tableEdits?.forEach((edit) => {
      const table = map.get(edit.tableName);
      if (table) Object.assign(table, { thaiName: edit.thaiName, description: edit.description });
    });
    custom.fieldEdits?.forEach((edit) => {
      const field = map.get(edit.tableName)?.fields.find((item) => item.name === edit.fieldName);
      if (field) Object.assign(field, {
        type: edit.type, key: edit.key, description: edit.description, rule: edit.rule,
      });
    });
    const tables = [...map.values()];
    return { ...base, tables, tableCount: tables.length, fieldCount: tables.reduce((sum, table) => sum + table.fields.length, 0) };
  }, [base, custom]);

  const rows = useMemo<SearchResult[]>(() => dictionary?.tables.flatMap((table) =>
    table.fields.map((field) => ({ ...field, table: table.name, thaiName: table.thaiName }))) ?? [], [dictionary]);
  const dataTypes = useMemo(() => [...new Set(rows.map((row) => row.type).filter(Boolean))].sort(), [rows]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (selectedTable !== "ALL" && row.table !== selectedTable) return false;
      if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
      return !needle || [row.table, row.thaiName, row.name, row.type, row.key, row.description, row.rule]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [rows, query, selectedTable, typeFilter]);
  const selectedTableDef = dictionary?.tables.find((table) => table.name === selectedTable);

  async function submit(event: FormEvent<HTMLFormElement>, kind: "table" | "field") {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const target = kind === "table" ? String(body.name) : `${body.tableName}.${body.name}`;
    if (!window.confirm(`ยืนยันการเพิ่ม${kind === "table" ? "ตาราง" : "ฟิลด์"} “${target}” ใช่ไหม?`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/custom-dictionary", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, kind }),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "บันทึกไม่สำเร็จ");
      await reloadCustom();
      setModal(null);
      setNotice(kind === "table" ? "เพิ่มตารางเรียบร้อยแล้ว" : "เพิ่มฟิลด์เรียบร้อยแล้ว");
      setTimeout(() => setNotice(""), 2600);
    } finally {
      setBusy(false);
    }
  }

  function requireEditor(action: () => void) {
    if (session.canEdit) return action();
    if (!session.authenticated) {
      setModal("login");
      return;
    }
    setNotice("บัญชีนี้มีสิทธิ์ดูข้อมูลเท่านั้น");
    setTimeout(() => setNotice(""), 2600);
  }

  async function openUserManager() {
    setBusy(true);
    try {
      const response = await appFetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      setManagedUsers([...(data.owners ?? []), ...(data.users ?? [])]);
      setModal("users");
    } finally {
      setBusy(false);
    }
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!window.confirm(`ยืนยันการเพิ่ม “${body.email}” เป็น ${body.role} ใช่ไหม?`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
      await openUserManager();
      event.currentTarget.reset();
      setNotice("เพิ่มผู้ใช้และกำหนดสิทธิ์เรียบร้อยแล้ว");
    } finally {
      setBusy(false);
    }
  }

  async function changeUserRole(email: string, role: ManagedUser["role"]) {
    if (!window.confirm(`ยืนยันการเปลี่ยนสิทธิ์ “${email}” เป็น ${role} ใช่ไหม?`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/users", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "เปลี่ยนสิทธิ์ไม่สำเร็จ");
      await openUserManager();
      setNotice("เปลี่ยนสิทธิ์ผู้ใช้เรียบร้อยแล้ว");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(email: string) {
    if (!window.confirm(`ยืนยันการถอนสิทธิ์ “${email}” ใช่ไหม?\nผู้ใช้นี้จะกลับเป็นผู้ชมทันที`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/users", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "ถอนสิทธิ์ไม่สำเร็จ");
      await openUserManager();
      setNotice("ถอนสิทธิ์ผู้ใช้เรียบร้อยแล้ว");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>, kind: "table" | "field") {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const target = kind === "table" ? String(body.tableName) : `${body.tableName}.${body.fieldName}`;
    if (!window.confirm(`ยืนยันการแก้ไข “${target}” ใช่ไหม?`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/custom-dictionary", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, kind }),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "แก้ไขไม่สำเร็จ");
      await reloadCustom();
      setModal(null);
      setSelectedField(null);
      setNotice(kind === "table" ? "แก้ไขข้อมูลตารางเรียบร้อยแล้ว" : "แก้ไขข้อมูลฟิลด์เรียบร้อยแล้ว");
      setTimeout(() => setNotice(""), 2600);
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: "table" | "field", tableName: string, fieldName?: string) {
    const target = fieldName ? `${tableName}.${fieldName}` : tableName;
    const detail = kind === "table" ? "\nฟิลด์ทั้งหมดในตารางนี้จะถูกซ่อนด้วย" : "";
    if (!window.confirm(`ยืนยันการลบ “${target}” ใช่ไหม?${detail}\n\nการดำเนินการนี้ไม่สามารถยกเลิกจากหน้าเว็บได้`)) return;
    setBusy(true);
    try {
      const response = await appFetch("/api/custom-dictionary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, tableName, fieldName }),
      });
      const data = await response.json();
      if (!response.ok) return setNotice(data.error || "ลบข้อมูลไม่สำเร็จ");
      await reloadCustom();
      setModal(null);
      setSelectedField(null);
      if (kind === "table") setSelectedTable("ALL");
      setNotice(`ลบ${kind === "table" ? "ตาราง" : "ฟิลด์"} ${target} เรียบร้อยแล้ว`);
      setTimeout(() => setNotice(""), 2600);
    } finally {
      setBusy(false);
    }
  }

  async function authenticate(formElement: HTMLFormElement, mode: "signin" | "signup") {
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();
    setBusy(true);
    setNotice("");
    try {
      const result = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, displayName);
      if (result.error) return setNotice(result.error.message);
      await reloadSession();
      setModal(null);
      setNotice(mode === "signin" ? "เข้าสู่ระบบเรียบร้อยแล้ว" : "สมัครสมาชิกสำเร็จ กรุณาตรวจอีเมลหากระบบขอยืนยันบัญชี");
      setTimeout(() => setNotice(""), 3200);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut();
    setSession(emptySession);
    setNotice("ออกจากระบบแล้ว");
    setTimeout(() => setNotice(""), 2200);
  }

  if (!dictionary) return <main className="loading-screen"><div className="loader" /><p>กำลังโหลด SBA Data Dictionary...</p></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon type="database" /></span><div><strong>SBA DICT</strong><small>DATA KNOWLEDGE HUB</small></div></div>
        <div className="sidebar-label"><span>DATABASE TABLES</span><span>{dictionary.tableCount}</span></div>
        <nav className="table-list" aria-label="รายชื่อตาราง">
          <button className={selectedTable === "ALL" ? "active" : ""} onClick={() => setSelectedTable("ALL")}><span className="table-code">ALL</span><span className="table-meta">ทุกตาราง</span><b>{dictionary.fieldCount}</b></button>
          {dictionary.tables.map((table) => <button key={table.sheetName} className={selectedTable === table.name ? "active" : ""} onClick={() => setSelectedTable(table.name)}><span className="table-code">{table.name}</span><span className="table-meta">{table.thaiName || "SBA table"}</span><b>{table.fields.length}</b></button>)}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /><div><strong>พร้อมใช้งาน</strong><small>{dictionary.fieldCount.toLocaleString()} fields indexed</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">SBA KNOWLEDGE BASE</p><h1>Data Dictionary</h1><p className="subtitle">ค้นหาและจัดการโครงสร้างข้อมูล SBA ในที่เดียว</p></div>
          <div className="actions">
            <button className="action secondary" onClick={() => setModal("theme")}><Icon type="palette" /> เปลี่ยนธีม</button>
            {session.canManageUsers && <button className="action secondary" disabled={busy} onClick={openUserManager}>จัดการผู้ใช้</button>}
            {session.canEdit ? <>
              <button className="action secondary" onClick={() => setModal("field")}><Icon type="plus" /> เพิ่มฟิลด์</button>
              <button className="action primary" onClick={() => setModal("table")}><Icon type="plus" /> เพิ่มตาราง</button>
            </> : session.authenticated ? <span className="access-badge viewer">ดูข้อมูลเท่านั้น</span> :
              <button className="action primary" onClick={() => requireEditor(() => undefined)}>เข้าสู่ระบบผู้ดูแล</button>}
            {session.authenticated && <button className="account-link" onClick={logout} title="คลิกเพื่อออกจากระบบ">
              <span>{session.role === "admin" ? "ผู้ดูแล" : session.role === "editor" ? "ผู้แก้ไข" : "ผู้ชม"}</span>
              <strong>{session.displayName || session.email}</strong>
            </button>}
          </div>
        </header>

        <section className="search-panel">
          <div className="command-input"><Icon type="search" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา Table, Field, คำอธิบาย หรือ Business Rule..." aria-label="ค้นหา Data Dictionary" />{query && <button className="clear-button" onClick={() => setQuery("")}>ล้าง</button>}</div>
          <div className="filters">
            <label>TABLE<select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}><option value="ALL">ทุกตาราง</option>{dictionary.tables.map((table) => <option key={table.sheetName} value={table.name}>{table.name}</option>)}</select></label>
            <label>DATA TYPE<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="ALL">ทุกประเภท</option>{dataTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <button className="reset-button" onClick={() => { setQuery(""); setSelectedTable("ALL"); setTypeFilter("ALL"); }}>รีเซ็ตตัวกรอง</button>
          </div>
        </section>

        <section className="metrics">
          <article><span>TABLES</span><strong>{dictionary.tableCount}</strong><small>ตารางทั้งหมด</small></article>
          <article><span>TOTAL FIELDS</span><strong>{dictionary.fieldCount.toLocaleString()}</strong><small>ฟิลด์ที่ค้นหาได้</small></article>
          <article><span>MATCHED</span><strong className="accent">{results.length.toLocaleString()}</strong><small>ผลลัพธ์ปัจจุบัน</small></article>
        </section>

        {selectedTableDef && <section className="table-summary"><span className="table-badge">{selectedTableDef.name}</span><div><h2>{selectedTableDef.thaiName || selectedTableDef.name}</h2><p>{selectedTableDef.description || "ยังไม่มีคำอธิบายตาราง"}</p></div>{session.canEdit && <div className="record-actions"><button className="edit-button" onClick={() => setModal("editTable")}>แก้ไขตาราง</button><button className="delete-button" disabled={busy} onClick={() => remove("table", selectedTableDef.name)}>ลบตาราง</button></div>}</section>}

        <section className="result-panel">
          <div className="result-heading"><div><span>SEARCH RESULTS</span><p>{query ? `ผลลัพธ์สำหรับ “${query}”` : selectedTable === "ALL" ? "ข้อมูลจากทุกตาราง" : `ฟิลด์ทั้งหมดใน ${selectedTable}`}</p></div><span className="result-count">{results.length} รายการ</span></div>
          <div className="data-grid" role="table">
            <div className="grid-row grid-header" role="row"><span>TABLE</span><span>FIELD NAME</span><span>DATA TYPE</span><span>KEY</span><span>DESCRIPTION / BUSINESS RULE</span></div>
            {results.length ? results.map((row, index) => <button className="grid-row" role="row" key={`${row.table}-${row.name}-${index}`} onClick={() => setSelectedField(row)}><span><b className="table-pill">{row.table}</b></span><span className="field-name">{row.name}</span><span><code>{row.type || "—"}</code></span><span><i className={row.key && row.key !== "-" ? "key-active" : ""}>{row.key || "—"}</i></span><span className="description-cell"><strong>{row.description || "ยังไม่มีคำอธิบาย"}</strong>{row.rule && <small>{row.rule}</small>}</span></button>) : <div className="empty-state"><Icon type="search" /><h3>ไม่พบข้อมูลที่ค้นหา</h3><p>ลองใช้คำสั้นลงหรือเปลี่ยนตัวกรอง</p></div>}
          </div>
        </section>
      </section>

      {notice && <div className="toast">{notice}</div>}

      {modal && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}><section className="modal-card">
        <button className="modal-close" onClick={() => setModal(null)}>×</button>
        {modal === "login" ? <form onSubmit={(e) => { e.preventDefault(); void authenticate(e.currentTarget, "signin"); }}>
          <p className="eyebrow">SECURE ACCESS</p><h2>เข้าสู่ระบบ SBA Dictionary</h2><p className="modal-lead">ใช้บัญชีของเว็บนี้เพื่อจัดการข้อมูลตามสิทธิ์ Admin / Editor / Viewer</p>
          <div className="form-grid"><label className="wide">ชื่อที่แสดง (ใช้ตอนสมัคร)<input name="displayName" placeholder="เช่น น้องแป้ง" /></label><label className="wide">อีเมล<input name="email" type="email" required /></label><label className="wide">รหัสผ่าน<input name="password" type="password" minLength={6} required /></label></div>
          {notice && <p className="form-error">{notice}</p>}
          <div className="form-actions"><button type="button" className="action secondary" disabled={busy} onClick={(e) => { const form = e.currentTarget.closest("form"); if (form) void authenticate(form, "signup"); }}>สมัครสมาชิก</button><button type="submit" disabled={busy} className="action primary">{busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button></div>
        </form> :
        modal === "theme" ? <><p className="eyebrow">APPEARANCE</p><h2>เลือกธีมที่ใช่</h2><p className="modal-lead">เปลี่ยนบรรยากาศให้เข้ากับสไตล์การทำงานของน้องแป้ง</p><div className="theme-grid">{themes.map((item) => <button key={item.id} className={`theme-option ${theme === item.id ? "selected" : ""}`} onClick={() => { if (item.id === theme || window.confirm(`ยืนยันการเปลี่ยนธีมเป็น “${item.name}” ใช่ไหม?`)) { setTheme(item.id); setTimeout(() => setModal(null), 250); } }}><span className="swatches">{item.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{item.name}</strong><small>{theme === item.id ? "กำลังใช้งาน" : "เลือกธีมนี้"}</small></button>)}</div></> :
        modal === "users" ? <>
          <p className="eyebrow">ACCESS CONTROL</p><h2>จัดการผู้ใช้และสิทธิ์</h2><p className="modal-lead">เพิ่มอีเมลบัญชี ChatGPT แล้วกำหนดว่าใครจัดการข้อมูลหรือดูได้อย่างเดียว</p>
          <form className="user-add-form" onSubmit={addUser}>
            <label>อีเมลผู้ใช้<input name="email" type="email" required placeholder="name@company.com" /></label>
            <label>สิทธิ์<select name="role" defaultValue="viewer"><option value="admin">Admin — จัดการทุกอย่าง</option><option value="editor">Editor — จัดการข้อมูล</option><option value="viewer">Viewer — ดูอย่างเดียว</option></select></label>
            <button className="action primary" disabled={busy} type="submit">{busy ? "กำลังบันทึก..." : "เพิ่มผู้ใช้"}</button>
          </form>
          <div className="user-list">
            {managedUsers.map((user) => <article key={`${user.email}-${user.protected ? "owner" : "user"}`}>
              <div><strong>{user.email}</strong><small>{user.protected ? "เจ้าของระบบ — ป้องกันการแก้ไข" : user.role === "admin" ? "จัดการข้อมูลและสิทธิ์ผู้ใช้" : user.role === "editor" ? "เพิ่ม แก้ไข และลบข้อมูล" : "ค้นหาและดูข้อมูลเท่านั้น"}</small></div>
              {user.protected ? <span className="owner-badge">OWNER</span> : <div className="user-controls">
                <select aria-label={`สิทธิ์ของ ${user.email}`} value={user.role} disabled={busy} onChange={(e) => changeUserRole(user.email, e.target.value as ManagedUser["role"])}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                <button className="delete-button" disabled={busy || user.email === session.email?.toLowerCase()} onClick={() => removeUser(user.email)}>ถอนสิทธิ์</button>
              </div>}
            </article>)}
          </div>
          <p className="role-note"><b>Admin</b> จัดการข้อมูลและผู้ใช้ · <b>Editor</b> จัดการตาราง/ฟิลด์ · <b>Viewer</b> ดูอย่างเดียว</p>
        </> :
        modal === "editTable" && selectedTableDef ? <form onSubmit={(e) => submitEdit(e, "table")}>
          <p className="eyebrow">EDIT TABLE</p><h2>แก้ไข {selectedTableDef.name}</h2><p className="modal-lead">ชื่อตารางหลักจะถูกล็อกไว้ เพื่อไม่ให้การเชื่อมโยงฟิลด์เสียค่ะ</p>
          <input type="hidden" name="tableName" value={selectedTableDef.name} />
          <div className="form-grid"><label className="wide">ชื่อตาราง<input value={selectedTableDef.name} disabled /></label><label className="wide">ชื่อภาษาไทย<input name="thaiName" defaultValue={selectedTableDef.thaiName} /></label><label className="wide">คำอธิบาย<textarea name="description" rows={4} defaultValue={selectedTableDef.description} /></label></div>
          <div className="form-actions"><button type="button" className="action secondary" onClick={() => setModal(null)}>ยกเลิก</button><button type="submit" disabled={busy} className="action primary">{busy ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button></div>
        </form> :
        modal === "editField" && selectedField ? <form onSubmit={(e) => submitEdit(e, "field")}>
          <p className="eyebrow">EDIT FIELD</p><h2>แก้ไข {selectedField.name}</h2><p className="modal-lead">แก้รายละเอียดได้ โดยคงชื่อ Table และ Field เดิมไว้เพื่อความปลอดภัย</p>
          <input type="hidden" name="tableName" value={selectedField.table} /><input type="hidden" name="fieldName" value={selectedField.name} />
          <div className="form-grid"><label>ตาราง<input value={selectedField.table} disabled /></label><label>ชื่อฟิลด์<input value={selectedField.name} disabled /></label><label>Data Type<input name="type" defaultValue={selectedField.type} /></label><label>Key<select name="key" defaultValue={selectedField.key}><option value="">ไม่ระบุ</option><option>PK</option><option>FK</option><option>Index</option></select></label><label className="wide">คำอธิบาย<textarea name="description" rows={3} defaultValue={selectedField.description} /></label><label className="wide">Business Rule / ตัวอย่าง<textarea name="rule" rows={3} defaultValue={selectedField.rule} /></label></div>
          <div className="form-actions"><button type="button" className="action secondary" onClick={() => setModal(null)}>ยกเลิก</button><button type="submit" disabled={busy} className="action primary">{busy ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button></div>
        </form> :
        <form onSubmit={(e) => submit(e, modal as "table" | "field")}>
          <p className="eyebrow">{modal === "table" ? "NEW TABLE" : "NEW FIELD"}</p><h2>{modal === "table" ? "เพิ่มตารางใหม่" : "เพิ่มฟิลด์ใหม่"}</h2><p className="modal-lead">กรอกเฉพาะข้อมูลที่มีจริง ช่องอื่นเว้นไว้เพิ่มภายหลังได้ค่ะ</p>
          <div className="form-grid">
            {modal === "field" && <label className="wide">ตาราง *<select name="tableName" required defaultValue={selectedTable === "ALL" ? "" : selectedTable}><option value="" disabled>เลือกตาราง</option>{dictionary.tables.map((table) => <option key={table.sheetName} value={table.name}>{table.name} — {table.thaiName}</option>)}</select></label>}
            <label>{modal === "table" ? "ชื่อตาราง *" : "ชื่อฟิลด์ *"}<input name="name" required placeholder={modal === "table" ? "เช่น TCT" : "เช่น custcode"} /></label>
            {modal === "table" ? <label>ชื่อภาษาไทย<input name="thaiName" placeholder="เช่น ข้อมูลลูกค้า" /></label> : <><label>Data Type<input name="type" placeholder="เช่น varchar(20)" /></label><label>Key<select name="key"><option value="">ไม่ระบุ</option><option>PK</option><option>FK</option><option>Index</option></select></label></>}
            <label className="wide">คำอธิบาย<textarea name="description" rows={3} placeholder="อธิบายว่าข้อมูลนี้ใช้ทำอะไร" /></label>
            {modal === "field" && <label className="wide">Business Rule / ตัวอย่าง<textarea name="rule" rows={3} placeholder="เงื่อนไข ความหมายของค่า หรือตัวอย่างข้อมูล" /></label>}
          </div>
          {notice && <p className="form-error">{notice}</p>}
          <div className="form-actions"><button type="button" className="action secondary" onClick={() => setModal(null)}>ยกเลิก</button><button type="submit" disabled={busy} className="action primary">{busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button></div>
        </form>}
      </section></div>}

      {selectedField && <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSelectedField(null)}><aside className="detail-drawer"><button className="drawer-close" onClick={() => setSelectedField(null)}>×</button><p className="eyebrow">FIELD DETAILS</p><div className="drawer-title"><span>{selectedField.table}</span><h2>{selectedField.name}</h2>{session.canEdit && <div className="record-actions"><button className="edit-button" onClick={() => setModal("editField")}>แก้ไขฟิลด์</button><button className="delete-button" disabled={busy} onClick={() => remove("field", selectedField.table, selectedField.name)}>ลบฟิลด์</button></div>}</div><dl><div><dt>Data Type</dt><dd>{selectedField.type || "—"}</dd></div><div><dt>Key</dt><dd>{selectedField.key || "—"}</dd></div><div className="wide"><dt>Description</dt><dd>{selectedField.description || "ยังไม่มีคำอธิบาย"}</dd></div><div className="wide"><dt>Business Rule</dt><dd>{selectedField.rule || "ยังไม่มีข้อมูล"}</dd></div></dl><div className="query-hint"><span>QUERY STARTER</span><code>SELECT {selectedField.name} FROM {selectedField.table};</code><button onClick={() => navigator.clipboard.writeText(`SELECT ${selectedField.name} FROM ${selectedField.table};`)}>COPY SQL</button></div></aside></div>}
    </main>
  );
}

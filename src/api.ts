import { supabase } from "./supabase";

type Role = "admin" | "editor" | "viewer";
type Json = Record<string, unknown>;

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function currentProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", auth.user.id)
    .single();
  return data;
}

async function dictionary(method: string, body: Record<string, string>) {
  if (method === "GET") {
    const [tables, fields, tableEdits, fieldEdits, removedTables, removedFields] = await Promise.all([
      supabase.from("custom_tables").select("*").order("name"),
      supabase.from("custom_fields").select("*").order("table_name").order("name"),
      supabase.from("table_overrides").select("*"),
      supabase.from("field_overrides").select("*"),
      supabase.from("deleted_tables").select("*"),
      supabase.from("deleted_fields").select("*"),
    ]);
    const error = [tables, fields, tableEdits, fieldEdits, removedTables, removedFields].find((item) => item.error)?.error;
    if (error) return response({ error: error.message }, 500);
    return response({
      tables: (tables.data ?? []).map((x) => ({ id: x.id, name: x.name, thaiName: x.thai_name, description: x.description })),
      fields: (fields.data ?? []).map((x) => ({ id: x.id, tableName: x.table_name, name: x.name, type: x.data_type, key: x.key_name, description: x.description, rule: x.business_rule })),
      tableEdits: (tableEdits.data ?? []).map((x) => ({ tableName: x.table_name, thaiName: x.thai_name, description: x.description })),
      fieldEdits: (fieldEdits.data ?? []).map((x) => ({ tableName: x.table_name, fieldName: x.field_name, type: x.data_type, key: x.key_name, description: x.description, rule: x.business_rule })),
      removedTables: (removedTables.data ?? []).map((x) => ({ tableName: x.table_name })),
      removedFields: (removedFields.data ?? []).map((x) => ({ tableName: x.table_name, fieldName: x.field_name })),
    });
  }

  if (method === "POST" && body.kind === "table") {
    const { error } = await supabase.from("custom_tables").insert({
      name: body.name.trim().toUpperCase(),
      thai_name: body.thaiName?.trim() ?? "",
      description: body.description?.trim() ?? "",
    });
    return error ? response({ error: error.message }, 400) : response({ ok: true }, 201);
  }
  if (method === "POST" && body.kind === "field") {
    const { error } = await supabase.from("custom_fields").insert({
      table_name: body.tableName.trim().toUpperCase(),
      name: body.name.trim(),
      data_type: body.type?.trim() ?? "",
      key_name: body.key?.trim() ?? "",
      description: body.description?.trim() ?? "",
      business_rule: body.rule?.trim() ?? "",
    });
    return error ? response({ error: error.message }, 400) : response({ ok: true }, 201);
  }
  if (method === "PUT" && body.kind === "table") {
    const { error } = await supabase.from("table_overrides").upsert({
      table_name: body.tableName.trim().toUpperCase(),
      thai_name: body.thaiName?.trim() ?? "",
      description: body.description?.trim() ?? "",
    }, { onConflict: "table_name" });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  if (method === "PUT" && body.kind === "field") {
    const { error } = await supabase.from("field_overrides").upsert({
      table_name: body.tableName.trim().toUpperCase(),
      field_name: body.fieldName.trim(),
      data_type: body.type?.trim() ?? "",
      key_name: body.key?.trim() ?? "",
      description: body.description?.trim() ?? "",
      business_rule: body.rule?.trim() ?? "",
    }, { onConflict: "table_name,field_name" });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  if (method === "DELETE" && body.kind === "table") {
    const { error } = await supabase.from("deleted_tables").upsert({
      table_name: body.tableName.trim().toUpperCase(),
    }, { onConflict: "table_name" });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  if (method === "DELETE" && body.kind === "field") {
    const { error } = await supabase.from("deleted_fields").upsert({
      table_name: body.tableName.trim().toUpperCase(),
      field_name: body.fieldName.trim(),
    }, { onConflict: "table_name,field_name" });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  return response({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
}

async function users(method: string, body: Record<string, string>) {
  if (method === "GET") {
    const { data, error } = await supabase.from("profiles").select("id,email,role").order("email");
    return error ? response({ error: error.message }, 500) : response({
      owners: [],
      users: (data ?? []).map((x) => ({ id: x.id, email: x.email, role: x.role })),
    });
  }
  if (method === "POST") {
    const { data, error } = await supabase.rpc("set_user_role_by_email", {
      target_email: body.email.toLowerCase().trim(),
      new_role: body.role as Role,
    });
    if (error) return response({ error: error.message }, 400);
    if (!data) return response({ error: "ยังไม่พบบัญชีนี้ ผู้ใช้ต้องสมัครสมาชิกก่อน" }, 404);
    return response({ ok: true });
  }
  if (method === "PUT") {
    const { error } = await supabase.rpc("set_user_role_by_email", {
      target_email: body.email.toLowerCase().trim(),
      new_role: body.role as Role,
    });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  if (method === "DELETE") {
    const { error } = await supabase.rpc("set_user_role_by_email", {
      target_email: body.email.toLowerCase().trim(),
      new_role: "viewer",
    });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }
  return response({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
}

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method?.toUpperCase() ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, string> : {};

  if (url === "/api/custom-dictionary") return dictionary(method, body);
  if (url === "/api/users") return users(method, body);
  if (url === "/api/auth-status") {
    const profile = await currentProfile();
    if (!profile) return response({ authenticated: false, role: null, canEdit: false, canManageUsers: false, displayName: null, email: null });
    return response({
      authenticated: true,
      role: profile.role,
      canEdit: profile.role === "admin" || profile.role === "editor",
      canManageUsers: profile.role === "admin",
      displayName: profile.display_name,
      email: profile.email,
    });
  }
  return fetch(input, init);
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string, displayName: string) {
  return supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(callback: () => void) {
  return supabase.auth.onAuthStateChange(() => callback()).data.subscription;
}

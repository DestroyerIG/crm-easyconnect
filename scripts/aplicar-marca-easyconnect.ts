/**
 * Aplica a marca EasyConnect CRM (pasta `marca-easyconnect/`) no banco desta máquina.
 *
 * A marca da instalação mora em `platform_branding` (linha única id=1) e os arquivos no
 * bucket público `brand-logos`, prefixo `platform/`. Este script faz o que a tela
 * `/admin/marca` faz — sobe os PNGs, grava os ponteiros e as cores — para que a marca do
 * fork venha junto com o clone, sem refazer tudo pela interface.
 *
 * Idempotente: o nome do arquivo no bucket é um UUID derivado do hash do conteúdo, então rodar de novo
 * com os mesmos arquivos não duplica nada, e arquivo novo muda a URL (cache do navegador).
 *
 * Uso: pnpm marca:easyconnect   (lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * do ambiente, de .env ou de .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const PASTA = path.join(process.cwd(), "marca-easyconnect");
const BUCKET = "brand-logos";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]!]) out[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
    }
  }
  return out;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
}

const marca = JSON.parse(fs.readFileSync(path.join(PASTA, "marca.json"), "utf8")) as {
  nome_do_sistema: string;
  nome_da_organizacao: string;
  cor_da_marca: string;
  cor_da_marca_no_tema_escuro: string;
};
const HEX = /^#[0-9a-f]{6}$/;
for (const cor of [marca.cor_da_marca, marca.cor_da_marca_no_tema_escuro]) {
  if (!HEX.test(cor)) throw new Error(`Cor inválida em marca.json (use #rrggbb minúsculo): ${cor}`);
}

const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

/** Sobe o PNG com nome por hash e devolve o caminho dentro do bucket. */
async function subir(arquivo: string): Promise<string> {
  const bytes = fs.readFileSync(path.join(PASTA, arquivo));
  // O CHECK do banco exige `platform/<uuid>.png`: um UUID derivado do conteúdo (determinístico).
  const h = crypto.createHash("sha256").update(bytes).digest("hex");
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  const caminho = `platform/${uuid}.png`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(caminho, bytes, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`subir ${arquivo}: ${error.message}`);
  console.log(`[marca] ${arquivo} -> ${BUCKET}/${caminho}`);
  return caminho;
}

async function main() {
  const logo = await subir("logo.png");
  const logoEscuro = await subir("logo-escuro.png");
  const icone = await subir("icone.png");

  // `seeded_from_env: false`: a linha é HUMANA, a semeadura do .env não a reescreve.
  const { error } = await admin.from("platform_branding").upsert(
    {
      id: 1,
      app_name: marca.nome_do_sistema,
      accent_hex: marca.cor_da_marca,
      accent_dark_hex: marca.cor_da_marca_no_tema_escuro,
      logo_path: logo,
      logo_dark_path: logoEscuro,
      favicon_path: icone,
      seeded_from_env: false,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`gravar platform_branding: ${error.message}`);
  console.log("[marca] platform_branding atualizada");

  // A organização da instalação é a primeira criada (a que o bootstrap-owner cria).
  const { data: org, error: errOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (errOrg) throw new Error(`ler organização: ${errOrg.message}`);
  if (org) {
    const { error: errNome } = await admin
      .from("organizations")
      .update({ display_name: marca.nome_da_organizacao })
      .eq("id", org.id);
    if (errNome) throw new Error(`renomear organização: ${errNome.message}`);
    console.log(`[marca] organização ${org.id} agora é "${marca.nome_da_organizacao}"`);
  } else {
    console.log("[marca] nenhuma organização ainda — rode o bootstrap-owner e aplique de novo.");
  }
  console.log("✅ Marca aplicada. Recarregue a página (cache de ~30 s no servidor).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

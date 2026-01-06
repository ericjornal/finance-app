import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getOrCreateDemoUser() {
  const email = "demo@local";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  // Se duas requisições tentarem criar ao mesmo tempo, uma pode falhar com P2002.
  // Então, se falhar, buscamos de novo.
  try {
    return await prisma.user.create({
      data: { email, passwordHash: "demo" },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await prisma.user.findUnique({ where: { email } });
      if (again) return again;
    }
    throw err;
  }
}

export async function GET() {
  const user = await getOrCreateDemoUser();

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const user = await getOrCreateDemoUser();
  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nome inválido" }, { status: 400 });

  try {
    const created = await prisma.category.create({
      data: { name, userId: user.id },
    });
    return NextResponse.json(created);
  } catch (err: any) {
    // categoria duplicada pro mesmo usuário (por causa do @@unique([userId, name]))
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Categoria já existe" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
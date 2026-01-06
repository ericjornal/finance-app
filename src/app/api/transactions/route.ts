import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getOrCreateDemoUser() {
  const email = "demo@local";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: { email, passwordHash: "demo" },
    });
  } catch (err: any) {
    // Se duas requisições criarem ao mesmo tempo
    if (err?.code === "P2002") {
      const again = await prisma.user.findUnique({ where: { email } });
      if (again) return again;
    }
    throw err;
  }
}

function monthRange(month: string) {
  // month esperado: "YYYY-MM"
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Parâmetro month inválido: "${month}" (use YYYY-MM)`);

  const y = Number(match[1]);
  const m = Number(match[2]); // 1..12
  if (m < 1 || m > 12) throw new Error(`Mês inválido em month: "${month}"`);

  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function addMonthsUTC(date: Date, n: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  // Ajuste para meses com menos dias (ex.: 31 -> último dia)
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month") ?? "2026-01";
    const categoryId = url.searchParams.get("categoryId");
    const isCreditCard = url.searchParams.get("isCreditCard");
    const isRecurring = url.searchParams.get("isRecurring");

    const user = await getOrCreateDemoUser();
    const { start, end } = monthRange(month);

    const where: any = {
      userId: user.id,
      date: { gte: start, lt: end },
    };

    if (categoryId) where.categoryId = categoryId;
    if (isCreditCard === "true") where.isCreditCard = true;
    if (isRecurring === "true") where.recurrenceGroupId = { not: null };

    const tx = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(tx);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getOrCreateDemoUser();
    const body = await req.json();

    const type = body.type === "INCOME" ? "INCOME" : "EXPENSE";

    // Melhor prática: aceitar string "123.45" também
    const amountNum = Number(body.amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const dateStr = String(body.date ?? "");
    const date = new Date(`${dateStr}T00:00:00Z`);
    if (!dateStr || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }

    const description = body.description ? String(body.description) : null;

    const categoryId =
      type === "EXPENSE" && body.categoryId ? String(body.categoryId) : null;

    const isCreditCard = Boolean(body.isCreditCard);
    const cardLabel =
      isCreditCard && body.cardLabel ? String(body.cardLabel) : null;

    const isRecurring = Boolean(body.isRecurring);
    const recurrenceCount = Math.max(1, Number(body.recurrenceCount ?? 1));
    const recurrenceGroupId = isRecurring ? crypto.randomUUID() : null;

    // Sem recorrência: cria 1
    if (!isRecurring) {
      const created = await prisma.transaction.create({
        data: {
          userId: user.id,
          type,
          amount: amountNum,
          date,
          description,
          categoryId,
          isCreditCard,
          cardLabel,
        },
      });

      return NextResponse.json([created]);
    }

    // Recorrência (MVP): cria N lançamentos já no POST
    const createdMany = await prisma.$transaction(
      Array.from({ length: recurrenceCount }, (_, i) => {
        const d = addMonthsUTC(date, i);
        return prisma.transaction.create({
          data: {
            userId: user.id,
            type,
            amount: amountNum,
            date: d,
            description,
            categoryId,
            isCreditCard,
            cardLabel,
            recurrenceGroupId,
            recurrenceCount,
          },
        });
      })
    );

    return NextResponse.json(createdMany);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const groupId = url.searchParams.get("groupId");

    const user = await getOrCreateDemoUser();

    if (groupId) {
      await prisma.transaction.deleteMany({
        where: { userId: user.id, recurrenceGroupId: groupId },
      });
      return NextResponse.json({ ok: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: "id ou groupId obrigatório" },
        { status: 400 }
      );
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}
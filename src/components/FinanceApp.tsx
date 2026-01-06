"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// Protótipo INTERATIVO para preview no Canvas.
// Não usa backend/banco: simula login e dados em memória.
// A estrutura e UX espelham o app real (Next.js + API + Postgres).

const initialCategories = [
  { id: "c1", name: "Moradia" },
  { id: "c2", name: "Alimentação" },
  { id: "c3", name: "Transporte" },
  { id: "c4", name: "Lazer" },
  { id: "c5", name: "Saúde" },
];

function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatBRL(value: number) {
  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function addMonthsISO(dateISO: string, months: number) {
  // dateISO: YYYY-MM-DD
  const [y, m, d] = dateISO.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const baseDay = dt.getUTCDate();

  dt.setUTCMonth(dt.getUTCMonth() + months);

  // Ajusta caso o mês não tenha o dia (ex.: 31)
  // (Date vai "pular" para o mês seguinte; então forçamos o último dia do mês)
  if (dt.getUTCDate() !== baseDay) {
    dt.setUTCDate(0); // último dia do mês anterior
  }

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type TxType = "EXPENSE" | "INCOME";

type Recurrence = {
  enabled: boolean;
  frequency: "MONTHLY"; // mantemos simples no protótipo
  count: number; // número de meses (inclui o mês atual)
};

type Tx = {
  id: string;
  type: TxType;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  categoryId?: string;

  // NOVO: cartão de crédito
  isCreditCard?: boolean;
  cardLabel?: string;

  // NOVO: recorrência
  recurrence?: Recurrence;
  recurrenceGroupId?: string; // vincula os lançamentos gerados
};

const demoTransactions: Tx[] = [
  { id: "t1", type: "INCOME", amount: 6500, date: "2025-11-05", description: "Salário" },
  {
    id: "t2",
    type: "EXPENSE",
    amount: 1800,
    date: "2025-11-10",
    description: "Aluguel",
    categoryId: "c1",
    recurrence: { enabled: true, frequency: "MONTHLY", count: 12 },
    recurrenceGroupId: "rg_demo_aluguel",
  },
  { id: "t3", type: "EXPENSE", amount: 980, date: "2025-11-14", description: "Mercado", categoryId: "c2" },
  { id: "t4", type: "EXPENSE", amount: 240, date: "2025-11-18", description: "Gasolina", categoryId: "c3", isCreditCard: true, cardLabel: "Nubank" },
  { id: "t5", type: "EXPENSE", amount: 120, date: "2025-11-22", description: "Cinema", categoryId: "c4", isCreditCard: true, cardLabel: "Nubank" },

  { id: "t6", type: "INCOME", amount: 6500, date: "2025-12-05", description: "Salário" },
  { id: "t7", type: "EXPENSE", amount: 1800, date: "2025-12-10", description: "Aluguel", categoryId: "c1", recurrenceGroupId: "rg_demo_aluguel" },
  { id: "t8", type: "EXPENSE", amount: 1100, date: "2025-12-12", description: "Mercado", categoryId: "c2" },
  { id: "t9", type: "EXPENSE", amount: 310, date: "2025-12-16", description: "Uber", categoryId: "c3" },
  { id: "t10", type: "EXPENSE", amount: 220, date: "2025-12-21", description: "Farmácia", categoryId: "c5" },

  { id: "t11", type: "INCOME", amount: 6500, date: "2026-01-05", description: "Salário" },
  { id: "t12", type: "EXPENSE", amount: 1800, date: "2026-01-10", description: "Aluguel", categoryId: "c1", recurrenceGroupId: "rg_demo_aluguel" },
  { id: "t13", type: "EXPENSE", amount: 890, date: "2026-01-12", description: "Mercado", categoryId: "c2" },
  { id: "t14", type: "EXPENSE", amount: 190, date: "2026-01-17", description: "Lazer", categoryId: "c4" },
];

function Card({ title, subtitle, children, right }: any) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

function Pill({ children }: any) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-gray-700">
      {children}
    </span>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div className="space-y-1">
      {label ? <div className="text-xs text-gray-700">{label}</div> : null}
      <input
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
        {...props}
      />
    </div>
  );
}

function Select({ label, children, ...props }: any) {
  return (
    <div className="space-y-1">
      {label ? <div className="text-xs text-gray-700">{label}</div> : null}
      <select
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange, hint }: any) {
  return (
    <label className="flex items-start gap-2 rounded-2xl border p-3 bg-white">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-gray-500 mt-0.5">{hint}</div> : null}
      </div>
    </label>
  );
}

function Button({ variant = "primary", ...props }: any) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition active:scale-[0.99]";
  const styles =
    variant === "ghost"
      ? "border bg-white hover:bg-gray-50"
      : variant === "danger"
      ? "border bg-white text-red-600 hover:bg-red-50"
      : "border bg-black text-white hover:bg-black/90";
  return <button className={`${base} ${styles}`} {...props} />;
}

function EmptyState({ title, subtitle }: any) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-6 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-gray-600 mt-1">{subtitle}</div>
    </div>
  );
}

function Modal({ open, title, children, onClose }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border bg-white shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-sm font-semibold">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function buildStats(transactions: Tx[], categories: { id: string; name: string }[], month: string, categoryId: string) {
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  // 12 meses até o mês selecionado
  const rangeStart = new Date(start);
  rangeStart.setMonth(rangeStart.getMonth() - 11);

  const txInRange = transactions.filter((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    return d >= rangeStart && d < end;
  });

  // Linha mensal: receitas vs despesas
  const monthMap: Record<string, { month: string; income: number; expense: number }> = {};
  for (const t of txInRange) {
    const d = new Date(`${t.date}T00:00:00`);
    const k = monthKey(d);
    monthMap[k] ??= { month: k, income: 0, expense: 0 };
    if (t.type === "INCOME") monthMap[k].income += t.amount;
    else monthMap[k].expense += t.amount;
  }
  const monthlyLine = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  // Pizza por categoria (somente despesas no mês selecionado)
  const txThisMonth = transactions.filter((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    return d >= start && d < end && t.type === "EXPENSE";
  });
  const pieMap: Record<string, number> = {};
  for (const t of txThisMonth) {
    const name = categories.find((c) => c.id === t.categoryId)?.name ?? "Sem categoria";
    pieMap[name] = (pieMap[name] ?? 0) + t.amount;
  }
  const categoryPie = Object.entries(pieMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Barra: evolução de despesas por categoria (filtro opcional)
  const barMap: Record<string, { month: string; total: number }> = {};
  for (const t of txInRange) {
    if (t.type !== "EXPENSE") continue;
    if (categoryId && t.categoryId !== categoryId) continue;
    const d = new Date(`${t.date}T00:00:00`);
    const k = monthKey(d);
    barMap[k] ??= { month: k, total: 0 };
    barMap[k].total += t.amount;
  }
  const categoryMonthlyBar = Object.values(barMap).sort((a, b) => a.month.localeCompare(b.month));

  // Totais do mês selecionado
  const incomeThis = transactions
    .filter((t) => {
      const d = new Date(`${t.date}T00:00:00`);
      return d >= start && d < end && t.type === "INCOME";
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const expenseThis = txThisMonth.reduce((acc, t) => acc + t.amount, 0);

  return { monthlyLine, categoryPie, categoryMonthlyBar, incomeThis, expenseThis };
}

function ChartPlaceholder({ title }: any) {
  return (
    <div className="h-[260px] rounded-2xl border bg-gray-50 flex items-center justify-center">
      <div className="text-xs text-gray-500">{title}: sem dados</div>
    </div>
  );
}

function CategoryPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartPlaceholder title="Pizza" />;
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} />
          <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyLine({ data }: { data: { month: string; income: number; expense: number }[] }) {
  if (!data.length) return <ChartPlaceholder title="Linha" />;
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
          <Legend />
          <Line type="monotone" dataKey="income" name="Receitas" />
          <Line type="monotone" dataKey="expense" name="Despesas" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryMonthlyBar({ data }: { data: { month: string; total: number }[] }) {
  if (!data.length) return <ChartPlaceholder title="Barra" />;
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
          <Bar dataKey="total" name="Despesas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AuthScreen({ onLogin, onSignup }: any) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("eric@exemplo.com");
  const [password, setPassword] = useState("123456");
  const [name, setName] = useState("Eric");
  const [error, setError] = useState<string | null>(null);

  const title = mode === "login" ? "Entrar" : "Criar conta";
  const subtitle =
    mode === "login"
      ? "Preview do app (modo protótipo). No app real, isso usa banco + sessão."
      : "Cria usuário (simulado). No app real, isso cria no Postgres.";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white shadow-sm p-6 space-y-4">
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
        </div>

        {mode === "signup" ? <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} /> : null}

        <Input label="Email" value={email} type="email" onChange={(e: any) => setEmail(e.target.value)} />
        <Input label="Senha" value={password} type="password" onChange={(e: any) => setPassword(e.target.value)} />

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="flex gap-2">
          <Button
            onClick={() => {
              setError(null);
              if (!email || !password) {
                setError("Preencha email e senha");
                return;
              }
              if (mode === "login") onLogin({ email });
              else onSignup({ email, name });
            }}
          >
            {mode === "login" ? "Entrar" : "Criar"}
          </Button>
          <Button variant="ghost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Criar conta" : "Já tenho conta"}
          </Button>
        </div>

        <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
          <div>
            <b>Dica:</b> no protótipo, qualquer email/senha entra.
          </div>
          <div>Depois eu transformo isso no app real (NextAuth + Prisma + Vercel).</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ userEmail, onLogout }: any) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
const [transactions, setTransactions] = useState<Tx[]>([]);

const [loading, setLoading] = useState(false);

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro HTTP ${res.status}`);
  }

  return res.json();
}

async function loadCategories() {
  const data = await fetchJSON("/api/categories");
  setCategories(data);
}

async function loadTransactions() {
  // Monta a URL com filtros
  const params = new URLSearchParams();
  params.set("month", month);

  if (categoryId) params.set("categoryId", categoryId);
  if (filterCreditOnly) params.set("isCreditCard", "true");
  if (filterRecurringOnly) params.set("isRecurring", "true");

  const data = await fetchJSON(`/api/transactions?${params.toString()}`);

  // Ajuste: API vai retornar dates como ISO. Vamos converter para "YYYY-MM-DD"
  const normalized = (data ?? []).map((t: any) => ({
    ...t,
    date: String(t.date).slice(0, 10),
    amount: Number(t.amount),
  }));

  setTransactions(normalized);
}

  const [month, setMonth] = useState("2026-01");
  const [categoryId, setCategoryId] = useState<string>("");
  const [filterCreditOnly, setFilterCreditOnly] = useState(false);
  const [filterRecurringOnly, setFilterRecurringOnly] = useState(false);

  const [openTx, setOpenTx] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [openCats, setOpenCats] = useState(false);

  useEffect(() => {
  (async () => {
    try {
      setLoading(true);
      await loadCategories();
    } finally {
      setLoading(false);
    }
  })();
}, []);

useEffect(() => {
  (async () => {
    try {
      setLoading(true);
      await loadTransactions();
    } finally {
      setLoading(false);
    }
  })();
  // Recarrega quando mudar mês/filtros
}, [month, categoryId, filterCreditOnly, filterRecurringOnly]);

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro HTTP ${res.status}`);
  }

  return res.json();
}

async function loadCategories() {
  const data = await fetchJSON("/api/categories");
  setCategories(data);
}

async function loadTransactions() {
  const params = new URLSearchParams();
  params.set("month", month);

  if (categoryId) params.set("categoryId", categoryId);
  if (filterCreditOnly) params.set("isCreditCard", "true");
  if (filterRecurringOnly) params.set("isRecurring", "true");

  const data = await fetchJSON(`/api/transactions?${params.toString()}`);

  const normalized = (data ?? []).map((t: any) => ({
    ...t,
    // Prisma devolve date como ISO -> pegamos só YYYY-MM-DD
    date: String(t.date).slice(0, 10),
    amount: Number(t.amount),
  }));

  setTransactions(normalized);
}

useEffect(() => {
  // carrega categorias na primeira vez que abrir o Dashboard
  loadCategories().catch(console.error);
}, []);

useEffect(() => {
  // recarrega os lançamentos sempre que mudar mês/filtros
  loadTransactions().catch(console.error);
}, [month, categoryId, filterCreditOnly, filterRecurringOnly]);


  const stats = useMemo(() => buildStats(transactions, categories, month, categoryId), [transactions, categories, month, categoryId]);

  const monthStart = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [monthStart]);

  const txMonth = useMemo(() => {
    return transactions
      .filter((t) => {
        const d = new Date(`${t.date}T00:00:00`);
        return d >= monthStart && d < monthEnd;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, monthStart, monthEnd]);

  const filteredTxMonth = useMemo(() => {
    return txMonth
      .filter((t) => {
        // filtros "de despesas": por natureza, eles só fazem sentido para despesas.
        // Então, se o usuário ligar cartão/recorrência, receitas não passam pelo filtro.

        if (filterCreditOnly && !t.isCreditCard) return false;

        const isRecurring = Boolean(t.recurrenceGroupId || t.recurrence?.enabled);
        if (filterRecurringOnly && !isRecurring) return false;

        if (categoryId) {
          // categoria só se aplica a despesas
          if (t.type !== "EXPENSE") return false;
          return t.categoryId === categoryId;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txMonth, categoryId, filterCreditOnly, filterRecurringOnly]);

  const balance = stats.incomeThis - stats.expenseThis;

  function openCreate() {
    setEditingId(null);
    setOpenTx(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setOpenTx(true);
  }

  function upsertManyTx(txs: Tx[]) {
    setTransactions((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      for (const t of txs) map.set(t.id, t);
      return Array.from(map.values());
    });
  }

 async function removeTx(id: string) {
  await fetchJSON(`/api/transactions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadTransactions();
}

  async function removeSeries(groupId: string) {
  await fetchJSON(`/api/transactions?groupId=${encodeURIComponent(groupId)}`, { method: "DELETE" });
  await loadTransactions();
}

  async function addCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  await fetchJSON("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name: trimmed }),
  });

  await loadCategories();
}
  async function removeCategory(categoryIdToRemove: string) {
  await fetchJSON(`/api/categories?id=${encodeURIComponent(categoryIdToRemove)}`, {
    method: "DELETE",
  });

  // Recarrega categorias e transações do mês atual
  await loadCategories();
  await loadTransactions();

  // Se estava filtrando por essa categoria, limpa o filtro
  setCategoryId((prev) => (prev === categoryIdToRemove ? "" : prev));
}


  const editing = useMemo(() => (editingId ? transactions.find((t) => t.id === editingId) : null), [editingId, transactions]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold">Controle Financeiro</div>
            <div className="text-sm text-gray-600 mt-1">
              Usuário: <span className="font-medium">{userEmail}</span> · <Pill>Preview</Pill>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setOpenCats(true)}>
              Categorias
            </Button>
            <Button variant="ghost" onClick={onLogout}>
              Sair
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            title="Mês"
            subtitle="Escolha o mês para atualizar os gráficos e a lista"
            right={
              <input
                className="rounded-xl border px-3 py-2 text-sm"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            }
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border p-3 bg-gray-50">
                <div className="text-xs text-gray-600">Receitas</div>
                <div className="text-sm font-semibold mt-1">{formatBRL(stats.incomeThis)}</div>
              </div>
              <div className="rounded-2xl border p-3 bg-gray-50">
                <div className="text-xs text-gray-600">Despesas</div>
                <div className="text-sm font-semibold mt-1">{formatBRL(stats.expenseThis)}</div>
              </div>
              <div className="rounded-2xl border p-3 bg-gray-50">
                <div className="text-xs text-gray-600">Saldo</div>
                <div className={`text-sm font-semibold mt-1 ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatBRL(balance)}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Despesas por categoria" subtitle="Pizza do mês selecionado">
            <CategoryPie data={stats.categoryPie} />
          </Card>

          <Card title="Receitas vs Despesas" subtitle="Comparativo dos últimos 12 meses">
            <MonthlyLine data={stats.monthlyLine} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card
              title="Lançamentos do mês"
              subtitle="Cadastre receitas/despesas, cartão e recorrência"
              right={<Button onClick={openCreate}>+ Adicionar</Button>}
            >
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 w-full sm:max-w-md">
                  <Select label="Filtro por categoria" value={categoryId} onChange={(e: any) => setCategoryId(e.target.value)}>
                    <option value="">Todas</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-700">Resumo</div>
                    <div className="rounded-xl border px-3 py-2 text-sm bg-gray-50">
                      {filteredTxMonth.length} lançamento(s)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterCreditOnly}
                      onChange={(e) => setFilterCreditOnly(e.target.checked)}
                    />
                    Somente cartão
                  </label>

                  <label className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterRecurringOnly}
                      onChange={(e) => setFilterRecurringOnly(e.target.checked)}
                    />
                    Somente recorrentes
                  </label>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCategoryId("");
                      setFilterCreditOnly(false);
                      setFilterRecurringOnly(false);
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                {filteredTxMonth.length === 0 ? (
                  <EmptyState title="Sem lançamentos" subtitle="Adicione receitas/despesas para ver gráficos e comparativos." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-600">
                        <tr>
                          <th className="text-left p-3">Data</th>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-left p-3">Categoria</th>
                          <th className="text-left p-3">Detalhes</th>
                          <th className="text-right p-3">Tipo</th>
                          <th className="text-right p-3">Valor</th>
                          <th className="text-right p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTxMonth.map((t) => {
                            const cat = categories.find((c) => c.id === t.categoryId)?.name ?? "Sem categoria";
                            const isRecurring = Boolean(t.recurrenceGroupId || t.recurrence?.enabled);
                            return (
                              <tr key={t.id} className="border-t hover:bg-gray-50">
                                <td className="p-3 whitespace-nowrap">{t.date}</td>
                                <td className="p-3">{t.description || "(sem descrição)"}</td>
                                <td className="p-3">{t.type === "INCOME" ? "—" : cat}</td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {t.isCreditCard ? <Pill>Cartão{t.cardLabel ? `: ${t.cardLabel}` : ""}</Pill> : null}
                                    {isRecurring ? <Pill>Recorrente</Pill> : null}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <Pill>{t.type === "INCOME" ? "Receita" : "Despesa"}</Pill>
                                </td>
                                <td
                                  className={`p-3 text-right font-semibold ${
                                    t.type === "INCOME" ? "text-emerald-600" : "text-red-600"
                                  }`}
                                >
                                  {formatBRL(t.amount)}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="inline-flex flex-wrap justify-end gap-2">
                                    <Button variant="ghost" onClick={() => openEdit(t.id)}>
                                      Editar
                                    </Button>
                                    {t.recurrenceGroupId ? (
                                      <Button variant="danger" onClick={() => removeSeries(t.recurrenceGroupId!)}>
                                        Remover série
                                      </Button>
                                    ) : (
                                      <Button variant="danger" onClick={() => removeTx(t.id)}>
                                        Remover
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card title="Evolução de despesas" subtitle="Barra mensal (filtra por categoria se quiser)">
            <CategoryMonthlyBar data={stats.categoryMonthlyBar} />
            <div className="mt-3 text-xs text-gray-500">
              No app real, esse gráfico vem de uma API <code className="px-1 rounded bg-white border">/api/stats</code> consultando o Postgres.
            </div>
          </Card>
        </div>
      </div>

      <TransactionModal
        open={openTx}
        onClose={() => setOpenTx(false)}
        categories={categories}
        editing={editing}
       onSaveMany={async (txs: Tx[]) => {
  // No app real, em vez de “upsert local”, chamamos o backend para criar
  // (no modal, quando é novo + recorrência, ele cria vários txs – mas aqui vamos mandar apenas o “base”)
  // Para simplificar: vamos mandar o primeiro tx como base e deixar o backend gerar a recorrência.
  const t = txs[0];

  await fetchJSON("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      type: t.type,
      amount: t.amount,
      date: t.date,
      description: t.description ?? "",
      categoryId: t.categoryId ?? "",
      isCreditCard: Boolean(t.isCreditCard),
      cardLabel: t.cardLabel ?? "",
      isRecurring: Boolean(t.recurrenceGroupId || t.recurrence?.enabled),
      recurrenceCount: t.recurrence?.count ?? 1,
    }),
  });

  setOpenTx(false);
  await loadTransactions();
}}
      />

      <CategoryModal
        open={openCats}
        onClose={() => setOpenCats(false)}
        categories={categories}
        onAdd={addCategory}
        onRemove={removeCategory}
      />
    </div>
  );
}

function CategoryModal({ open, onClose, categories, onAdd, onRemove }: any) {
  const [name, setName] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  return (
    <Modal open={open} title="Categorias" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl border bg-gray-50 p-3">
          <div className="text-xs text-gray-600">
            Aqui você pode <b>adicionar</b> ou <b>remover</b> categorias.
            <br />
            Se remover uma categoria, os lançamentos ligados a ela ficam como <b>Sem categoria</b>.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <Input label="Nova categoria" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Ex.: Educação" />
          </div>
          <div className="sm:col-span-1 flex items-end">
            <Button
              className="w-full"
              onClick={() => {
                onAdd(name);
                setName("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="text-left p-3">Categoria</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c: any) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3 text-right">
                    <Button variant="danger" onClick={() => onRemove(c.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function TransactionModal({ open, onClose, categories, editing, onSaveMany }: any) {
  const isEdit = Boolean(editing);

  const [type, setType] = useState<TxType>(editing?.type ?? "EXPENSE");
  const [amount, setAmount] = useState<number>(editing?.amount ?? 100);
  const [date, setDate] = useState<string>(editing?.date ?? "2026-01-06");
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? categories[0]?.id ?? "");

  // Cartão de crédito
  const [isCreditCard, setIsCreditCard] = useState<boolean>(Boolean(editing?.isCreditCard));
  const [cardLabel, setCardLabel] = useState<string>(editing?.cardLabel ?? "");

  // Recorrência
  const [isRecurring, setIsRecurring] = useState<boolean>(Boolean(editing?.recurrence?.enabled));
  const [recurrenceCount, setRecurrenceCount] = useState<number>(editing?.recurrence?.count ?? 12);

  React.useEffect(() => {
    if (!open) return;
    setType(editing?.type ?? "EXPENSE");
    setAmount(editing?.amount ?? 100);
    setDate(editing?.date ?? "2026-01-06");
    setDescription(editing?.description ?? "");
    setCategoryId(editing?.categoryId ?? categories[0]?.id ?? "");

    setIsCreditCard(Boolean(editing?.isCreditCard));
    setCardLabel(editing?.cardLabel ?? "");

    setIsRecurring(Boolean(editing?.recurrence?.enabled));
    setRecurrenceCount(editing?.recurrence?.count ?? 12);
  }, [open, editing, categories]);

  const recurrenceDisabledByEdit = isEdit && Boolean(editing?.recurrenceGroupId);

  return (
    <Modal open={open} title={isEdit ? "Editar lançamento" : "Novo lançamento"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Tipo" value={type} onChange={(e: any) => setType(e.target.value)}>
          <option value="EXPENSE">Despesa</option>
          <option value="INCOME">Receita</option>
        </Select>

        <Input
          label="Valor (R$)"
          type="number"
          min={0}
          step={0.01}
          value={amount}
          onChange={(e: any) => setAmount(Number(e.target.value))}
        />

        <Input label="Data" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />

        <Input
          label="Descrição"
          value={description}
          onChange={(e: any) => setDescription(e.target.value)}
          placeholder="Ex.: Mercado, Aluguel..."
        />

        <div className="sm:col-span-2">
          <Select
            label="Categoria (apenas para despesas)"
            value={categoryId}
            onChange={(e: any) => setCategoryId(e.target.value)}
            disabled={type === "INCOME"}
          >
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {type === "INCOME" ? <div className="text-xs text-gray-500 mt-1">Receitas normalmente não precisam de categoria.</div> : null}
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
          <Checkbox
            label="Pagamento no cartão de crédito"
            checked={isCreditCard}
            onChange={(v: boolean) => setIsCreditCard(v)}
            hint="Ex.: compras, apps, etc."
          />

          <Checkbox
            label="Pagamento recorrente"
            checked={isRecurring}
            onChange={(v: boolean) => setIsRecurring(v)}
            hint="Ex.: aluguel (12 meses), streaming, academia…"
          />
        </div>

        {isCreditCard ? (
          <div className="sm:col-span-2">
            <Input
              label="Cartão (opcional)"
              value={cardLabel}
              onChange={(e: any) => setCardLabel(e.target.value)}
              placeholder="Ex.: Nubank, Inter, Itaú…"
            />
          </div>
        ) : null}

        {isRecurring ? (
          <div className="sm:col-span-2 rounded-2xl border bg-gray-50 p-3">
            <div className="text-sm font-semibold">Recorrência</div>
            {recurrenceDisabledByEdit ? (
              <div className="text-xs text-gray-600 mt-1">
                Este lançamento faz parte de uma <b>série já criada</b>. No protótipo, a edição da série não está disponível.
                <br />
                (No app real, teremos uma tela de “Recorrências” para editar/pausar.)
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <Select label="Frequência" value="MONTHLY" onChange={() => {}} disabled>
                  <option value="MONTHLY">Mensal</option>
                </Select>

                <Input
                  label="Por quantos meses?"
                  type="number"
                  min={1}
                  max={120}
                  value={recurrenceCount}
                  onChange={(e: any) => setRecurrenceCount(Number(e.target.value))}
                />

                <div className="sm:col-span-2 text-xs text-gray-600">
                  Serão gerados {Math.max(1, Number(recurrenceCount) || 1)} lançamentos (inclui o mês desta data).
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            const baseAmount = Math.max(0, Number(amount) || 0);

            if (isEdit) {
              // edição simples do item atual
              const updated: Tx = {
                ...editing,
                type,
                amount: baseAmount,
                date,
                description: description?.trim() || undefined,
                categoryId: type === "EXPENSE" ? categoryId : undefined,
                isCreditCard: Boolean(isCreditCard),
                cardLabel: isCreditCard ? (cardLabel?.trim() || undefined) : undefined,
                // recorrência na edição só marca no item (não mexe na série)
                recurrence: isRecurring ? { enabled: true, frequency: "MONTHLY", count: Math.max(1, Number(recurrenceCount) || 1) } : undefined,
              };
              onSaveMany([updated]);
              return;
            }

            // criação
            const count = Math.max(1, Number(recurrenceCount) || 1);
            const groupId = isRecurring ? uid("rg") : undefined;

            const baseTx: Tx = {
              id: uid("t"),
              type,
              amount: baseAmount,
              date,
              description: description?.trim() || undefined,
              categoryId: type === "EXPENSE" ? categoryId : undefined,
              isCreditCard: Boolean(isCreditCard),
              cardLabel: isCreditCard ? (cardLabel?.trim() || undefined) : undefined,
              recurrence: isRecurring ? { enabled: true, frequency: "MONTHLY", count } : undefined,
              recurrenceGroupId: groupId,
            };

            if (!isRecurring) {
              onSaveMany([baseTx]);
              return;
            }

            // gera lançamentos mensais
            const series: Tx[] = [];
            for (let i = 0; i < count; i++) {
              series.push({
                ...baseTx,
                id: uid("t"),
                date: addMonthsISO(date, i),
                // deixa a descrição igual para facilitar (ex.: Aluguel)
              });
            }

            onSaveMany(series);
          }}
        >
          Salvar
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border bg-gray-50 p-3 text-xs text-gray-600">
        <div className="font-semibold text-gray-800">Como isso vira o app real</div>
        <div className="mt-1">
          No Next.js, isso vira campos no banco (Prisma) e endpoints:
          <div className="mt-1 flex flex-wrap gap-2">
            <code className="px-1 rounded bg-white border">/api/categories</code>
            <code className="px-1 rounded bg-white border">/api/transactions</code>
            <code className="px-1 rounded bg-white border">/api/recurrences</code>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function FinanceApp() {
  const [user, setUser] = useState<{ email: string } | null>(null);

  if (!user) {
    return (
      <AuthScreen
        onLogin={({ email }: any) => setUser({ email })}
        onSignup={({ email }: any) => setUser({ email })}
      />
    );
  }

  return <Dashboard userEmail={user.email} onLogout={() => setUser(null)} />;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Truck,
  Clock,
  MoreVertical,
  Plus,
  Filter,
  Search,
  Bell,
  Settings,
  Users,
  ChevronDown,
  AlertCircle,
  User,
  FileText,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ClipboardList,
  X,
} from "lucide-react";
import { supabase } from "../supabase";

const STATUS_OPTIONS = [
  "agendada",
  "em andamento",
  "verificada",
  "coletada",
  "reagendada",
  "sem retorno",
  "cancelada",
] as const;

const FINAL_STATUS = new Set(["coletada", "sem retorno", "cancelada"]);

type StatusType = (typeof STATUS_OPTIONS)[number];

type SessionUser = {
  id: string;
  usuario: string;
  nome: string;
  tipo: "admin" | "user";
  criado_em?: string;
};

type Coleta = {
  id: string;
  transportadora: string;
  ticket: string;
  data_prevista: string;
  obs: string | null;
  status: StatusType;
  criado_por_id: string;
  criado_por_nome: string;
  criado_em?: string;
  ultima_analise_em: string | null;
  ultima_analise_por?: string | null;
  ultima_analise_por_nome: string | null;
  observacao_analise: string | null;
};

type Usuario = {
  id: string;
  usuario: string;
  nome: string;
  tipo: "admin" | "user";
  criado_em?: string;
};

const EMPTY_FORM = {
  transportadora: "",
  ticket: "",
  data_prevista: "",
  obs: "",
  status: "agendada" as StatusType,
};

const EMPTY_ANALYSIS = {
  status: "verificada" as StatusType,
  observacao_analise: "",
};

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return value;
  }
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function toDatetimeLocal(dateValue?: string | null) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function isLateColeta(coleta: Coleta, currentTime: number) {
  const due = new Date(coleta.data_prevista).getTime();
  return due <= currentTime && !FINAL_STATUS.has(coleta.status);
}

function getOpenCount(coletas: Coleta[]) {
  return coletas.filter((item) => !FINAL_STATUS.has(item.status)).length;
}

function getLateCount(coletas: Coleta[], currentTime: number) {
  return coletas.filter((item) => isLateColeta(item, currentTime)).length;
}

function getColumnStyle(status: StatusType) {
  switch (status) {
    case "agendada":
      return {
        title: "Agendada",
        color: "bg-blue-400",
        borderColor: "border-blue-400",
      };
    case "em andamento":
      return {
        title: "Em andamento",
        color: "bg-yellow-400",
        borderColor: "border-yellow-400",
      };
    case "verificada":
      return {
        title: "Verificada",
        color: "bg-cyan-400",
        borderColor: "border-cyan-400",
      };
    case "coletada":
      return {
        title: "Coletada",
        color: "bg-green-500",
        borderColor: "border-green-500",
      };
    case "reagendada":
      return {
        title: "Reagendada",
        color: "bg-orange-400",
        borderColor: "border-orange-400",
      };
    case "sem retorno":
      return {
        title: "Sem retorno",
        color: "bg-purple-400",
        borderColor: "border-purple-400",
      };
    case "cancelada":
      return {
        title: "Cancelada",
        color: "bg-slate-400",
        borderColor: "border-slate-400",
      };
    default:
      return {
        title: status,
        color: "bg-slate-400",
        borderColor: "border-slate-400",
      };
  }
}

function badgeClass(status: string, late: boolean) {
  const normalized = status.toLowerCase();

  if (normalized === "coletada" || normalized === "finalizada") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (normalized === "cancelada" || normalized === "cancelado") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  if (normalized === "sem retorno") {
    return "bg-purple-100 text-purple-700 border-purple-200";
  }

  if (normalized === "reagendada") {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  if (late) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (normalized === "verificada") {
    return "bg-cyan-100 text-cyan-700 border-cyan-200";
  }

  return "bg-blue-100 text-blue-700 border-blue-200";
}

export default function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => {
    const raw = localStorage.getItem("coletas_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [loadingApp, setLoadingApp] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    usuario: "",
    senha: "",
    confirmarSenha: "",
  });
const notifiedIdsRef = useRef<Set<string>>(new Set());
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showAdminSummary, setShowAdminSummary] = useState(false);
const [selectedUserId, setSelectedUserId] = useState("all");
const [showFilters, setShowFilters] = useState(false);
const [now, setNow] = useState(Date.now());
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [coletaForm, setColetaForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingColeta, setSavingColeta] = useState(false);
  const [showColetaModal, setShowColetaModal] = useState(false);

  const [analysisTarget, setAnalysisTarget] = useState<Coleta | null>(null);
  const [analysisForm, setAnalysisForm] = useState(EMPTY_ANALYSIS);
  const [savingAnalysis, setSavingAnalysis] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepAtRef = useRef(0);

  const isAdmin = sessionUser?.tipo === "admin";

const userFilteredColetas = useMemo(() => {
  if (!isAdmin || selectedUserId === "all") return coletas;
  return coletas.filter((item) => item.criado_por_id === selectedUserId);
}, [coletas, isAdmin, selectedUserId]);

const filteredColetas = useMemo(() => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return userFilteredColetas;

  return userFilteredColetas.filter((item) => {
    const haystack = [
      item.transportadora,
      item.ticket,
      item.obs || "",
      item.criado_por_nome || "",
      item.ultima_analise_por_nome || "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}, [userFilteredColetas, searchTerm]);

const dueColetas = useMemo(() => {
  return filteredColetas.filter((item) => isLateColeta(item, now));
}, [filteredColetas, now]);

  const groupedByUser = useMemo(() => {
    const map = new Map<string, { userId: string; nome: string; usuario: string; items: Coleta[] }>();

    for (const coleta of coletas) {
      const key = coleta.criado_por_id;
      if (!map.has(key)) {
        const owner = users.find((u) => u.id === key);
        map.set(key, {
          userId: coleta.criado_por_id,
          nome: coleta.criado_por_nome || owner?.nome || owner?.usuario || "Sem nome",
          usuario: owner?.usuario || "",
          items: [],
        });
      }
      map.get(key)!.items.push(coleta);
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      abertas: getOpenCount(group.items),
      atrasadas: getLateCount(group.items, now),
    }));
  }, [coletas, users, now]);

  const columns = useMemo(() => {
    return STATUS_OPTIONS.map((status) => {
      const style = getColumnStyle(status);
      const tasks = filteredColetas.filter((item) => item.status === status);

      return {
        id: status,
        title: style.title,
        color: style.color,
        borderColor: style.borderColor,
        tasks,
      };
    });
  }, [filteredColetas]);

  useEffect(() => {
    if (sessionUser?.id) {
      refreshData();
    } else {
      setColetas([]);
      setUsers([]);
    }
  }, [sessionUser?.id]);

useEffect(() => {
  function handleStorage(event: StorageEvent) {
    if (!event.key) return;

    if (event.key.startsWith("coleta_notified_") && event.newValue) {
      const id = event.key.replace("coleta_notified_", "");
      notifiedIdsRef.current.add(id);
    }
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}, []);


useEffect(() => {
  if (!sessionUser?.id) return;
  requestNotificationPermission();
}, [sessionUser?.id]);

useEffect(() => {
  const interval = setInterval(() => {
    setNow(Date.now());
  }, 10000); // atualiza a cada 10 segundos

  return () => clearInterval(interval);
}, []);

  useEffect(() => {
  if (dueColetas.length === 0) return;

  notifyDueColetasBrowser(dueColetas);

  const interval = setInterval(() => {
    const now = Date.now();
    if (now - lastBeepAtRef.current < 4500) return;
    playBeep();
    lastBeepAtRef.current = now;
  }, 5000);

  const now = Date.now();
  if (now - lastBeepAtRef.current > 4500) {
    playBeep();
    lastBeepAtRef.current = now;
  }

  return () => clearInterval(interval);
}, [dueColetas]);

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.35);
    } catch (error) {
      console.error("Erro ao tocar alerta:", error);
    }
  }

function notifyDueColetasBrowser(items: Coleta[]) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  items.forEach((item) => {
    if (notifiedIdsRef.current.has(item.id)) return;

    const storageKey = `coleta_notified_${item.id}`;
    const alreadyNotified = localStorage.getItem(storageKey);

    if (alreadyNotified) {
      notifiedIdsRef.current.add(item.id);
      return;
    }

    const notification = new Notification("Coleta vencida", {
      body: `${item.transportadora} • Ticket ${item.ticket} está aguardando análise.`,
      tag: `coleta-${item.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    notifiedIdsRef.current.add(item.id);
    localStorage.setItem(storageKey, String(Date.now()));
  });
}

  async function refreshData() {
    if (!sessionUser?.id) return;

    setLoadingApp(true);

    let coletasQuery = supabase
      .from("coletas")
      .select("*")
      .order("data_prevista", { ascending: true });

    if (sessionUser.tipo !== "admin") {
      coletasQuery = coletasQuery.eq("criado_por_id", sessionUser.id);
    }

    const coletasResult = await coletasQuery;

    if (coletasResult.error) {
      console.error("Erro ao carregar coletas:", coletasResult.error);
      setColetas([]);
    } else {
      setColetas((coletasResult.data as Coleta[]) || []);
    }

    if (sessionUser.tipo === "admin") {
      const usersResult = await supabase
        .from("usuarios")
        .select("id, usuario, nome, tipo, criado_em")
        .order("nome", { ascending: true });

      if (usersResult.error) {
        console.error("Erro ao carregar usuários:", usersResult.error);
        setUsers([]);
      } else {
        setUsers((usersResult.data as Usuario[]) || []);
      }
    } else {
      setUsers([sessionUser]);
    }

    setLoadingApp(false);
  }

  function handleAuthInput(field: "usuario" | "senha" | "confirmarSenha", value: string) {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const usuario = authForm.usuario.trim();
    const senha = authForm.senha;

    if (!usuario || !senha) {
      setAuthError("Preencha usuário e senha.");
      return;
    }

    const { data, error } = await supabase.rpc("login_user", {
      p_usuario: normalizeUsername(usuario),
      p_senha: senha,
    });

    if (error) {
      setAuthError(error.message || "Usuário ou senha inválidos.");
      return;
    }

    setSessionUser(data as SessionUser);
    localStorage.setItem("coletas_user", JSON.stringify(data));
    setAuthForm({
      usuario: "",
      senha: "",
      confirmarSenha: "",
    });
  }

async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const usuarioDigitado = authForm.usuario.trim();
    const usuario = normalizeUsername(usuarioDigitado);
    const senha = authForm.senha;
    const confirmarSenha = authForm.confirmarSenha;

    if (!usuarioDigitado || !senha || !confirmarSenha) {
      setAuthError("Preencha todos os campos.");
      return;
    }

    if (usuario.length < 3) {
      setAuthError("O usuário precisa ter pelo menos 3 caracteres.");
      return;
    }

    if (senha.length < 6) {
      setAuthError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setAuthError("As senhas não coincidem.");
      return;
    }

    const { error } = await supabase.rpc("register_user", {
      p_usuario: usuario,
      p_nome: usuarioDigitado,
      p_senha: senha,
    });

    if (error) {
      setAuthError(error.message || "Não foi possível cadastrar.");
      return;
    }

    setAuthMessage("Usuário cadastrado com sucesso.");
    setAuthMode("login");
    setAuthForm({
      usuario: "",
      senha: "",
      confirmarSenha: "",
    });
  }

  function handleLogout() {
    setSessionUser(null);
    setColetas([]);
    setUsers([]);
    setColetaForm(EMPTY_FORM);
    setEditingId(null);
    setAnalysisTarget(null);
    localStorage.removeItem("coletas_user");
  }

  function handleColetaInput(field: keyof typeof EMPTY_FORM, value: string) {
    setColetaForm((prev) => ({ ...prev, [field]: value as any }));
  }

  function openCreateModal(status?: StatusType) {
    setEditingId(null);
    setColetaForm({
      ...EMPTY_FORM,
      status: status || "agendada",
    });
    setShowColetaModal(true);
  }

  async function handleSaveColeta(e: React.FormEvent) {
    e.preventDefault();

    if (!sessionUser?.id) {
      alert("Sessão inválida. Entre novamente.");
      return;
    }

    const transportadora = coletaForm.transportadora.trim();
    const ticket = coletaForm.ticket.trim();
    const dataPrevista = coletaForm.data_prevista;
    const obs = coletaForm.obs.trim();

    if (!transportadora || !ticket || !dataPrevista) {
      alert("Preencha transportadora, ticket e data prevista.");
      return;
    }

    const dataISO = new Date(dataPrevista);
    if (Number.isNaN(dataISO.getTime())) {
      alert("Data prevista inválida.");
      return;
    }

    setSavingColeta(true);

    const payload = {
      transportadora,
      ticket,
      data_prevista: dataISO.toISOString(),
      obs: obs || null,
      status: coletaForm.status,
      criado_por_id: sessionUser.id,
      criado_por_nome: sessionUser.nome || sessionUser.usuario,
    };

    let result;

    if (editingId) {
      result = await supabase.from("coletas").update(payload).eq("id", editingId).select();
    } else {
      result = await supabase.from("coletas").insert(payload).select();
    }

    setSavingColeta(false);

    if (result.error) {
      console.error("Erro ao salvar coleta:", result.error);
      alert(`Erro ao salvar coleta: ${result.error.message}`);
      return;
    }

    setColetaForm(EMPTY_FORM);
    setEditingId(null);
    setShowColetaModal(false);
    if (editingId) {
  localStorage.removeItem(`coleta_notified_${editingId}`);
  notifiedIdsRef.current.delete(editingId);
} 
    await refreshData();
  }

  function handleEditColeta(coleta: Coleta) {
    setEditingId(coleta.id);
    setColetaForm({
      transportadora: coleta.transportadora || "",
      ticket: coleta.ticket || "",
      data_prevista: toDatetimeLocal(coleta.data_prevista),
      obs: coleta.obs || "",
      status: coleta.status || "agendada",
    });
    setShowColetaModal(true);
  }

  function openAnalysisModal(coleta: Coleta) {
    setAnalysisTarget(coleta);
    setAnalysisForm({
      status: coleta.status === "agendada" ? "verificada" : coleta.status,
      observacao_analise: coleta.observacao_analise || "",
    });
  }

  async function handleSaveAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!analysisTarget || !sessionUser?.id) return;

    setSavingAnalysis(true);

    const result = await supabase
      .from("coletas")
      .update({
        status: analysisForm.status,
        observacao_analise: analysisForm.observacao_analise.trim() || null,
        ultima_analise_em: new Date().toISOString(),
        ultima_analise_por: sessionUser.id,
        ultima_analise_por_nome: sessionUser.nome || sessionUser.usuario,
      })
      .eq("id", analysisTarget.id);

    setSavingAnalysis(false);

    if (result.error) {
      alert(result.error.message || "Erro ao registrar análise.");
      return;
    }

    setAnalysisTarget(null);
    setAnalysisForm(EMPTY_ANALYSIS);
    localStorage.removeItem(`coleta_notified_${analysisTarget.id}`);
     notifiedIdsRef.current.delete(analysisTarget.id);
    await refreshData();
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <Card className="w-full max-w-md border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Sistema de Coletas</CardTitle>
            <p className="text-sm text-slate-500">Uso interno do setor</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={authMode === "login" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Entrar
              </Button>
              <Button
                type="button"
                variant={authMode === "register" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Cadastrar
              </Button>
            </div>

            <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <input
                  type="text"
                  value={authForm.usuario}
                  onChange={(e) => handleAuthInput("usuario", e.target.value)}
                  placeholder="Digite seu usuário"
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Senha</label>
                <input
                  type="password"
                  value={authForm.senha}
                  onChange={(e) => handleAuthInput("senha", e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                />
              </div>

              {authMode === "register" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmar senha</label>
                  <input
                    type="password"
                    value={authForm.confirmarSenha}
                    onChange={(e) => handleAuthInput("confirmarSenha", e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                  />
                </div>
              )}

              {authError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {authMessage}
                </div>
              )}

              <Button type="submit" className="w-full">
                {authMode === "login" ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-16 bg-slate-800 flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-orange-500"></div>
        </div>

        <nav className="flex-1 flex flex-col gap-4">
          <button className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
            <Truck className="w-5 h-5 text-slate-400" />
          </button>
          {isAdmin && (
            <button className="w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </nav>

        <div className="flex flex-col gap-4">
          <button className="w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
            <Bell className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {dueColetas.length > 0 && (
          <div className="bg-red-600 text-white px-6 py-3 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            🚨 ALERTA URGENTE: existem {dueColetas.length} coleta(s) vencida(s) aguardando análise.
          </div>
        )}

        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-800">Logística Reversa</h1>
            <Button variant="ghost" size="sm">
              <ChevronDown className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-500">
              {sessionUser.nome || sessionUser.usuario} · {isAdmin ? "Administrador" : "Usuário"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar coletas por ticket ou transportadora..."
                className="h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
              />
            </div>

  <Button
  variant={showFilters ? "default" : "outline"}
  size="sm"
  onClick={() => setShowFilters((prev) => !prev)}
>
  <Filter className="w-4 h-4" />
  Filtros
</Button>

            {isAdmin && (
  <Button
    variant={showAdminSummary ? "default" : "outline"}
    size="sm"
    onClick={() => setShowAdminSummary((prev) => !prev)}
  >
    <Users className="w-4 h-4" />
    {users.length}
  </Button>
)}

            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>

            <Button size="sm" onClick={() => openCreateModal()}>
              <Plus className="w-4 h-4" />
              Nova coleta
            </Button>

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </header>

	{isAdmin && showFilters && (
  <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
    <label className="text-sm font-medium text-slate-600">Filtrar por usuário</label>

    <select
      value={selectedUserId}
      onChange={(e) => setSelectedUserId(e.target.value)}
      className="h-10 min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
    >
      <option value="all">Todos os usuários</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.nome || user.usuario}
        </option>
      ))}
    </select>

    {selectedUserId !== "all" && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSelectedUserId("all")}
      >
        Limpar filtro
      </Button>
    )}
  </div>
)}

        {loadingApp ? (
          <main className="flex-1 grid place-items-center">
            <div className="text-slate-500">Carregando dados...</div>
          </main>
        ) : (
          <main className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="h-full flex gap-4 p-6">
              {columns.map((column) => (
                <div key={column.id} className="flex-shrink-0 w-80 flex flex-col">
                  <div className={`${column.color} rounded-t-lg px-4 py-3 border-t-4 ${column.borderColor}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-800">{column.title}</h2>
                      <Badge variant="secondary" className="bg-white/50 text-slate-700 border-0">
                        {column.tasks.length}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-100 rounded-b-lg p-3 overflow-y-auto space-y-3">
                    {column.tasks.map((task) => {
                      const late = isLateColeta(task, now);

                      return (
                        <Card
                          key={task.id}
                          className={`bg-white hover:shadow-md transition-shadow ${
                            late ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"
                          }`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Truck className="w-4 h-4 text-slate-500" />
                                  <CardTitle className="text-sm font-semibold text-slate-800">
                                    {task.transportadora}
                                  </CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs font-mono text-slate-600">{task.ticket}</span>
                                </div>
                              </div>

                              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2">
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                              </Button>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3 pt-0">
                            <div
                              className={`flex items-center gap-2 text-xs font-medium rounded-md p-2 ${
                                late ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700"
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatDate(task.data_prevista)}</span>
                              <span className="mx-1">•</span>
                              <span>{formatTime(task.data_prevista)}</span>
                              {late && (
                                <>
                                  <span className="mx-1">•</span>
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Atrasada</span>
                                </>
                              )}
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-md p-2">
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {task.obs || "Sem observações registradas."}
                              </p>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge className={`${badgeClass(task.status, late)} text-xs font-medium`}>
                                {(task.status === "coletada" || task.status === "cancelada") && (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                {task.status}
                              </Badge>
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium">Registrado por:</span>
                                <span>{task.criado_por_nome}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium">Última análise:</span>
                                <span>{formatDateTime(task.ultima_analise_em)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleEditColeta(task)}
                              >
                                Editar
                              </Button>
                              <Button size="sm" className="flex-1" onClick={() => openAnalysisModal(task)}>
                                Analisar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Button
                      variant="ghost"
                      className="w-full justify-start text-slate-600 hover:text-slate-800 hover:bg-white/50"
                      onClick={() => openCreateModal(column.id as StatusType)}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar coleta
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
      </div>

      {showColetaModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? "Editar coleta" : "Nova coleta"}</h2>
                <p className="text-sm text-slate-500">Preencha os dados da coleta</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowColetaModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveColeta} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Transportadora</label>
                  <input
                    type="text"
                    value={coletaForm.transportadora}
                    onChange={(e) => handleColetaInput("transportadora", e.target.value)}
                    placeholder="Ex.: Jadlog"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ticket</label>
                  <input
                    type="text"
                    value={coletaForm.ticket}
                    onChange={(e) => handleColetaInput("ticket", e.target.value)}
                    placeholder="Número do ticket"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data e horário previstos</label>
                  <input
                    type="datetime-local"
                    value={coletaForm.data_prevista}
                    onChange={(e) => handleColetaInput("data_prevista", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={coletaForm.status}
                    onChange={(e) => handleColetaInput("status", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações</label>
                <textarea
                  rows={4}
                  value={coletaForm.obs}
                  onChange={(e) => handleColetaInput("obs", e.target.value)}
                  placeholder="Detalhes da coleta"
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowColetaModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingColeta}>
                  {savingColeta ? "Salvando..." : editingId ? "Salvar alteração" : "Cadastrar coleta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {analysisTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold">Registrar análise</h2>
                <p className="text-sm text-slate-500">
                  {analysisTarget.transportadora} · Ticket {analysisTarget.ticket}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAnalysisTarget(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveAnalysis} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={analysisForm.status}
                  onChange={(e) =>
                    setAnalysisForm((prev) => ({
                      ...prev,
                      status: e.target.value as StatusType,
                    }))
                  }
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observação da análise</label>
                <textarea
                  rows={5}
                  value={analysisForm.observacao_analise}
                  onChange={(e) =>
                    setAnalysisForm((prev) => ({
                      ...prev,
                      observacao_analise: e.target.value,
                    }))
                  }
                  placeholder="Descreva o que aconteceu"
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAnalysisTarget(null)}>
                  Fechar
                </Button>
                <Button type="submit" disabled={savingAnalysis}>
                  {savingAnalysis ? "Salvando..." : "Salvar análise"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && showAdminSummary && groupedByUser.length > 0 && (
  <div className="fixed bottom-4 right-4 z-50 w-80 max-h-[60vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 hidden xl:block">
          <div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <Users className="w-4 h-4 text-slate-500" />
    <h3 className="font-semibold text-slate-800">Visão geral por usuário</h3>
  </div>

  <Button
    type="button"
    variant="ghost"
    size="icon"
    onClick={() => setShowAdminSummary(false)}
  >
    <X className="w-4 h-4" />
  </Button>
</div>

          <div className="space-y-3">
            {groupedByUser
  .filter((group) => selectedUserId === "all" || group.userId === selectedUserId)
  .map((group) => (
              <div key={group.userId} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <div className="font-medium text-slate-800">{group.nome}</div>
                <div className="text-xs text-slate-500 mb-2">{group.usuario || "-"}</div>
                <div className="text-sm text-slate-700">Total: {group.items.length}</div>
                <div className="text-sm text-slate-700">Abertas: {group.abertas}</div>
                <div className="text-sm text-slate-700">Atrasadas: {group.atrasadas}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
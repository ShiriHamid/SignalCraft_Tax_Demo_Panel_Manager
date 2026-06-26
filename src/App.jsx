import { useState, useEffect } from "react";

const WEBHOOK_URL = "https://signalcraftai.app.n8n.cloud/webhook/SignalCraft-Tax-api";
const UPDATE_URL  = "https://signalcraftai.app.n8n.cloud/webhook/SignalCraft-Tax-update";
const BLOCKED_URL = "https://signalcraftai.app.n8n.cloud/webhook/SignalCraft-Tax-blocked";
const CONSULTANTS_URL = "https://signalcraftai.app.n8n.cloud/webhook/SignalCraft-Tax-consultants";
const REBUILD_PROMPT_URL = "https://signalcraftai.app.n8n.cloud/webhook/SignalCraft-tax-rebuild-advisers-prompt";

const AUTH = { username: "admin", password: "admin", pin: "1234" };
const SESSION_KEY = "signalcraft_consultant_auth";
const THEME_KEY   = "signalcraft_theme";



const MORNING   = { start: 540,  end: 780  };
const AFTERNOON = { start: 780,  end: 1020 };

const toDateStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
};
const fmtDate = (s) => {
  if (!s) return "";
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// Returns the Monday of the week containing the given date string (YYYY-MM-DD)
const getWeekStart = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA");
};

// Returns next N working days (Mon-Fri) starting from offset
const getWorkingDateStr = (offset) => {
  const d = new Date();
  let count = 0;
  let i = 0;
  while (true) {
    i++;
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + i);
    const day = candidate.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) {
      count++;
      if (count === offset) return candidate.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    }
  }
};

const getDates = () => {
  const today = new Date();
  const todayDay = today.getDay();
  const TODAY = toDateStr(0);
  // If today is weekend, show next 5 working days; otherwise today + next 4 working days
  if (todayDay === 0 || todayDay === 6) {
    return [1,2,3,4,5].map(n => {
      const d = getWorkingDateStr(n);
      return { label: fmtDate(d), sub: "", val: d };
    });
  }
  const next4 = [1,2,3,4].map(n => {
    const d = getWorkingDateStr(n);
    return { label: fmtDate(d), sub: "", val: d };
  });
  return [
    { label: "Today", sub: fmtDate(TODAY), val: TODAY },
    ...next4,
  ];
};

const DARK = {
  bg: "#0a0f0e", card: "#111817", border: "#1a2624", border2: "#243534",
  text: "#e6f0ee", muted: "#6b8480", muted2: "#4f6662", muted3: "#374a47",
  input: "#0d1413", nav: "#0d1413", accent: "#0f766e", accentT: "#5eead4",
  SC: {
    Confirmed: { bg: "#0d2b1a", text: "#22c55e", border: "#166534" },
    Pending:   { bg: "#2b1f05", text: "#f59e0b", border: "#92400e" },
    Cancelled: { bg: "#2b0a0a", text: "#ef4444", border: "#991b1b" },
  },
};

const LIGHT = {
  bg: "#f0f5f4", card: "#ffffff", border: "#dde8e6", border2: "#c3d4d1",
  text: "#0c1f1c", muted: "#4a6360", muted2: "#5f7a76", muted3: "#94a8a5",
  input: "#f6faf9", nav: "#ffffff", accent: "#0f766e", accentT: "#0d5c56",
  SC: {
    Confirmed: { bg: "#dcfce7", text: "#16a34a", border: "#86efac" },
    Pending:   { bg: "#fef9c3", text: "#ca8a04", border: "#fde047" },
    Cancelled: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  },
};

const parseBlocked = (data) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && data.id) records = [data];
  else if (data && Array.isArray(data.records)) records = data.records;
  return records.map(r => ({
    id:            r.id,
    consultant_id: r.fields?.Consultant_ID || r.Consultant_ID || "",
    date:          r.fields?.Date ? r.fields.Date.split("T")[0] : (r.Date ? r.Date.split("T")[0] : ""),
    start_time:    r.fields?.Start_Time || r.Start_Time || "",
    end_time:      r.fields?.End_Time   || r.End_Time   || "",
    reason:        r.fields?.Reason     || r.Reason     || "",
  }));
};

const parseConsultants = (data) => {
  let records = [];
  if (data && Array.isArray(data) && data[0] && Array.isArray(data[0].consultants)) records = data[0].consultants;
  else if (data && Array.isArray(data.consultants)) records = data.consultants;
  else if (Array.isArray(data)) records = data;
  else if (data && Array.isArray(data.records)) records = data.records;
  else if (data && data.id) records = [data];
  return records.map(r => {
    const f = r.fields || r;
    return {
      id:                 r.id || f.id || "",
      consultant_id:      f.Consultant_ID || f.consultant_id || "",
      name:               f.Name || f.name || "",
      department:         f.Department || f.department || "",
      title:              f.Title || f.title || "",
      location:           (() => { const loc = f.Location || f.location || ""; return Array.isArray(loc) ? loc.join(", ") : loc; })(),
      direct_phone:       f.Direct_Phone || f.direct_phone || "",
      direct_email:       f.Direct_Email || f.direct_email || "",
      background:         f.Background || f.background || "",
      specialities:       f.Specialities || f.specialities || "",
      session_durations:  f.Session_Durations || f.session_durations || "",
      pricing:            f.Pricing || f.pricing || "",
      best_for:           f.Best_For || f.best_for || "",
      note:               f.Note || f.note || "",
      working_hours:      f.Working_Hours || f.working_hours || "",
      calendar_email:     f.Calendar_Email || f.calendar_email || "",
      active:             (f.Active !== undefined ? f.Active : f.active) !== false,
    };
  });
};

const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

function LoginScreen({ onLogin, T }) {
  const [step, setStep]         = useState("creds");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin]           = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };
  const handleCreds = () => {
    if (username === AUTH.username && password === AUTH.password) { setError(""); setStep("pin"); }
    else { setError("Invalid username or password"); triggerShake(); }
  };
  const handlePin = (digit) => {
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (next === AUTH.pin) { localStorage.setItem(SESSION_KEY, "1"); onLogin(); }
      else { setError("Wrong PIN"); triggerShake(); setTimeout(() => setPin(""), 600); }
    }
  };

  const inp = { background: T.input, border: `1px solid ${T.border2}`, borderRadius: 12, padding: "14px 16px", color: T.text, fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, padding: 32, background: T.card, border: `1px solid ${T.border}`, borderRadius: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.15)", transform: shake ? "translateX(-6px)" : "none", transition: "transform 0.1s" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#0f766e,#134e4a)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 14px" }}>📊</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: T.text }}>SignalCraft</div>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 3, marginTop: 3 }}>TAX & ACCOUNTING</div>
        </div>
        {step === "creds" ? (
          <>
            <div style={{ fontSize: 14, color: T.muted, textAlign: "center", marginBottom: 24 }}>Sign in to continue</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: T.muted2, marginBottom: 8 }}>Username</div>
              <input style={inp} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreds()} placeholder="admin" autoComplete="username" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: T.muted2, marginBottom: 8 }}>Password</div>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreds()} placeholder="••••••" autoComplete="current-password" />
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 16 }}>{error}</div>}
            <button onClick={handleCreds} style={{ width: "100%", background: "linear-gradient(135deg,#0f766e,#134e4a)", color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Continue →</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: T.muted, textAlign: "center", marginBottom: 28 }}>Enter your 4-digit PIN</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 32 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: i < pin.length ? T.accent : T.border, border: `2px solid ${i < pin.length ? T.accent : T.border2}`, transition: "all 0.15s" }} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                <button key={i} onClick={() => { if (d === "⌫") setPin(p => p.slice(0,-1)); else if (d) handlePin(d); }}
                  style={{ padding: "18px 0", borderRadius: 14, border: `1px solid ${T.border}`, background: d ? T.input : "transparent", color: T.text, fontSize: 22, fontWeight: 700, cursor: d ? "pointer" : "default", opacity: d ? 1 : 0, WebkitTapHighlightColor: "transparent" }}>
                  {d}
                </button>
              ))}
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{error}</div>}
            <button onClick={() => { setStep("creds"); setPin(""); setError(""); }} style={{ width: "100%", background: "transparent", color: T.muted, border: "none", fontSize: 13, cursor: "pointer", padding: "10px" }}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(SESSION_KEY));
  const [isDark, setIsDark] = useState(() => localStorage.getItem(THEME_KEY) !== "light");
  const T = isDark ? DARK : LIGHT;
  const toggleTheme = () => { const n = !isDark; setIsDark(n); localStorage.setItem(THEME_KEY, n ? "dark" : "light"); };
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} T={T} />;
  return <Dashboard onLogout={() => { localStorage.removeItem(SESSION_KEY); setAuthed(false); }} T={T} isDark={isDark} toggleTheme={toggleTheme} />;
}

function Dashboard({ onLogout, T, isDark, toggleTheme }) {
  const isMobile = useIsMobile();
  const [reservations, setReservations] = useState([]);
  const [blocked, setBlocked]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [dates, setDates]               = useState(getDates);
  const [date, setDate]                 = useState(() => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0 || day === 6) return getWorkingDateStr(1);
    return toDateStr(0);
  });
  const [view, setView]                 = useState("timeline");
  const [session, setSession]           = useState("morning");
  const [detail, setDetail]             = useState(null);
  const [toast, setToast]               = useState(null);
  const [now, setNow]                   = useState(new Date());
  const [blockForm, setBlockForm]       = useState({ consultant_id: "C01", date: toDateStr(0), start_time: "", end_time: "", reason: "" });
  const [blockLoading, setBlockLoading] = useState(false);
  const [consultants, setConsultants]       = useState([]);
  const [consultantsLoading, setConsultantsLoading] = useState(false);
  const emptyConsultantForm = { consultant_id: "", name: "", department: "Tax & Accounting", title: "", location: "", direct_phone: "", direct_email: "", background: "", specialities: "", session_durations: "", pricing: "", best_for: "", note: "", working_hours: "Mon-Fri 09:00-17:00", calendar_email: "", active: true };
  const [consultantForm, setConsultantForm] = useState(emptyConsultantForm);
  const [consultantSaving, setConsultantSaving] = useState(false);
  const [editingConsultantId, setEditingConsultantId] = useState(null);

  useEffect(() => {
    fetchReservations(); fetchBlocked(); fetchConsultants();
    const clock = setInterval(() => { setNow(new Date()); setDates(getDates()); }, 30000);
    return () => clearInterval(clock);
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch(WEBHOOK_URL);
      const data = await res.json();
      setReservations(data[0]?.reservations || data.reservations || []);
    } catch (e) { setError("Could not load bookings."); } finally { setLoading(false); }
  };
  const fetchBlocked = async () => {
    try { 
      const res = await fetch(BLOCKED_URL); 
      const data = await res.json(); 
      console.log("RAW BLOCKED DATA:", JSON.stringify(data));
      const parsed = parseBlocked(data);
      console.log("PARSED BLOCKED:", JSON.stringify(parsed));
      setBlocked(parsed); 
    }
    catch (e) { setBlocked([]); }
  };
  const fetchConsultants = async () => {
    try {
      setConsultantsLoading(true);
      const res = await fetch(CONSULTANTS_URL);
      const data = await res.json();
      const parsed = parseConsultants(data);
      setConsultants(parsed);
    } catch (e) { setConsultants([]); } finally { setConsultantsLoading(false); }
  };
  const triggerRebuildPrompt = async () => {
    try {
      await fetch(REBUILD_PROMPT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    } catch (e) { /* non-critical: advisers prompt cache may be stale until next successful trigger */ }
  };
  const saveConsultant = async () => {
    if (!consultantForm.name || !consultantForm.title) { showToast("Name and title are required", "err"); return; }
    try {
      setConsultantSaving(true);
      const payload = { ...consultantForm };
      const method = editingConsultantId ? "PATCH" : "POST";
      if (!editingConsultantId && !payload.consultant_id) {
        const nextNum = consultants.length + 1;
        payload.consultant_id = "C" + String(nextNum).padStart(2, "0");
      }
      const res = await fetch(CONSULTANTS_URL, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success !== false) {
        showToast(editingConsultantId ? "✅ Consultant updated" : "✅ Consultant added");
        await fetchConsultants();
        setConsultantForm(emptyConsultantForm);
        setEditingConsultantId(null);
        triggerRebuildPrompt();
      } else showToast("Failed", "err");
    } catch (e) { showToast("Failed", "err"); } finally { setConsultantSaving(false); }
  };
  const editConsultant = (c) => {
    setConsultantForm({
      consultant_id: c.consultant_id, name: c.name, department: c.department, title: c.title,
      location: c.location, direct_phone: c.direct_phone, direct_email: c.direct_email,
      background: c.background, specialities: c.specialities, session_durations: c.session_durations,
      pricing: c.pricing, best_for: c.best_for, note: c.note, working_hours: c.working_hours,
      calendar_email: c.calendar_email, active: c.active,
    });
    setEditingConsultantId(c.consultant_id);
  };
  const cancelEditConsultant = () => { setConsultantForm(emptyConsultantForm); setEditingConsultantId(null); };
  const deleteConsultant = async (id, consultant_id) => {
    try {
      await fetch(CONSULTANTS_URL, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, consultant_id }) });
      showToast("✅ Removed"); await fetchConsultants();
      triggerRebuildPrompt();
    } catch (e) { showToast("Failed", "err"); }
  };
  const addBlock = async () => {
    if (!blockForm.consultant_id || !blockForm.date) return;
    try {
      setBlockLoading(true);
      const res = await fetch(BLOCKED_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blockForm) });
      const data = await res.json();
      if (data.success) { showToast("🚫 Slot blocked"); await fetchBlocked(); setBlockForm({ consultant_id: "C01", date: toDateStr(0), start_time: "", end_time: "", reason: "" }); }
      else showToast("Failed", "err");
    } catch (e) { showToast("Failed", "err"); } finally { setBlockLoading(false); }
  };
  const removeBlock = async (id) => {
    try {
      await fetch(BLOCKED_URL, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      showToast("✅ Removed"); setBlocked(prev => prev.filter(b => b.id !== id));
    } catch (e) { showToast("Failed", "err"); }
  };
  const updateStatus = async (id, status) => {
    try {
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      showToast(status === "Confirmed" ? "✅ Confirmed" : "❌ Cancelled");
      setDetail(null);
      await fetch(UPDATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    } catch (e) { showToast("Failed", "err"); fetchReservations(); }
  };
  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const SC = T.SC;
  const TODAY_STR      = toDateStr(0);
  const sess           = session === "morning" ? MORNING : AFTERNOON;
  const sessW          = sess.end - sess.start;
  const dayRes         = reservations.filter(r => r.date === date && r.status !== "Cancelled");
  const allDay         = reservations.filter(r => r.date === date);
  const blockedForDate = blocked.filter(b => b.date === date);

  const stats = { total: allDay.length, confirmed: allDay.filter(r => r.status === "Confirmed").length, pending: allDay.filter(r => r.status === "Pending").length, cancelled: allDay.filter(r => r.status === "Cancelled").length };

  // ───────────────────────────────────────────────────────────
  // ANALYTICS (derived entirely client-side from reservations + consultants
  // already fetched via the existing Panel API — no n8n changes needed)
  // ───────────────────────────────────────────────────────────
  const activeRes = reservations.filter(r => r.status !== "Cancelled");

  const todayWeekStart = getWeekStart(TODAY_STR);
  const thisMonthPrefix = TODAY_STR.slice(0, 7); // YYYY-MM

  const weekRes  = activeRes.filter(r => getWeekStart(r.date) === todayWeekStart);
  const monthRes = activeRes.filter(r => r.date && r.date.slice(0, 7) === thisMonthPrefix);

  const specialityBreakdown = (() => {
    const counts = {};
    monthRes.forEach(r => { const key = r.speciality || "Other"; counts[key] = (counts[key] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  const busiestDay = (() => {
    const counts = {};
    monthRes.forEach(r => {
      const wk = new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
      counts[wk] = (counts[wk] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries[0] || null;
  })();

  const consultantLoad = (() => {
    const counts = {};
    monthRes.forEach(r => { counts[r.table] = (counts[r.table] || 0) + 1; });
    return Object.entries(counts)
      .map(([id, count]) => ({ id, count, name: consultants.find(c => c.consultant_id === id)?.name || id }))
      .sort((a, b) => b.count - a.count);
  })();

  // Channel breakdown (real Channel field: Telegram / Voice / WhatsApp, etc.)
  const channelBreakdown = (() => {
    const counts = {};
    activeRes.forEach(r => { const key = r.channel || "Unknown"; counts[key] = (counts[key] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();

  // Unique customers this week / month (by phone number)
  const uniquePhones = (list) => new Set(list.map(r => r.phone).filter(Boolean)).size;
  const weekUniqueCustomers  = uniquePhones(weekRes);
  const monthUniqueCustomers = uniquePhones(monthRes);

  // Repeat customers this month: phone numbers with more than one booking
  const repeatCustomersThisMonth = (() => {
    const counts = {};
    monthRes.forEach(r => { if (r.phone) counts[r.phone] = (counts[r.phone] || 0) + 1; });
    return Object.entries(counts).filter(([, c]) => c > 1).length;
  })();

  // Per-person monthly booking count (by phone, showing the customer's name)
  const perCustomerMonthly = (() => {
    const map = {};
    monthRes.forEach(r => {
      if (!r.phone) return;
      if (!map[r.phone]) map[r.phone] = { name: r.name || r.phone, phone: r.phone, count: 0 };
      map[r.phone].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  const nowMin  = now.getHours() * 60 + now.getMinutes();
  const nowPct  = date === TODAY_STR ? Math.min(100, Math.max(0, (nowMin - sess.start) / sessW * 100)) : null;
  const inSess  = date === TODAY_STR && nowMin >= sess.start && nowMin <= sess.end;

  const inSession = (r) => toMin(r.end_time) > sess.start && toMin(r.start_time) < sess.end;
  const leftPct   = (r) => Math.max(0, (toMin(r.start_time) - sess.start) / sessW * 100);
  const widthPct  = (r) => Math.min(100, (toMin(r.end_time) - Math.max(toMin(r.start_time), sess.start)) / sessW * 100);
  const bLeftPct  = (b) => Math.max(0, (Math.max(toMin(b.start_time), sess.start) - sess.start) / sessW * 100);
  const bWidthPct = (b) => Math.min(100, (Math.min(toMin(b.end_time), sess.end) - Math.max(toMin(b.start_time), sess.start)) / sessW * 100);

  const NAV = [
    { id: "timeline", icon: "⏱", label: "Timeline" },
    { id: "list",     icon: "📋", label: "Bookings" },
    { id: "insights", icon: "📈", label: "Insights" },
    { id: "blocked",  icon: "🚫", label: "Block"    },
    { id: "team",     icon: "👤", label: "Team"     },
  ];

  const inp = { background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", color: T.text, fontSize: 15, width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, color: T.accentT, flexDirection: "column", gap: 16 }}><div style={{ fontSize: 40 }}>📊</div><div style={{ fontSize: 14, color: T.muted }}>Loading...</div></div>;
  if (error)   return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, color: "#ef4444", flexDirection: "column", gap: 16 }}><div style={{ fontSize: 32 }}>⚠️</div><div>{error}</div><button onClick={fetchReservations} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>Retry</button></div>;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: isMobile ? "auto" : "100vh", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "system-ui,sans-serif", overflow: isMobile ? "visible" : "hidden" }}>

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.type === "ok" ? SC.Confirmed.bg : SC.Cancelled.bg, border: `1px solid ${toast.type === "ok" ? SC.Confirmed.border : SC.Cancelled.border}`, color: toast.type === "ok" ? SC.Confirmed.text : SC.Cancelled.text, borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>{toast.msg}</div>}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setDetail(null)}>
          <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, boxShadow: "0 -8px 40px rgba(0,0,0,0.2)", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: T.border2, borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 800, fontSize: 17, color: T.text }}>Booking — {detail.res_id}</span>
              <button onClick={() => setDetail(null)} style={{ background: T.border, border: "none", color: T.muted, fontSize: 16, cursor: "pointer", borderRadius: 8, padding: "6px 10px" }}>✕</button>
            </div>
            {[["Name", detail.name], ["Phone", detail.phone], ["Email", detail.email || "—"], ["Date", detail.date], ["Time", `${detail.start_time} → ${detail.end_time}`], ["Duration", `${detail.duration || "—"} min`], ["Speciality", detail.speciality], ["Consultant", detail.table], ["Status", detail.status]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.border}`, fontSize: 14 }}>
                <span style={{ color: T.muted }}>{k}</span>
                <span style={{ fontWeight: 600, color: k === "Status" ? SC[v]?.text : T.text }}>{v}</span>
              </div>
            ))}
            {detail.notes && detail.notes !== "NONE" && (
              <div style={{ padding: "11px 0", borderBottom: `1px solid ${T.border}`, fontSize: 14 }}>
                <div style={{ color: T.muted, marginBottom: 6 }}>Notes</div>
                <div style={{ fontWeight: 500, color: T.text, fontSize: 13, background: T.input, borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>{detail.notes}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => updateStatus(detail.id, "Confirmed")} style={{ flex: 1, background: SC.Confirmed.bg, color: SC.Confirmed.text, border: `1px solid ${SC.Confirmed.border}`, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>✓ Confirm</button>
              <button onClick={() => updateStatus(detail.id, "Cancelled")} style={{ flex: 1, background: SC.Cancelled.bg, color: SC.Cancelled.text, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>✗ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP Sidebar */}
      {!isMobile && (
        <div style={{ width: 210, background: T.nav, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#0f766e,#134e4a)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📊</div>
              <div><div style={{ fontWeight: 800, fontSize: 13, color: T.text }}>SignalCraft</div><div style={{ fontSize: 9, color: T.accent, fontWeight: 700, letterSpacing: 2 }}>TAX & ACCOUNTING</div></div>
            </div>
          </div>
          <nav style={{ flex: 1, padding: "12px 8px" }}>
            {NAV.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 3, background: view === item.id ? T.accent + "22" : "transparent", color: view === item.id ? T.accentT : T.muted, fontWeight: view === item.id ? 700 : 400, fontSize: 13, textAlign: "left", borderLeft: `2px solid ${view === item.id ? T.accent : "transparent"}` }}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={toggleTheme} style={{ width: "100%", background: T.border, border: "none", color: T.muted, borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer" }}>{isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
            <button onClick={() => { fetchReservations(); fetchBlocked(); }} style={{ width: "100%", background: T.border, border: "none", color: T.muted, borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer" }}>🔄 Refresh</button>
            <button onClick={onLogout} style={{ width: "100%", background: SC.Cancelled.bg, border: `1px solid ${SC.Cancelled.border}`, color: SC.Cancelled.text, borderRadius: 8, padding: "8px", fontSize: 12, cursor: "pointer" }}>🚪 Logout</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: isMobile ? "visible" : "hidden" }}>

        {/* Mobile Header */}
        {isMobile && (
          <div style={{ background: T.nav, borderBottom: `1px solid ${T.border}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#0f766e,#134e4a)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📊</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>SignalCraft</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={toggleTheme} style={{ background: T.border, border: "none", color: T.muted, borderRadius: 8, padding: "5px 8px", fontSize: 14, cursor: "pointer" }}>{isDark ? "☀️" : "🌙"}</button>
              <span style={{ fontSize: 12, color: T.muted2 }}>🕐 {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              <button onClick={onLogout} style={{ background: SC.Cancelled.bg, border: `1px solid ${SC.Cancelled.border}`, color: SC.Cancelled.text, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Logout</button>
            </div>
          </div>
        )}

        {/* Date tabs */}
        <div style={{ background: T.nav, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "10px 16px" : "0 22px", display: "flex", gap: 8, flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            {dates.map(d => (
              <button key={d.val} onClick={() => setDate(d.val)} style={{ padding: "5px 14px", height: 56, border: "none", borderBottom: `2px solid ${date === d.val ? T.accent : "transparent"}`, background: "transparent", color: date === d.val ? T.accentT : T.muted, fontWeight: date === d.val ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                {d.label} <span style={{ fontSize: 11, opacity: 0.6 }}>{d.sub}</span>
              </button>
            ))}
          </div>}
          {isMobile && dates.map(d => (
            <button key={d.val} onClick={() => setDate(d.val)} style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${date === d.val ? T.accent : T.border}`, background: date === d.val ? T.accent : "transparent", color: date === d.val ? "#fff" : T.muted, fontWeight: date === d.val ? 700 : 400, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              {d.label}
            </button>
          ))}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
              <span style={{ fontSize: 12, color: T.muted2 }}>🕐 {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: isMobile ? undefined : 1, overflow: isMobile ? "visible" : "auto", padding: isMobile ? "12px" : "20px", display: "flex", flexDirection: "column", gap: isMobile ? 10 : 16 }}>

          {/* Stats */}
          {view !== "blocked" && view !== "insights" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
              {[{ label: "Total", val: stats.total, icon: "📅", color: "#818cf8" }, { label: "Confirmed", val: stats.confirmed, icon: "✅", color: "#22c55e" }, { label: "Pending", val: stats.pending, icon: "⏳", color: "#f59e0b" }, { label: "Cancelled", val: stats.cancelled, icon: "❌", color: "#ef4444" }].map((s, i) => (
                <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
                  <div><div style={{ fontSize: 11, color: T.muted, marginBottom: 1 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div></div>
                </div>
              ))}
            </div>
          )}

          {/* TIMELINE */}
          {view === "timeline" && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Timeline — {fmtDate(date)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {["morning", "afternoon"].map(s => (
                    <button key={s} onClick={() => setSession(s)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${session === s ? T.accent : T.border}`, background: session === s ? T.accent : "transparent", color: session === s ? "#fff" : T.muted, fontWeight: session === s ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
                      {s === "morning" ? "☀️ Morning" : "🌆 Afternoon"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: "auto", padding: "14px 16px" }}>
                <div style={{ minWidth: isMobile ? 500 : 400 }}>
                  <div style={{ display: "flex", marginLeft: 90, marginBottom: 6 }}>
                    {Array.from({ length: 7 }, (_, i) => { const m = sess.start + i * (sessW / 6), h = Math.floor(m / 60), mn = m % 60; return <div key={i} style={{ flex: 1, fontSize: 9, color: T.muted3 }}>{String(h).padStart(2,"0")}:{String(Math.round(mn)).padStart(2,"0")}</div>; })}
                  </div>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, display: "flex", marginLeft: 90, pointerEvents: "none" }}>
                      {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ flex: 1, borderLeft: `1px solid ${T.border}` }} />)}
                    </div>
                    {nowPct !== null && inSess && (
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(90px + ${nowPct}% * (100% - 90px) / 100)`, width: 2, background: T.accent, zIndex: 10, pointerEvents: "none" }}>
                        <div style={{ position: "absolute", top: -4, left: -14, fontSize: 8, color: T.accentT, fontWeight: 700, background: T.card, padding: "1px 3px", borderRadius: 3 }}>NOW</div>
                      </div>
                    )}
                    {consultants.filter(c => c.active).map(c => {
                      const cRes    = dayRes.filter(r => r.table === c.consultant_id && inSession(r));
                      const cBlocks = blockedForDate.filter(b => b.consultant_id === c.consultant_id && b.start_time && b.end_time && toMin(b.start_time) < sess.end && toMin(b.end_time) > sess.start);
                      return (
                        <div key={c.consultant_id} style={{ display: "flex", alignItems: "center", marginBottom: 8, height: 40 }}>
                          <div style={{ width: 90, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: cBlocks.length > 0 ? "#ef4444" : T.accentT }}>{c.consultant_id}</span>
                            <span style={{ fontSize: 9, color: T.muted3 }}>{c.name}</span>
                          </div>
                          <div style={{ flex: 1, position: "relative", height: 34, background: T.input, borderRadius: 8, overflow: "hidden" }}>
                            {cRes.map(r => {
                              const lp = leftPct(r), wp = widthPct(r);
                              if (wp <= 0) return null;
                              const sc = SC[r.status];
                              return <div key={r.id} onClick={() => setDetail(r)} style={{ position: "absolute", top: 2, height: "calc(100% - 4px)", left: `${lp}%`, width: `${wp}%`, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", paddingLeft: 6, overflow: "hidden", minWidth: 4, zIndex: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: sc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wp > 8 ? r.name?.split(" ").slice(0, 2).join(" ") : ""}</span>
                              </div>;
                            })}
                            {cBlocks.map(b => {
                              const lp = bLeftPct(b), wp = bWidthPct(b);
                              if (wp <= 0) return null;
                              return <div key={b.id} style={{ position: "absolute", top: 2, height: "calc(100% - 4px)", left: `${lp}%`, width: `${wp}%`, background: SC.Cancelled.bg, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 6, overflow: "hidden", minWidth: 4, zIndex: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: SC.Cancelled.text, whiteSpace: "nowrap" }}>{wp > 8 ? `🚫${b.reason ? ` ${b.reason}` : ""}` : ""}</span>
                              </div>;
                            })}
                            {cRes.length === 0 && cBlocks.length === 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 8 }}><span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Free</span></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
                    {Object.entries(SC).map(([s, c]) => <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}` }} /><span style={{ color: c.text }}>{s}</span></div>)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LIST */}
          {view === "list" && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Bookings — {fmtDate(date)}</span>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>Pending · confirm from Timeline</span>
              </div>
              <div style={{ overflow: "auto" }}>
                {allDay.filter(r => r.status === "Pending").length === 0
                  ? <div style={{ padding: 40, textAlign: "center", color: T.muted3, fontSize: 14 }}>No pending bookings</div>
                  : allDay.filter(r => r.status === "Pending").map((r, i) => {
                    const sc = SC[r.status];
                    const consultant = consultants.find(c => c.consultant_id === r.table);
                    return (
                      <div key={r.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.bg + "44" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{r.name}</span>
                            <span style={{ background: T.accent + "22", borderRadius: 6, padding: "2px 7px", fontSize: 12, fontWeight: 700, color: T.accentT }}>{r.table}</span>
                          </div>
                          <span style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{r.status}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: T.muted, marginBottom: 4 }}>
                          <span>🕐 {r.start_time} → {r.end_time}</span>
                          <span>⏱ {r.duration || "—"} min</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted }}>
                          {r.speciality} · {consultant?.location || consultant?.name || ""}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* INSIGHTS */}
          {view === "insights" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Volume + customer cards */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>📅 This week</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.accentT, lineHeight: 1 }}>{weekRes.length}</div>
                  <div style={{ fontSize: 11, color: T.muted2, marginTop: 4 }}>booking{weekRes.length === 1 ? "" : "s"}</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>📅 This month</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.accentT, lineHeight: 1 }}>{monthRes.length}</div>
                  <div style={{ fontSize: 11, color: T.muted2, marginTop: 4 }}>booking{monthRes.length === 1 ? "" : "s"}</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>👥 Unique customers</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1 }}>{monthUniqueCustomers}</div>
                  <div style={{ fontSize: 11, color: T.muted2, marginTop: 4 }}>this month · {weekUniqueCustomers} this week</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>🔁 Repeat customers</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1 }}>{repeatCustomersThisMonth}</div>
                  <div style={{ fontSize: 11, color: T.muted2, marginTop: 4 }}>booked 2+ times this month</div>
                </div>
              </div>

              {/* Channel breakdown */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Bookings by channel — all time</div>
                {channelBreakdown.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: T.muted3, fontSize: 14 }}>No bookings yet</div>
                ) : (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {channelBreakdown.map(([name, count]) => {
                      const max = channelBreakdown[0][1];
                      const pct = Math.max(6, Math.round((count / max) * 100));
                      const icon = name === "WhatsApp" ? "💬" : name === "Voice" ? "📞" : name === "Telegram" ? "✈️" : "🔹";
                      return (
                        <div key={name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 4 }}>
                            <span style={{ color: T.text, fontWeight: 600 }}>{icon} {name}</span>
                            <span>{count}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: T.input, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg,#0f766e,#5eead4)` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Speciality breakdown */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Bookings by service — this month</div>
                {specialityBreakdown.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: T.muted3, fontSize: 14 }}>No bookings yet this month</div>
                ) : (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {specialityBreakdown.map(([name, count]) => {
                      const max = specialityBreakdown[0][1];
                      const pct = Math.max(6, Math.round((count / max) * 100));
                      return (
                        <div key={name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 4 }}>
                            <span style={{ color: T.text, fontWeight: 600 }}>{name}</span>
                            <span>{count}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: T.input, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: `linear-gradient(90deg,#0f766e,#5eead4)` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Busiest day + consultant load */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>📅 Busiest day this month</div>
                  {busiestDay ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{busiestDay[0]}</div>
                      <div style={{ fontSize: 12, color: T.muted2, marginTop: 2 }}>{busiestDay[1]} booking{busiestDay[1] === 1 ? "" : "s"} so far this month</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: T.muted3 }}>Not enough data yet</div>
                  )}
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>👤 Consultant load — this month</div>
                  {consultantLoad.length === 0 ? (
                    <div style={{ fontSize: 13, color: T.muted3 }}>Not enough data yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {consultantLoad.map(c => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: T.text }}>{c.name} <span style={{ color: T.muted2, fontSize: 11 }}>({c.id})</span></span>
                          <span style={{ fontWeight: 700, color: T.accentT }}>{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-customer bookings this month */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Bookings per customer — this month</div>
                {perCustomerMonthly.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: T.muted3, fontSize: 14 }}>No bookings yet this month</div>
                ) : (
                  perCustomerMonthly.map(p => (
                    <div key={p.phone} style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: T.muted2 }}>{p.phone}</div>
                      </div>
                      <span style={{ background: T.accent + "22", color: T.accentT, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{p.count}×</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* BLOCK SLOTS */}
          {view === "blocked" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: T.text }}>🚫 Block a Slot</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Consultant</div>
                    <select value={blockForm.consultant_id} onChange={e => setBlockForm(p => ({ ...p, consultant_id: e.target.value }))} style={inp}>
                      {consultants.filter(c => c.active).map(c => <option key={c.consultant_id} value={c.consultant_id}>{c.consultant_id} — {c.name} ({c.department})</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Date</div>
                    <input type="date" value={blockForm.date} onChange={e => setBlockForm(p => ({ ...p, date: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Start Time</div>
                      <input type="time" value={blockForm.start_time} onChange={e => setBlockForm(p => ({ ...p, start_time: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>End Time</div>
                      <input type="time" value={blockForm.end_time} onChange={e => setBlockForm(p => ({ ...p, end_time: e.target.value }))} style={inp} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Reason</div>
                    <input type="text" placeholder="e.g. Annual leave" value={blockForm.reason} onChange={e => setBlockForm(p => ({ ...p, reason: e.target.value }))} style={inp} />
                  </div>
                </div>
                <button onClick={addBlock} disabled={blockLoading} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: blockLoading ? 0.6 : 1 }}>
                  {blockLoading ? "Saving..." : "🚫 Block Slot"}
                </button>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Active Blocks ({blocked.length})</div>
                {blocked.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: T.muted3, fontSize: 14 }}>No blocked slots</div> :
                  blocked.map(b => {
                    const consultant = consultants.find(c => c.consultant_id === b.consultant_id);
                    return (
                      <div key={b.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ background: SC.Cancelled.bg, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 700, color: SC.Cancelled.text }}>{b.consultant_id}</span>
                            <span style={{ fontSize: 13, color: T.text }}>{fmtDate(b.date)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: T.muted }}>
                            {consultant?.name} {b.start_time && b.end_time ? `· ${b.start_time}–${b.end_time}` : ""} {b.reason ? `· ${b.reason}` : ""}
                          </div>
                        </div>
                        <button onClick={() => removeBlock(b.id)} style={{ background: SC.Cancelled.bg, color: SC.Cancelled.text, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Remove</button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TEAM / CONSULTANTS */}
          {view === "team" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: T.text }}>
                  {editingConsultantId ? `✏️ Edit ${editingConsultantId}` : "👤 Add a Consultant"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Name</div>
                    <input type="text" placeholder="e.g. Sarah Mitchell" value={consultantForm.name} onChange={e => setConsultantForm(p => ({ ...p, name: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Department</div>
                    <select value={consultantForm.department} onChange={e => setConsultantForm(p => ({ ...p, department: e.target.value }))} style={inp}>
                      <option value="Tax & Accounting">Tax & Accounting</option>
                      <option value="Bookkeeping">Bookkeeping</option>
                      <option value="Payroll">Payroll</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Title</div>
                    <input type="text" placeholder="e.g. Chartered Accountant (ACCA)" value={consultantForm.title} onChange={e => setConsultantForm(p => ({ ...p, title: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Location</div>
                    <input type="text" placeholder="e.g. In-Person, Southampton office" value={consultantForm.location} onChange={e => setConsultantForm(p => ({ ...p, location: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Direct Phone</div>
                      <input type="text" placeholder="+44 7700 900000" value={consultantForm.direct_phone} onChange={e => setConsultantForm(p => ({ ...p, direct_phone: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Direct Email</div>
                      <input type="text" placeholder="name@example.com" value={consultantForm.direct_email} onChange={e => setConsultantForm(p => ({ ...p, direct_email: e.target.value }))} style={inp} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Background</div>
                    <input type="text" placeholder="e.g. 9 years experience, ACCA qualified, ex-PwC" value={consultantForm.background} onChange={e => setConsultantForm(p => ({ ...p, background: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Specialities</div>
                    <input type="text" placeholder="e.g. Self Assessment, VAT Returns, Bookkeeping" value={consultantForm.specialities} onChange={e => setConsultantForm(p => ({ ...p, specialities: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Session Durations</div>
                      <input type="text" placeholder="e.g. 30, 60 min" value={consultantForm.session_durations} onChange={e => setConsultantForm(p => ({ ...p, session_durations: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Working Hours</div>
                      <input type="text" placeholder="Mon-Fri 09:00-17:00" value={consultantForm.working_hours} onChange={e => setConsultantForm(p => ({ ...p, working_hours: e.target.value }))} style={inp} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Pricing</div>
                    <input type="text" placeholder="e.g. 30min — free initial call · 60min — £80 consultation" value={consultantForm.pricing} onChange={e => setConsultantForm(p => ({ ...p, pricing: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Best For</div>
                    <input type="text" placeholder="e.g. Sole traders, freelancers, self-employed individuals" value={consultantForm.best_for} onChange={e => setConsultantForm(p => ({ ...p, best_for: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Note</div>
                    <input type="text" placeholder="e.g. Helped 150+ sole traders file on time" value={consultantForm.note} onChange={e => setConsultantForm(p => ({ ...p, note: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: T.muted2, marginBottom: 6 }}>Calendar Email</div>
                    <input type="text" placeholder="name.calendar@gmail.com" value={consultantForm.calendar_email} onChange={e => setConsultantForm(p => ({ ...p, calendar_email: e.target.value }))} style={inp} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.text, cursor: "pointer" }}>
                    <input type="checkbox" checked={consultantForm.active} onChange={e => setConsultantForm(p => ({ ...p, active: e.target.checked }))} />
                    Active
                  </label>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {editingConsultantId && (
                    <button onClick={cancelEditConsultant} style={{ flex: 1, background: T.border, color: T.muted, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                  )}
                  <button onClick={saveConsultant} disabled={consultantSaving} style={{ flex: 2, background: T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: consultantSaving ? 0.6 : 1 }}>
                    {consultantSaving ? "Saving..." : editingConsultantId ? "💾 Save Changes" : "➕ Add Consultant"}
                  </button>
                </div>
              </div>

              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 700, fontSize: 14, color: T.text }}>Team ({consultants.length})</div>
                {consultantsLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.muted3, fontSize: 14 }}>Loading team…</div>
                ) : consultants.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.muted3, fontSize: 14 }}>No consultants found</div>
                ) : (
                  consultants.map((c, i) => (
                    <div key={c.id || i} style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ background: T.accent + "22", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, color: T.accentT }}>{c.consultant_id}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{c.name}</span>
                          {!c.active && <span style={{ background: SC.Cancelled.bg, color: SC.Cancelled.text, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>Inactive</span>}
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>{c.title} · {c.department}</div>
                        <div style={{ fontSize: 11, color: T.muted2 }}>{c.specialities}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => editConsultant(c)} style={{ background: T.accent + "22", color: T.accentT, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => deleteConsultant(c.id, c.consultant_id)} style={{ background: SC.Cancelled.bg, color: SC.Cancelled.text, border: `1px solid ${SC.Cancelled.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {isMobile && <div style={{ height: 70, flexShrink: 0 }} />}

      {/* MOBILE Bottom Nav */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.nav, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer", color: view === item.id ? T.accentT : T.muted2, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: view === item.id ? 700 : 400 }}>{item.label}</span>
              {view === item.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.accent, marginTop: 3 }} />}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

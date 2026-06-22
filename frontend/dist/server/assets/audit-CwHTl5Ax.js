import { jsxs, jsx } from "react/jsx-runtime";
import { useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { L as Layout } from "./Layout-TjXybuUa.js";
import { a as useToast, u as useAuth, b as auditApi } from "./router-CG78PKU4.js";
import "@radix-ui/react-toast";
const STATUS_COLOR = {
  "2": "text-green-400",
  "4": "text-yellow-400",
  "5": "text-red-400"
};
function statusColor(code) {
  return STATUS_COLOR[String(code)[0]] ?? "text-gray-400";
}
function AuditPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const {
    toast
  } = useToast();
  const {
    token,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const fetchEntries = useCallback(async () => {
    try {
      const res = await auditApi.list(100);
      setEntries(res.entries);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Failed to load audit log",
        description: msg,
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      void navigate({
        to: "/login"
      });
      return;
    }
    void fetchEntries();
  }, [authLoading, token]);
  return /* @__PURE__ */ jsxs(Layout, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold", children: "Audit Log" }),
      /* @__PURE__ */ jsx("button", { onClick: () => void fetchEntries(), className: "btn-secondary text-sm", children: "Refresh" })
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-gray-400", children: "Loading…" }) : entries.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card text-center text-gray-400 py-12", children: /* @__PURE__ */ jsx("p", { children: "No audit entries yet." }) }) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm border-collapse", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-700 text-left text-gray-400", children: [
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium", children: "Model" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium", children: "Status" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium text-right", children: "In Tokens" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium text-right", children: "Out Tokens" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium text-right", children: "Duration" }),
        /* @__PURE__ */ jsx("th", { className: "py-3 px-4 font-medium", children: "Created" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: entries.map((entry) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-gray-800 hover:bg-gray-800/50 transition-colors", children: [
        /* @__PURE__ */ jsx("td", { className: "py-3 px-4 font-mono text-xs text-gray-300 max-w-[12rem] truncate", children: entry.model }),
        /* @__PURE__ */ jsx("td", { className: `py-3 px-4 font-mono font-semibold ${statusColor(entry.statusCode ?? 0)}`, children: entry.statusCode ?? "—" }),
        /* @__PURE__ */ jsx("td", { className: "py-3 px-4 text-right text-gray-300", children: (entry.inputTokens ?? 0).toLocaleString() }),
        /* @__PURE__ */ jsx("td", { className: "py-3 px-4 text-right text-gray-300", children: (entry.outputTokens ?? 0).toLocaleString() }),
        /* @__PURE__ */ jsxs("td", { className: "py-3 px-4 text-right text-gray-400", children: [
          entry.durationMs,
          "ms"
        ] }),
        /* @__PURE__ */ jsx("td", { className: "py-3 px-4 text-gray-500 text-xs", children: new Date(entry.createdAt).toLocaleString() })
      ] }, entry.id)) })
    ] }) })
  ] });
}
export {
  AuditPage as component
};

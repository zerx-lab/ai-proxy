import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { L as Layout } from "./Layout-TjXybuUa.js";
import { a as useToast, u as useAuth, b as auditApi } from "./router-CG78PKU4.js";
import { useNavigate } from "@tanstack/react-router";
import "@radix-ui/react-toast";
function StatCard({
  label,
  value,
  sub
}) {
  return /* @__PURE__ */ jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsx("p", { className: "text-gray-400 text-sm", children: label }),
    /* @__PURE__ */ jsx("p", { className: "text-3xl font-bold text-white mt-2", children: value }),
    sub && /* @__PURE__ */ jsx("p", { className: "text-gray-500 text-xs mt-1", children: sub })
  ] });
}
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const {
    toast
  } = useToast();
  const {
    loading,
    token
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!token) {
      void navigate({
        to: "/login"
      });
      return;
    }
    auditApi.stats().then(setStats).catch((e) => toast({
      title: "Failed to load stats",
      description: e.message,
      variant: "error"
    })).finally(() => setLoadingStats(false));
  }, [loading, token]);
  const errPct = stats && stats.totalRequests > 0 ? (stats.errorRequests / stats.totalRequests * 100).toFixed(1) + "%" : "0%";
  return /* @__PURE__ */ jsxs(Layout, { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold mb-6", children: "Dashboard" }),
    loadingStats ? /* @__PURE__ */ jsx("p", { className: "text-gray-400", children: "Loading stats…" }) : stats ? /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", children: [
      /* @__PURE__ */ jsx(StatCard, { label: "Total Requests", value: stats.totalRequests.toLocaleString() }),
      /* @__PURE__ */ jsx(StatCard, { label: "Input Tokens", value: stats.totalInputTokens.toLocaleString(), sub: "cumulative" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Output Tokens", value: stats.totalOutputTokens.toLocaleString(), sub: "cumulative" }),
      /* @__PURE__ */ jsx(StatCard, { label: "Error Requests", value: stats.errorRequests.toLocaleString(), sub: `${errPct} error rate` })
    ] }) : /* @__PURE__ */ jsx("p", { className: "text-gray-500", children: "No stats available." })
  ] });
}
export {
  DashboardPage as component
};

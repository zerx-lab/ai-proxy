import { jsxs, jsx } from "react/jsx-runtime";
import { useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import { L as Layout } from "./Layout-TjXybuUa.js";
import { a as useToast, u as useAuth, c as accountsApi } from "./router-CG78PKU4.js";
import "@radix-ui/react-toast";
function AddAccountPanel({
  onAdded
}) {
  const {
    toast
  } = useToast();
  const [busy, setBusy] = useState(false);
  const [oauthState, setOauthState] = useState("");
  const [oauthName, setOauthName] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthStarted, setOauthStarted] = useState(false);
  const [skName, setSkName] = useState("");
  const [skValue, setSkValue] = useState("");
  const [akName, setAkName] = useState("");
  const [akValue, setAkValue] = useState("");
  const handleOAuthStart = async () => {
    setBusy(true);
    try {
      const res = await accountsApi.oauthStart();
      setOauthState(res.state);
      setOauthStarted(true);
      window.open(res.authorizeUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "OAuth start failed",
        description: msg,
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };
  const handleOAuthComplete = async (e) => {
    e.preventDefault();
    if (!oauthName.trim() || !oauthCode.trim()) return;
    setBusy(true);
    try {
      const acc = await accountsApi.oauthComplete(oauthName.trim(), oauthState, oauthCode.trim());
      toast({
        title: "Account added via OAuth",
        variant: "success"
      });
      onAdded(acc);
      setOauthName("");
      setOauthCode("");
      setOauthState("");
      setOauthStarted(false);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      toast({
        title: "OAuth complete failed",
        description: msg,
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };
  const handleSessionKey = async (e) => {
    e.preventDefault();
    if (!skName.trim() || !skValue.trim()) return;
    setBusy(true);
    try {
      const acc = await accountsApi.oauthSessionKey(skName.trim(), skValue.trim());
      toast({
        title: "Account added via session key",
        variant: "success"
      });
      onAdded(acc);
      setSkName("");
      setSkValue("");
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      toast({
        title: "Failed to add session key account",
        description: msg,
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };
  const handleApiKey = async (e) => {
    e.preventDefault();
    if (!akName.trim() || !akValue.trim()) return;
    setBusy(true);
    try {
      const acc = await accountsApi.addApiKey(akName.trim(), akValue.trim());
      toast({
        title: "Account added via API key",
        variant: "success"
      });
      onAdded(acc);
      setAkName("");
      setAkValue("");
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      toast({
        title: "Failed to add API key account",
        description: msg,
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };
  const tabTrigger = "px-4 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent data-[state=active]:text-white data-[state=active]:border-blue-500 transition-colors";
  return /* @__PURE__ */ jsxs("div", { className: "card mt-8", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold mb-4", children: "Add Account" }),
    /* @__PURE__ */ jsxs(Tabs.Root, { defaultValue: "oauth", children: [
      /* @__PURE__ */ jsxs(Tabs.List, { className: "flex border-b border-gray-700 mb-5 -mx-1", children: [
        /* @__PURE__ */ jsx(Tabs.Trigger, { value: "oauth", className: tabTrigger, children: "OAuth Manual" }),
        /* @__PURE__ */ jsx(Tabs.Trigger, { value: "sessionkey", className: tabTrigger, children: "Session Key" }),
        /* @__PURE__ */ jsx(Tabs.Trigger, { value: "apikey", className: tabTrigger, children: "API Key" })
      ] }),
      /* @__PURE__ */ jsxs(Tabs.Content, { value: "oauth", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-400 mb-4", children: "Start the OAuth flow to authorize a Claude account. The authorization page will open in a new tab — paste the code you receive back here." }),
        !oauthStarted ? /* @__PURE__ */ jsx("button", { onClick: () => void handleOAuthStart(), disabled: busy, className: "btn-primary", children: busy ? "Starting…" : "Start OAuth Flow" }) : /* @__PURE__ */ jsxs("form", { onSubmit: (e) => void handleOAuthComplete(e), className: "space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Account name" }),
            /* @__PURE__ */ jsx("input", { type: "text", required: true, placeholder: "e.g. work-account", value: oauthName, onChange: (e) => setOauthName(e.target.value), className: "w-full" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Authorization code (paste from the page that opened)" }),
            /* @__PURE__ */ jsx("input", { type: "text", required: true, placeholder: "Paste code here…", value: oauthCode, onChange: (e) => setOauthCode(e.target.value), className: "w-full font-mono text-sm" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
            /* @__PURE__ */ jsx("button", { type: "button", onClick: () => {
              setOauthStarted(false);
              setOauthState("");
            }, className: "btn-secondary", children: "Restart" }),
            /* @__PURE__ */ jsx("button", { type: "submit", disabled: busy, className: "btn-primary", children: busy ? "Completing…" : "Complete" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Tabs.Content, { value: "sessionkey", children: /* @__PURE__ */ jsxs("form", { onSubmit: (e) => void handleSessionKey(e), className: "space-y-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Account name" }),
          /* @__PURE__ */ jsx("input", { type: "text", required: true, placeholder: "e.g. claude-session", value: skName, onChange: (e) => setSkName(e.target.value), className: "w-full" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Session key" }),
          /* @__PURE__ */ jsx("input", { type: "password", required: true, placeholder: "sk-ant-sid-…", value: skValue, onChange: (e) => setSkValue(e.target.value), className: "w-full font-mono text-sm" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", disabled: busy, className: "btn-primary", children: busy ? "Adding…" : "Add Account" })
      ] }) }),
      /* @__PURE__ */ jsx(Tabs.Content, { value: "apikey", children: /* @__PURE__ */ jsxs("form", { onSubmit: (e) => void handleApiKey(e), className: "space-y-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Account name" }),
          /* @__PURE__ */ jsx("input", { type: "text", required: true, placeholder: "e.g. production-key", value: akName, onChange: (e) => setAkName(e.target.value), className: "w-full" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "API key" }),
          /* @__PURE__ */ jsx("input", { type: "password", required: true, placeholder: "sk-ant-api03-…", value: akValue, onChange: (e) => setAkValue(e.target.value), className: "w-full font-mono text-sm" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", disabled: busy, className: "btn-primary", children: busy ? "Adding…" : "Add Account" })
      ] }) })
    ] })
  ] });
}
const AUTH_TYPE_LABEL = {
  oauth: "OAuth",
  sessionKey: "Session Key",
  apiKey: "API Key"
};
function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const {
    toast
  } = useToast();
  const {
    user,
    token,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.list();
      setAccounts(res.accounts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Failed to load accounts",
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
    if (user && user.role !== "admin") {
      void navigate({
        to: "/"
      });
      return;
    }
    void fetchAccounts();
  }, [authLoading, token, user]);
  const handleToggle = async (acc, enabled) => {
    try {
      await accountsApi.toggle(acc.id, enabled);
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? {
        ...a,
        enabled
      } : a));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Failed to update account",
        description: msg,
        variant: "error"
      });
    }
  };
  const handleDelete = async (id) => {
    if (!confirm("Remove this account? This cannot be undone.")) return;
    try {
      await accountsApi.delete(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast({
        title: "Account removed",
        variant: "success"
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Failed to remove account",
        description: msg,
        variant: "error"
      });
    }
  };
  return /* @__PURE__ */ jsxs(Layout, { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold mb-6", children: "Accounts" }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-gray-400", children: "Loading…" }) : accounts.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card text-center text-gray-400 py-12", children: [
      /* @__PURE__ */ jsx("p", { className: "text-lg", children: "No accounts configured" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm mt-1", children: "Add an account below to start routing requests." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: accounts.map((acc) => /* @__PURE__ */ jsxs("div", { className: "card flex items-center gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium text-white truncate", children: acc.name }),
          /* @__PURE__ */ jsx("span", { className: "text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded shrink-0", children: AUTH_TYPE_LABEL[acc.authType] ?? acc.authType }),
          /* @__PURE__ */ jsx("span", { className: `text-xs px-2 py-0.5 rounded shrink-0 ${acc.status === "active" ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`, children: acc.status })
        ] }),
        acc.email && /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: acc.email })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-xs text-gray-500 text-right shrink-0", children: [
        /* @__PURE__ */ jsxs("p", { children: [
          "Added ",
          new Date(acc.createdAt).toLocaleDateString()
        ] }),
        acc.lastUsedAt && /* @__PURE__ */ jsxs("p", { children: [
          "Used ",
          new Date(acc.lastUsedAt).toLocaleDateString()
        ] }),
        acc.expiresAt && /* @__PURE__ */ jsxs("p", { className: "text-yellow-500", children: [
          "Expires ",
          new Date(acc.expiresAt).toLocaleDateString()
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [
        /* @__PURE__ */ jsx(Switch.Root, { checked: acc.enabled, onCheckedChange: (v) => void handleToggle(acc, v), className: "relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors\n                             focus:outline-none focus:ring-2 focus:ring-blue-500\n                             data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600", children: /* @__PURE__ */ jsx(Switch.Thumb, { className: "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform\n                                          data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => void handleDelete(acc.id), className: "text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-1", children: "Remove" })
      ] })
    ] }, acc.id)) }),
    /* @__PURE__ */ jsx(AddAccountPanel, { onAdded: (acc) => setAccounts((prev) => [acc, ...prev]) })
  ] });
}
export {
  AccountsPage as component
};

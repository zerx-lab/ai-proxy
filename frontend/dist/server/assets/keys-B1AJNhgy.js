import { jsxs, jsx } from "react/jsx-runtime";
import { useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { L as Layout } from "./Layout-TjXybuUa.js";
import { a as useToast, u as useAuth, k as keysApi } from "./router-CG78PKU4.js";
import "@radix-ui/react-toast";
function KeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const {
    toast
  } = useToast();
  const {
    token,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const fetchKeys = useCallback(async () => {
    try {
      const res = await keysApi.list();
      setKeys(res.keys);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Failed to load keys",
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
    void fetchKeys();
  }, [authLoading, token]);
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const created = await keysApi.create(newKeyName.trim());
      setCreatedKey(created);
      setCreateOpen(false);
      setRevealOpen(true);
      setNewKeyName("");
      setKeys((prev) => [{
        ...created
      }, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to create key",
        description: msg,
        variant: "error"
      });
    } finally {
      setCreating(false);
    }
  };
  const handleToggle = async (key, enabled) => {
    try {
      await keysApi.toggle(key.id, enabled);
      setKeys((prev) => prev.map((k) => k.id === key.id ? {
        ...k,
        enabled
      } : k));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to update key",
        description: msg,
        variant: "error"
      });
    }
  };
  const handleDelete = async (id) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    try {
      await keysApi.delete(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast({
        title: "Key deleted",
        variant: "success"
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to delete key",
        description: msg,
        variant: "error"
      });
    }
  };
  const copyKey = async () => {
    if (!(createdKey == null ? void 0 : createdKey.key)) return;
    await navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs(Layout, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold", children: "API Keys" }),
      /* @__PURE__ */ jsxs(Dialog.Root, { open: createOpen, onOpenChange: setCreateOpen, children: [
        /* @__PURE__ */ jsx(Dialog.Trigger, { asChild: true, children: /* @__PURE__ */ jsx("button", { className: "btn-primary", children: "+ Create Key" }) }),
        /* @__PURE__ */ jsxs(Dialog.Portal, { children: [
          /* @__PURE__ */ jsx(Dialog.Overlay, { className: "fixed inset-0 bg-black/60 z-40" }),
          /* @__PURE__ */ jsxs(Dialog.Content, { className: "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 card w-full max-w-sm shadow-2xl", children: [
            /* @__PURE__ */ jsx(Dialog.Title, { className: "text-lg font-bold mb-4", children: "Create API Key" }),
            /* @__PURE__ */ jsxs("form", { onSubmit: handleCreate, className: "space-y-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", children: "Key name" }),
                /* @__PURE__ */ jsx("input", { type: "text", required: true, placeholder: "e.g. production-app", value: newKeyName, onChange: (e) => setNewKeyName(e.target.value), className: "w-full", autoFocus: true })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-3 justify-end", children: [
                /* @__PURE__ */ jsx(Dialog.Close, { asChild: true, children: /* @__PURE__ */ jsx("button", { type: "button", className: "btn-secondary", children: "Cancel" }) }),
                /* @__PURE__ */ jsx("button", { type: "submit", disabled: creating, className: "btn-primary", children: creating ? "Creating…" : "Create" })
              ] })
            ] })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Dialog.Root, { open: revealOpen, onOpenChange: (o) => {
      if (!o) {
        setCreatedKey(null);
        setCopied(false);
      }
      setRevealOpen(o);
    }, children: /* @__PURE__ */ jsxs(Dialog.Portal, { children: [
      /* @__PURE__ */ jsx(Dialog.Overlay, { className: "fixed inset-0 bg-black/60 z-40" }),
      /* @__PURE__ */ jsxs(Dialog.Content, { className: "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 card w-full max-w-md shadow-2xl", children: [
        /* @__PURE__ */ jsx(Dialog.Title, { className: "text-lg font-bold mb-2", children: "Key created — save it now" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-yellow-400 mb-4", children: "⚠ This is the only time the full key will be shown." }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center", children: [
          /* @__PURE__ */ jsx("code", { className: "flex-1 bg-gray-900 text-green-400 text-xs px-3 py-2 rounded-lg break-all font-mono", children: createdKey == null ? void 0 : createdKey.key }),
          /* @__PURE__ */ jsx("button", { onClick: copyKey, className: "btn-secondary text-sm shrink-0", children: copied ? "✓ Copied" : "Copy" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex justify-end mt-4", children: /* @__PURE__ */ jsx(Dialog.Close, { asChild: true, children: /* @__PURE__ */ jsx("button", { className: "btn-primary", children: "Done" }) }) })
      ] })
    ] }) }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-gray-400", children: "Loading…" }) : keys.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card text-center text-gray-400 py-12", children: [
      /* @__PURE__ */ jsx("p", { className: "text-lg", children: "No API keys yet" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm mt-1", children: "Create your first key to start using the proxy." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: keys.map((key) => /* @__PURE__ */ jsxs("div", { className: "card flex items-center gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "font-medium text-white truncate", children: key.name }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 mt-0.5 font-mono", children: [
          key.keyPrefix,
          "…"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-xs text-gray-500 text-right shrink-0", children: [
        /* @__PURE__ */ jsxs("p", { children: [
          "Created ",
          new Date(key.createdAt).toLocaleDateString()
        ] }),
        key.lastUsedAt && /* @__PURE__ */ jsxs("p", { children: [
          "Used ",
          new Date(key.lastUsedAt).toLocaleDateString()
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [
        /* @__PURE__ */ jsx(Switch.Root, { checked: key.enabled, onCheckedChange: (v) => void handleToggle(key, v), className: "relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors\n                             focus:outline-none focus:ring-2 focus:ring-blue-500\n                             data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600", children: /* @__PURE__ */ jsx(Switch.Thumb, { className: "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform\n                                          data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => void handleDelete(key.id), className: "text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-1", children: "Delete" })
      ] })
    ] }, key.id)) })
  ] });
}
export {
  KeysPage as component
};

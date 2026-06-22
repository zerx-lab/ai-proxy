import { createRootRoute, Outlet, HeadContent, Scripts, createFileRoute, lazyRouteComponent, redirect, createRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect, createContext, useContext, useRef } from "react";
import * as Toast from "@radix-ui/react-toast";
const BASE_URL = "http://localhost:4000";
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}
async function request(method, path, body) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...body !== void 0 ? { body: JSON.stringify(body) } : {}
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      msg = json.message ?? json.error ?? JSON.stringify(json);
    } catch {
      const text2 = await res.text().catch(() => "");
      if (text2) msg = text2;
    }
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text) return void 0;
  return JSON.parse(text);
}
const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path)
};
const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  signup: (email, password) => api.post("/auth/signup", { email, password }),
  me: () => api.get("/auth/me")
};
const keysApi = {
  list: () => api.get("/keys"),
  create: (name) => api.post("/keys", { name }),
  toggle: (id, enabled) => api.patch(`/keys/${id}`, { id, enabled }),
  delete: (id) => api.delete(`/keys/${id}`)
};
const accountsApi = {
  list: () => api.get("/accounts"),
  oauthStart: () => api.post("/accounts/oauth/start", {}),
  oauthComplete: (name, state, code) => api.post("/accounts/oauth/complete", { name, state, code }),
  oauthSessionKey: (name, sessionKey) => api.post("/accounts/oauth/session-key", { name, sessionKey }),
  addApiKey: (name, apiKey) => api.post("/accounts/apikey", { name, apiKey }),
  toggle: (id, enabled) => api.patch(`/accounts/${id}`, { id, enabled }),
  delete: (id) => api.delete(`/accounts/${id}`)
};
const auditApi = {
  list: (limit = 100) => api.get(`/audit?limit=${limit}`),
  stats: () => api.get("/audit/stats")
};
const AuthContext = createContext(null);
const TOKEN_KEY = "auth_token";
function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const persist = useCallback((t) => {
    setToken(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);
  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      persist(null);
      setUser(null);
    }
  }, [persist]);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (stored) {
      loadMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  const login = useCallback(
    async (email, password) => {
      const res = await authApi.login(email, password);
      persist(res.token);
      setUser(res.user);
    },
    [persist]
  );
  const signup = useCallback(
    async (email, password) => {
      const res = await authApi.signup(email, password);
      persist(res.token);
      setUser(res.user);
    },
    [persist]
  );
  const logout = useCallback(() => {
    persist(null);
    setUser(null);
  }, [persist]);
  return /* @__PURE__ */ jsx(
    AuthContext.Provider,
    {
      value: { token, user, loading, login, signup, logout, loadMe },
      children
    }
  );
}
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
const ToastContext = createContext(null);
function ToastProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const counter = useRef(0);
  const toast = (msg) => {
    const id = ++counter.current;
    setMessages((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 5e3);
  };
  return /* @__PURE__ */ jsx(ToastContext.Provider, { value: { toast }, children: /* @__PURE__ */ jsxs(Toast.Provider, { swipeDirection: "right", duration: 5e3, children: [
    children,
    messages.map((msg) => /* @__PURE__ */ jsxs(
      Toast.Root,
      {
        open: true,
        className: [
          "flex flex-col gap-1 rounded-lg px-4 py-3 shadow-lg border",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[swipe=end]:animate-out",
          msg.variant === "error" ? "bg-red-900 border-red-700 text-red-100" : msg.variant === "success" ? "bg-green-900 border-green-700 text-green-100" : "bg-gray-800 border-gray-600 text-gray-100"
        ].join(" "),
        children: [
          /* @__PURE__ */ jsx(Toast.Title, { className: "font-semibold text-sm", children: msg.title }),
          msg.description && /* @__PURE__ */ jsx(Toast.Description, { className: "text-xs opacity-80", children: msg.description })
        ]
      },
      msg.id
    )),
    /* @__PURE__ */ jsx(Toast.Viewport, { className: "fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80" })
  ] }) });
}
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
const Route$5 = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Proxy Gateway" }
    ]
  }),
  component: RootComponent
});
function RootComponent() {
  return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(ToastProvider, { children: /* @__PURE__ */ jsx(Outlet, {}) }) }) });
}
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter$4 = () => import("./login-DmGRA_MF.js");
const Route$4 = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("auth_token")) {
      throw redirect({
        to: "/"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
const $$splitComponentImporter$3 = () => import("./keys-B1AJNhgy.js");
const Route$3 = createFileRoute("/keys")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("./audit-CwHTl5Ax.js");
const Route$2 = createFileRoute("/audit")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("./accounts-DHVTBwqQ.js");
const Route$1 = createFileRoute("/accounts")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const $$splitComponentImporter = () => import("./index-CofuTWxf.js");
const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("auth_token")) {
      throw redirect({
        to: "/login"
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const LoginRoute = Route$4.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => Route$5
});
const KeysRoute = Route$3.update({
  id: "/keys",
  path: "/keys",
  getParentRoute: () => Route$5
});
const AuditRoute = Route$2.update({
  id: "/audit",
  path: "/audit",
  getParentRoute: () => Route$5
});
const AccountsRoute = Route$1.update({
  id: "/accounts",
  path: "/accounts",
  getParentRoute: () => Route$5
});
const IndexRoute = Route.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$5
});
const rootRouteChildren = {
  IndexRoute,
  AccountsRoute,
  AuditRoute,
  KeysRoute,
  LoginRoute
};
const routeTree = Route$5._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const router2 = createRouter({
    routeTree,
    scrollRestoration: true
  });
  return router2;
}
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  useToast as a,
  auditApi as b,
  accountsApi as c,
  keysApi as k,
  router as r,
  useAuth as u
};

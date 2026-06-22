import { jsxs, jsx } from "react/jsx-runtime";
import { useNavigate, Link } from "@tanstack/react-router";
import { u as useAuth } from "./router-CG78PKU4.js";
const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: "◈" },
  { to: "/keys", label: "API Keys", icon: "⚿" },
  { to: "/audit", label: "Audit Log", icon: "◷" }
];
const ADMIN_LINK = { to: "/accounts", label: "Accounts", icon: "◉" };
function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    void navigate({ to: "/login" });
  };
  const links = (user == null ? void 0 : user.role) === "admin" ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-screen", children: [
    /* @__PURE__ */ jsxs("aside", { className: "w-56 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "px-5 py-4 border-b border-gray-800", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-lg font-bold text-white tracking-tight", children: "AI Proxy" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Gateway" })
      ] }),
      /* @__PURE__ */ jsx("nav", { className: "flex-1 py-4 px-3 flex flex-col gap-1", children: links.map((link) => /* @__PURE__ */ jsxs(
        Link,
        {
          to: link.to,
          className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors",
          activeProps: { className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-blue-600 text-white" },
          activeOptions: { exact: link.to === "/" },
          children: [
            /* @__PURE__ */ jsx("span", { className: "text-base", children: link.icon }),
            link.label
          ]
        },
        link.to
      )) }),
      /* @__PURE__ */ jsxs("div", { className: "px-4 py-4 border-t border-gray-800", children: [
        user && /* @__PURE__ */ jsxs("div", { className: "mb-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 truncate", children: user.email }),
          user.role === "admin" && /* @__PURE__ */ jsx("span", { className: "text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded mt-1 inline-block", children: "admin" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleLogout,
            className: "w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors px-2 py-1",
            children: "Sign out"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("main", { className: "flex-1 overflow-auto p-8", children })
  ] });
}
export {
  Layout as L
};

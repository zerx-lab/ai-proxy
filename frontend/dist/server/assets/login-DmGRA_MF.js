import { jsx, jsxs } from "react/jsx-runtime";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { u as useAuth, a as useToast } from "./router-CG78PKU4.js";
import "@radix-ui/react-toast";
function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    login,
    signup
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      void navigate({
        to: "/"
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: mode === "login" ? "Login failed" : "Signup failed",
        description: msg,
        variant: "error"
      });
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-950 px-4", children: /* @__PURE__ */ jsxs("div", { className: "card w-full max-w-md", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-white", children: "AI Proxy Gateway" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-400 mt-1 text-sm", children: mode === "login" ? "Sign in to your account" : "Create a new account" })
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", htmlFor: "email", children: "Email" }),
        /* @__PURE__ */ jsx("input", { id: "email", type: "email", required: true, autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", className: "w-full" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "block text-sm text-gray-300 mb-1.5", htmlFor: "password", children: "Password" }),
        /* @__PURE__ */ jsx("input", { id: "password", type: "password", required: true, autoComplete: mode === "login" ? "current-password" : "new-password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "••••••••", className: "w-full" })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", disabled: busy, className: "btn-primary w-full mt-2", children: busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-5 text-center text-sm text-gray-400", children: [
      mode === "login" ? "Don't have an account? " : "Already have an account? ",
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setMode(mode === "login" ? "signup" : "login"), className: "text-blue-400 hover:text-blue-300 font-medium", children: mode === "login" ? "Sign up" : "Sign in" })
    ] })
  ] }) });
}
export {
  LoginPage as component
};

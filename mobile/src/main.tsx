import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@capacitor/app";
import CityLogger from "../../src/frontend/CityLogger";
import { supabase } from "../../src/backend/supabase";
import "../../src/frontend/styles.css";
import "./native.css";

document.documentElement.classList.add("native-app");

const root = document.getElementById("root");

if (!root) {
  throw new Error("CityLogger could not find its mobile root element.");
}

createRoot(root).render(
  <React.StrictMode>
    <CityLogger nativeMode />
  </React.StrictMode>
);

async function handleAuthCallback(url: string) {
  if (!supabase || !url.startsWith("citylogger://auth")) return;

  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1) || parsed.search.slice(1));
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (params.get("type") === "recovery") {
    window.sessionStorage.setItem("citylogger-password-recovery", "true");
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
}

void App.addListener("appUrlOpen", ({ url }) => {
  void handleAuthCallback(url);
});

void App.getLaunchUrl().then(result => {
  if (result?.url) void handleAuthCallback(result.url);
});
